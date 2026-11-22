"""Tests for POST /api/agent/metrics, 3-minute offline timeout, and agent script."""

import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pytest
import requests
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserResponse
from app.database import get_session_factory
from app.main import app
from app.models import DeviceModel

client = TestClient(app)
AGENT_SCRIPT = Path(__file__).resolve().parents[2] / "agent" / "cloudops_agent.py"


def _load_agent_module():
    spec = importlib.util.spec_from_file_location("cloudops_agent", AGENT_SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def as_admin():
    app.dependency_overrides[get_current_user] = lambda: UserResponse(
        id="user-admin",
        username="admin",
        email="admin@test.local",
        role="admin",
        is_active=True,
        created_at="2026-11-21T00:00:00+00:00",
    )
    yield
    app.dependency_overrides.clear()


def test_agent_metrics_requires_valid_key():
    payload = {"cpu": 10.0, "memory": 20.0, "storage": 30.0, "uptimeSeconds": 100}
    assert client.post("/api/agent/metrics", json=payload).status_code == 401
    assert (
        client.post(
            "/api/agent/metrics",
            json=payload,
            headers={"X-Agent-Key": "coa_invalid_key"},
        ).status_code
        == 401
    )


def test_agent_metrics_updates_device_and_stores_history(as_admin):
    created = client.post(
        "/api/devices",
        json={"hostname": "homelab-vm", "type": "vm", "ipAddress": "10.0.0.12"},
    )
    assert created.status_code == 201
    device_id = created.json()["device"]["id"]
    agent_key = created.json()["agentKey"]
    assert created.json()["device"]["status"] == "offline"
    assert created.json()["device"]["lastSeen"] is None

    # Agent endpoint uses X-Agent-Key with no user Bearer token
    report = client.post(
        "/api/agent/metrics",
        json={"cpu": 23.5, "memory": 61.2, "storage": 74.0, "uptimeSeconds": 86400},
        headers={"X-Agent-Key": agent_key},
    )
    assert report.status_code == 204

    detail = client.get(f"/api/devices/{device_id}")
    assert detail.status_code == 200
    dev = detail.json()
    assert dev["status"] == "online"
    assert dev["cpu"] == 24
    assert dev["memory"] == 61
    assert dev["storage"] == 74
    assert dev["lastSeen"] is not None

    history = client.get(f"/api/devices/{device_id}/metrics?metric=cpu&hours=1")
    assert history.status_code == 200
    points = history.json()
    assert len(points) == 1
    assert points[0]["value"] == 23.5


def test_rotated_key_invalidates_old_key(as_admin):
    created = client.post("/api/devices", json={"hostname": "rotate-vm", "type": "vm"}).json()
    device_id = created["device"]["id"]
    old_key = created["agentKey"]

    new_key = client.post(f"/api/devices/{device_id}/agent-key").json()["agentKey"]
    payload = {"cpu": 15.0, "memory": 30.0, "storage": 40.0, "uptimeSeconds": 60}

    assert (
        client.post("/api/agent/metrics", json=payload, headers={"X-Agent-Key": old_key}).status_code
        == 401
    )
    assert (
        client.post("/api/agent/metrics", json=payload, headers={"X-Agent-Key": new_key}).status_code
        == 204
    )


def test_agent_metrics_validation(as_admin):
    created = client.post("/api/devices", json={"hostname": "val-vm", "type": "vm"}).json()
    key = created["agentKey"]

    assert (
        client.post(
            "/api/agent/metrics",
            json={"cpu": 150.0, "memory": 20.0, "storage": 30.0},
            headers={"X-Agent-Key": key},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/agent/metrics",
            json={"cpu": 10.0, "memory": 20.0, "storage": -1.0},
            headers={"X-Agent-Key": key},
        ).status_code
        == 422
    )


def test_device_becomes_offline_after_3_minutes(as_admin):
    created = client.post("/api/devices", json={"hostname": "stale-vm", "type": "vm"}).json()
    device_id = created["device"]["id"]
    key = created["agentKey"]

    assert (
        client.post(
            "/api/agent/metrics",
            json={"cpu": 30.0, "memory": 40.0, "storage": 50.0, "uptimeSeconds": 120},
            headers={"X-Agent-Key": key},
        ).status_code
        == 204
    )
    assert client.get(f"/api/devices/{device_id}").json()["status"] == "online"

    # Simulate 4 minutes passing without another report (> 3 minute timeout)
    stale_time = datetime.now(timezone.utc) - timedelta(minutes=4)
    db = get_session_factory()()
    try:
        dev = db.get(DeviceModel, device_id)
        assert dev is not None
        dev.last_seen = stale_time
        db.commit()
    finally:
        db.close()

    assert client.get(f"/api/devices/{device_id}").json()["status"] == "offline"
    listed = [d for d in client.get("/api/devices").json() if d["id"] == device_id]
    assert listed[0]["status"] == "offline"

    # Seeded devices (4 online, 1 offline) + 1 now-stale device => 4 online, 2 offline
    summary = client.get("/api/dashboard/summary").json()
    assert summary["offlineDevices"] == 2
    assert summary["onlineDevices"] == 4


def test_agent_load_key_from_arg_and_file(tmp_path):
    agent_mod = _load_agent_module()
    assert agent_mod.load_key("  coa_abc123  ", None) == "coa_abc123"

    key_file = tmp_path / "agent.key"
    key_file.write_text("coa_from_file\n", encoding="utf-8")
    assert agent_mod.load_key(None, str(key_file)) == "coa_from_file"


def test_agent_send_report_handles_204_401_and_connection_error(monkeypatch, capsys):
    agent_mod = _load_agent_module()
    payload = {"cpu": 12.3, "memory": 45.6, "storage": 78.9, "uptimeSeconds": 3600}

    ok_resp = MagicMock(status_code=204)
    monkeypatch.setattr(agent_mod.requests, "post", lambda *a, **kw: ok_resp)
    assert agent_mod.send_report("http://localhost:8000/api/", "coa_k", payload) == "ok"

    unauth_resp = MagicMock(status_code=401)
    monkeypatch.setattr(agent_mod.requests, "post", lambda *a, **kw: unauth_resp)
    assert agent_mod.send_report("http://localhost:8000/api", "coa_bad", payload) == "unauthorized"
    assert "401" in capsys.readouterr().err

    def _raise_conn(*_args, **_kwargs):
        raise requests.ConnectionError("server down")

    monkeypatch.setattr(agent_mod.requests, "post", _raise_conn)
    assert agent_mod.send_report("http://localhost:8000/api", "coa_k", payload) == "error"
