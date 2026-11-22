"""Tests for /api/devices/* CRUD, role checks, agent key rotation, and metric history."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserResponse
from app.database import get_session_factory
from app.main import app
from app.models import AlertModel, DeviceModel, MetricModel
from app.routers.devices import hash_agent_key

client = TestClient(app)


def _fake_user(role: str) -> UserResponse:
    return UserResponse(
        id=f"user-{role}",
        username=role,
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


def test_device_detail_requires_login():
    assert client.get("/api/devices/1").status_code == 401


def test_get_device_and_404(as_role):
    as_role("viewer")
    resp = client.get("/api/devices/1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == 1
    assert body["hostname"] == "plex-server"
    assert body["type"] == "server"
    assert body["ipAddress"] == "192.168.1.20"
    assert body["lastSeen"] is not None

    assert client.get("/api/devices/9999").status_code == 404


def test_create_device_requires_admin(as_role):
    payload = {"hostname": "new-node", "type": "vm"}
    assert client.post("/api/devices", json=payload).status_code == 401

    for role in ("viewer", "operator"):
        as_role(role)
        assert client.post("/api/devices", json=payload).status_code == 403


def test_create_device_returns_key_once_and_stores_hash(as_role):
    as_role("admin")
    resp = client.post(
        "/api/devices",
        json={
            "hostname": "homelab-k3s",
            "type": "vm",
            "ipAddress": "10.0.0.40",
            "description": "Single-node k3s cluster",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    device = body["device"]
    plain_key = body["agentKey"]

    assert plain_key.startswith("coa_")
    assert len(plain_key) == 36
    assert device["hostname"] == "homelab-k3s"
    assert device["type"] == "vm"
    assert device["status"] == "offline"
    assert device["cpu"] == 0
    assert device["memory"] == 0
    assert device["storage"] == 0
    assert device["lastSeen"] is None

    db = get_session_factory()()
    try:
        stored = db.get(DeviceModel, device["id"])
        assert stored is not None
        assert stored.agent_key_hash == hash_agent_key(plain_key)
        assert stored.agent_key_hash != plain_key
    finally:
        db.close()

    # Plain key is never returned by GET /devices/{id}
    detail = client.get(f"/api/devices/{device['id']}").json()
    assert "agentKey" not in detail
    assert "agentKeyHash" not in detail


def test_create_device_conflict_and_validation(as_role):
    as_role("admin")
    # Case-insensitive duplicate of seeded "plex-server"
    dup = client.post("/api/devices", json={"hostname": "PLEX-SERVER", "type": "server"})
    assert dup.status_code == 409

    bad_type = client.post("/api/devices", json={"hostname": "x", "type": "toaster"})
    assert bad_type.status_code == 422

    blank_host = client.post("/api/devices", json={"hostname": "   ", "type": "server"})
    assert blank_host.status_code == 422


def test_update_device_preserves_metrics_and_handles_errors(as_role):
    as_role("viewer")
    assert client.put("/api/devices/1", json={"hostname": "x", "type": "vm"}).status_code == 403

    as_role("admin")
    resp = client.put(
        "/api/devices/1",
        json={
            "hostname": "plex-renamed",
            "type": "container",
            "ipAddress": "192.168.1.99",
            "description": "Updated media container",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["hostname"] == "plex-renamed"
    assert body["type"] == "container"
    assert body["ipAddress"] == "192.168.1.99"
    assert body["status"] == "online"
    assert body["cpu"] == 25

    assert client.put("/api/devices/9999", json={"hostname": "missing", "type": "vm"}).status_code == 404
    assert client.put("/api/devices/1", json={"hostname": "NAS-01", "type": "nas"}).status_code == 409


def test_delete_device_cascades_and_checks_role(as_role):
    as_role("operator")
    assert client.delete("/api/devices/3").status_code == 403

    as_role("admin")
    # Seeded proxmox-host (id=3) has metric rows and an alert row
    resp = client.delete("/api/devices/3")
    assert resp.status_code == 204
    assert client.get("/api/devices/3").status_code == 404

    db = get_session_factory()()
    try:
        assert db.scalar(select(func.count()).select_from(MetricModel).where(MetricModel.device_id == 3)) == 0
        assert db.scalar(select(func.count()).select_from(AlertModel).where(AlertModel.device_id == 3)) == 0
    finally:
        db.close()

    assert client.delete("/api/devices/9999").status_code == 404


def test_rotate_agent_key(as_role):
    as_role("operator")
    assert client.post("/api/devices/1/agent-key").status_code == 403

    as_role("admin")
    first = client.post("/api/devices/1/agent-key")
    assert first.status_code == 200
    first_key = first.json()["agentKey"]
    assert first_key.startswith("coa_")

    second = client.post("/api/devices/1/agent-key")
    assert second.status_code == 200
    second_key = second.json()["agentKey"]
    assert second_key != first_key

    db = get_session_factory()()
    try:
        stored = db.get(DeviceModel, 1)
        assert stored is not None
        assert stored.agent_key_hash == hash_agent_key(second_key)
        assert stored.agent_key_hash != hash_agent_key(first_key)
    finally:
        db.close()

    assert client.post("/api/devices/9999/agent-key").status_code == 404


def test_device_metrics_5min_and_hourly_buckets(as_role):
    assert client.get("/api/devices/1/metrics").status_code == 401

    as_role("viewer")
    assert client.get("/api/devices/9999/metrics").status_code == 404
    assert client.get("/api/devices/1/metrics?hours=0").status_code == 422
    assert client.get("/api/devices/1/metrics?hours=200").status_code == 422
    assert client.get("/api/devices/1/metrics?metric=gpu").status_code == 422

    now = datetime.now(timezone.utc).replace(minute=12, second=0, microsecond=0)
    db = get_session_factory()()
    try:
        dev = DeviceModel(hostname="metrics-node", status="online")
        db.add(dev)
        db.flush()
        dev_id = dev.id

        t_recent_a = now - timedelta(minutes=11)  # e.g. :01 -> bucket :00
        t_recent_b = now - timedelta(minutes=9)   # e.g. :03 -> same bucket :00
        t_hourly_old = now - timedelta(hours=36)
        t_too_old = now - timedelta(hours=180)    # outside 168h max window

        db.add_all(
            [
                MetricModel(device_id=dev_id, timestamp=t_recent_a, cpu=20.0, memory=40.0, storage=60.0),
                MetricModel(device_id=dev_id, timestamp=t_recent_b, cpu=40.0, memory=60.0, storage=60.0),
                MetricModel(device_id=dev_id, timestamp=t_hourly_old, cpu=80.0, memory=50.0, storage=65.0),
                MetricModel(device_id=dev_id, timestamp=t_too_old, cpu=99.0, memory=99.0, storage=99.0),
            ]
        )
        db.commit()
    finally:
        db.close()

    # 24h -> 5-minute buckets ("HH:MM"), excludes 36h and 180h points
    res_24h = client.get(f"/api/devices/{dev_id}/metrics?metric=cpu&hours=24")
    assert res_24h.status_code == 200
    pts_24h = res_24h.json()
    expected_bucket = t_recent_a.replace(minute=(t_recent_a.minute // 5) * 5, second=0, microsecond=0)
    assert pts_24h == [{"timestamp": expected_bucket.strftime("%H:%M"), "value": 30.0}]

    # 72h -> hourly buckets ("D Mon HH:MM"), oldest first, excludes 180h point
    res_72h = client.get(f"/api/devices/{dev_id}/metrics?metric=memory&hours=72")
    assert res_72h.status_code == 200
    pts_72h = res_72h.json()
    old_hour = t_hourly_old.replace(minute=0, second=0, microsecond=0)
    recent_hour = t_recent_a.replace(minute=0, second=0, microsecond=0)
    assert pts_72h == [
        {"timestamp": f"{old_hour.day} {old_hour.strftime('%b %H:%M')}", "value": 50.0},
        {"timestamp": f"{recent_hour.day} {recent_hour.strftime('%b %H:%M')}", "value": 50.0},
    ]
