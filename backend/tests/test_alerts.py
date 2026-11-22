"""Tests for the automatic alert engine and /api/alerts/{id}/acknowledge|resolve."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserResponse
from app.database import get_session_factory
from app.main import app
from app.models import DeviceModel

client = TestClient(app)


def _fake_user(role: str) -> UserResponse:
    return UserResponse(
        id=f"user-{role}",
        username=f"{role}-user",
        email=f"{role}@test.local",
        role=role,
        is_active=True,
        created_at="2026-11-21T00:00:00+00:00",
    )


@pytest.fixture
def as_role():
    def _set(role: str):
        app.dependency_overrides[get_current_user] = lambda: _fake_user(role)

    yield _set
    app.dependency_overrides.clear()


def _create_device(as_role, hostname: str) -> tuple[int, str]:
    as_role("admin")
    created = client.post("/api/devices", json={"hostname": hostname, "type": "vm"}).json()
    return created["device"]["id"], created["agentKey"]


def test_storage_threshold_opens_deduplicates_and_auto_resolves(as_role):
    device_id, key = _create_device(as_role, "disk-box")

    # Report storage >= 90% twice -> only 1 open critical alert
    for pct in (92.0, 95.0):
        assert (
            client.post(
                "/api/agent/metrics",
                json={"cpu": 10.0, "memory": 20.0, "storage": pct},
                headers={"X-Agent-Key": key},
            ).status_code
            == 204
        )

    active = [a for a in client.get("/api/alerts").json() if a["deviceId"] == device_id]
    assert len(active) == 1
    assert active[0]["severity"] == "critical"
    assert active[0]["status"] == "open"
    assert "storage exceeds 90%" in active[0]["message"]

    # Storage drops below 90% -> auto-resolves
    assert (
        client.post(
            "/api/agent/metrics",
            json={"cpu": 10.0, "memory": 20.0, "storage": 65.0},
            headers={"X-Agent-Key": key},
        ).status_code
        == 204
    )

    assert [a for a in client.get("/api/alerts").json() if a["deviceId"] == device_id] == []
    history = [a for a in client.get("/api/alerts?status=all").json() if a["deviceId"] == device_id]
    assert len(history) == 1
    assert history[0]["status"] == "resolved"
    assert history[0]["resolvedAt"] is not None


def test_cpu_warning_escalates_to_critical_and_auto_resolves(as_role):
    device_id, key = _create_device(as_role, "cpu-box")

    # >= 70% -> warning
    client.post(
        "/api/agent/metrics",
        json={"cpu": 75.0, "memory": 20.0, "storage": 30.0},
        headers={"X-Agent-Key": key},
    )
    alerts = [a for a in client.get("/api/alerts").json() if a["deviceId"] == device_id]
    assert len(alerts) == 1
    assert alerts[0]["severity"] == "warning"

    # >= 90% -> escalates the same alert (no duplicate)
    client.post(
        "/api/agent/metrics",
        json={"cpu": 94.0, "memory": 20.0, "storage": 30.0},
        headers={"X-Agent-Key": key},
    )
    escalated = [a for a in client.get("/api/alerts").json() if a["deviceId"] == device_id]
    assert len(escalated) == 1
    assert escalated[0]["id"] == alerts[0]["id"]
    assert escalated[0]["severity"] == "critical"
    assert "CPU exceeds 90%" in escalated[0]["message"]

    # < 70% -> auto-resolves
    client.post(
        "/api/agent/metrics",
        json={"cpu": 40.0, "memory": 20.0, "storage": 30.0},
        headers={"X-Agent-Key": key},
    )
    assert [a for a in client.get("/api/alerts").json() if a["deviceId"] == device_id] == []


def test_offline_alert_opens_when_stale_and_resolves_on_report(as_role):
    device_id, key = _create_device(as_role, "vm-watchdog")

    # First healthy report sets device online
    assert (
        client.post(
            "/api/agent/metrics",
            json={"cpu": 12.0, "memory": 25.0, "storage": 40.0},
            headers={"X-Agent-Key": key},
        ).status_code
        == 204
    )
    assert [a for a in client.get("/api/alerts").json() if a["deviceId"] == device_id] == []

    # Simulate agent stopping for > 3 minutes
    db = get_session_factory()()
    try:
        dev = db.get(DeviceModel, device_id)
        assert dev is not None
        dev.last_seen = datetime.now(timezone.utc) - timedelta(minutes=5)
        db.commit()
    finally:
        db.close()

    # Reading alerts triggers offline rule without duplicating
    active = [a for a in client.get("/api/alerts").json() if a["deviceId"] == device_id]
    assert len(active) == 1
    assert active[0]["severity"] == "critical"
    assert active[0]["message"] == "vm-watchdog is offline"

    # Reading devices again does not duplicate
    client.get("/api/devices")
    assert len([a for a in client.get("/api/alerts").json() if a["deviceId"] == device_id]) == 1

    # Agent comes back -> offline alert auto-resolves
    assert (
        client.post(
            "/api/agent/metrics",
            json={"cpu": 15.0, "memory": 25.0, "storage": 40.0},
            headers={"X-Agent-Key": key},
        ).status_code
        == 204
    )
    assert [a for a in client.get("/api/alerts").json() if a["deviceId"] == device_id] == []


def test_acknowledge_and_resolve_roles_and_summary(as_role):
    device_id, key = _create_device(as_role, "ack-box")
    client.post(
        "/api/agent/metrics",
        json={"cpu": 10.0, "memory": 78.0, "storage": 20.0},
        headers={"X-Agent-Key": key},
    )
    alert_id = [a for a in client.get("/api/alerts").json() if a["deviceId"] == device_id][0]["id"]

    # Signed out -> 401; viewer -> 403
    app.dependency_overrides.clear()
    assert client.post(f"/api/alerts/{alert_id}/acknowledge").status_code == 401
    assert client.post(f"/api/alerts/{alert_id}/resolve").status_code == 401

    as_role("viewer")
    assert client.post(f"/api/alerts/{alert_id}/acknowledge").status_code == 403
    assert client.post(f"/api/alerts/{alert_id}/resolve").status_code == 403

    # Operator can acknowledge (still counted in activeAlerts)
    as_role("operator")
    ack = client.post(f"/api/alerts/{alert_id}/acknowledge")
    assert ack.status_code == 200
    assert ack.json()["status"] == "acknowledged"
    assert ack.json()["acknowledgedBy"] == "operator-user"

    before_resolve = client.get("/api/dashboard/summary").json()["activeAlerts"]
    assert before_resolve == len(client.get("/api/alerts").json())

    # Admin or operator can resolve -> excluded from activeAlerts & default GET /alerts
    as_role("admin")
    res = client.post(f"/api/alerts/{alert_id}/resolve")
    assert res.status_code == 200
    assert res.json()["status"] == "resolved"
    assert res.json()["resolvedAt"] is not None

    after_resolve = client.get("/api/dashboard/summary").json()["activeAlerts"]
    assert after_resolve == before_resolve - 1
    assert all(a["id"] != alert_id for a in client.get("/api/alerts").json())
    assert any(a["id"] == alert_id for a in client.get("/api/alerts?status=all").json())

    # Cannot acknowledge an already-resolved alert; missing alert returns 404
    assert client.post(f"/api/alerts/{alert_id}/acknowledge").status_code == 409
    assert client.post("/api/alerts/9999/acknowledge").status_code == 404
    assert client.post("/api/alerts/9999/resolve").status_code == 404
