"""Tests for Discord webhook and AWS SNS critical alert notifications."""

import json
import urllib.error
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserResponse
from app.database import get_session_factory
from app.main import app
from app.models import DeviceModel
from app.notifications import notify_critical_alert

client = TestClient(app)


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


def test_no_notification_when_unconfigured(monkeypatch):
    monkeypatch.delenv("ALERT_WEBHOOK_URL", raising=False)
    monkeypatch.delenv("ALERT_SNS_TOPIC_ARN", raising=False)
    assert notify_critical_alert("nas-01", "nas-01 storage exceeds 90%", "storage") == []


def test_webhook_rejects_non_https_url(monkeypatch):
    monkeypatch.setenv("ALERT_WEBHOOK_URL", "http://169.254.169.254/latest/meta-data")
    monkeypatch.delenv("ALERT_SNS_TOPIC_ARN", raising=False)

    mock_open = MagicMock()
    monkeypatch.setattr("app.notifications.urllib.request.urlopen", mock_open)

    assert notify_critical_alert("nas-01", "nas-01 storage exceeds 90%", "storage") == []
    assert mock_open.call_count == 0


def test_discord_webhook_on_critical_escalation_and_deduplication(monkeypatch, as_admin):
    monkeypatch.setenv("ALERT_WEBHOOK_URL", "https://discord.com/api/webhooks/123/abc")
    monkeypatch.delenv("ALERT_SNS_TOPIC_ARN", raising=False)

    sent_payloads: list[dict] = []

    class _FakeResp:
        status = 204

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

    def _fake_urlopen(req, timeout=5):
        sent_payloads.append(json.loads(req.data.decode("utf-8")))
        return _FakeResp()

    monkeypatch.setattr("app.notifications.urllib.request.urlopen", _fake_urlopen)

    created = client.post("/api/devices", json={"hostname": "notify-box", "type": "vm"}).json()
    device_id = created["device"]["id"]
    key = created["agentKey"]

    # Warning threshold -> no notification
    client.post(
        "/api/agent/metrics",
        json={"cpu": 75.0, "memory": 20.0, "storage": 30.0},
        headers={"X-Agent-Key": key},
    )
    assert len(sent_payloads) == 0

    # Escalation to critical -> 1 notification
    client.post(
        "/api/agent/metrics",
        json={"cpu": 95.0, "memory": 20.0, "storage": 30.0},
        headers={"X-Agent-Key": key},
    )
    assert len(sent_payloads) == 1
    assert "[CRITICAL] notify-box" in sent_payloads[0]["content"]

    # Repeat critical report -> deduplicated (no spam)
    client.post(
        "/api/agent/metrics",
        json={"cpu": 96.0, "memory": 20.0, "storage": 30.0},
        headers={"X-Agent-Key": key},
    )
    assert len(sent_payloads) == 1

    # Recovery -> still 1 notification
    client.post(
        "/api/agent/metrics",
        json={"cpu": 20.0, "memory": 20.0, "storage": 30.0},
        headers={"X-Agent-Key": key},
    )
    assert len(sent_payloads) == 1

    # Device goes offline > 3 min -> new critical alert triggers 2nd notification
    db = get_session_factory()()
    try:
        dev = db.get(DeviceModel, device_id)
        assert dev is not None
        dev.last_seen = datetime.now(timezone.utc) - timedelta(minutes=5)
        db.commit()
    finally:
        db.close()

    client.get("/api/alerts")
    assert len(sent_payloads) == 2
    assert "notify-box is offline" in sent_payloads[1]["content"]


def test_sns_notification_on_new_critical_alert(monkeypatch, as_admin):
    monkeypatch.delenv("ALERT_WEBHOOK_URL", raising=False)
    topic = "arn:aws:sns:us-east-2:123456789012:cloudops-alerts"
    monkeypatch.setenv("ALERT_SNS_TOPIC_ARN", topic)

    mock_sns = MagicMock()
    monkeypatch.setattr("app.notifications.boto3.client", lambda svc: mock_sns)

    created = client.post("/api/devices", json={"hostname": "sns-box", "type": "nas"}).json()
    key = created["agentKey"]

    resp = client.post(
        "/api/agent/metrics",
        json={"cpu": 10.0, "memory": 20.0, "storage": 95.0},
        headers={"X-Agent-Key": key},
    )
    assert resp.status_code == 204
    mock_sns.publish.assert_called_once()
    kwargs = mock_sns.publish.call_args.kwargs
    assert kwargs["TopicArn"] == topic
    assert "sns-box" in kwargs["Subject"]
    assert "storage exceeds 90%" in kwargs["Message"]


def test_notification_network_error_does_not_break_ingestion(monkeypatch, as_admin):
    monkeypatch.setenv("ALERT_WEBHOOK_URL", "https://discord.com/api/webhooks/123/abc")
    monkeypatch.delenv("ALERT_SNS_TOPIC_ARN", raising=False)

    def _fail_urlopen(*_args, **_kwargs):
        raise urllib.error.URLError("timeout")

    monkeypatch.setattr("app.notifications.urllib.request.urlopen", _fail_urlopen)

    created = client.post("/api/devices", json={"hostname": "resilient-box", "type": "vm"}).json()
    resp = client.post(
        "/api/agent/metrics",
        json={"cpu": 10.0, "memory": 20.0, "storage": 95.0},
        headers={"X-Agent-Key": created["agentKey"]},
    )
    assert resp.status_code == 204
    active = [a for a in client.get("/api/alerts").json() if a["deviceId"] == created["device"]["id"]]
    assert len(active) == 1
