"""Checks that every endpoint responds, requires login, and matches contract shapes."""

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserResponse
from app.main import app
from app.schemas import Account

client = TestClient(app)


@pytest.fixture
def logged_in():
    """Authenticate as a viewer for shape/header checks (auth itself is in test_auth.py)."""
    app.dependency_overrides[get_current_user] = lambda: UserResponse(
        id="user-viewer",
        username="viewer",
        email="viewer@test.local",
        role="viewer",
        is_active=True,
        created_at="2026-11-21T00:00:00+00:00",
    )
    yield
    app.dependency_overrides.clear()


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_all_data_endpoints_require_login():
    protected_paths = (
        "/api/dashboard/summary",
        "/api/devices",
        "/api/devices/1",
        "/api/devices/1/metrics",
        "/api/alerts",
        "/api/alerts?status=all",
        "/api/accounts",
        "/api/metrics/cpu",
        "/api/metrics/memory",
        "/api/metrics/storage",
        "/api/billing/summary",
        "/api/aws/account",
        "/api/aws/ec2",
        "/api/auth/me",
        "/api/auth/users",
    )
    for path in protected_paths:
        assert client.get(path).status_code == 401, f"Expected 401 for {path}"


def test_dashboard_summary_is_consistent(logged_in):
    summary = client.get("/api/dashboard/summary").json()
    assert set(summary) == {"onlineDevices", "offlineDevices", "activeAlerts", "totalDevices"}
    assert summary["onlineDevices"] + summary["offlineDevices"] == summary["totalDevices"]
    assert summary["totalDevices"] == len(client.get("/api/devices").json())
    assert summary["activeAlerts"] == len(client.get("/api/alerts").json())


def test_devices_shape(logged_in):
    devices = client.get("/api/devices").json()
    assert devices
    assert set(devices[0]) == {
        "id", "hostname", "status", "cpu", "memory", "storage",
        "type", "ipAddress", "description", "lastSeen",
    }


def test_cpu_metrics_shape(logged_in):
    points = client.get("/api/metrics/cpu").json()
    assert points
    assert set(points[0]) == {"timestamp", "value"}


def test_alerts_shape(logged_in):
    alerts = client.get("/api/alerts").json()
    assert alerts
    assert set(alerts[0]) == {
        "id", "severity", "message", "deviceId",
        "status", "createdAt", "acknowledgedBy", "resolvedAt",
    }


def test_accounts_use_camel_case(logged_in, monkeypatch):
    # No AWS calls in tests; the real data is covered in test_cloud_accounts.py
    sample = Account(
        id=1, provider="AWS", account_name="Main", status="Healthy", alert_count=0, last_updated="now"
    )
    monkeypatch.setattr("app.routers.resources.get_accounts", lambda: [sample])
    accounts = client.get("/api/accounts").json()
    assert accounts
    assert set(accounts[0]) == {
        "id", "provider", "accountName", "status", "alertCount", "lastUpdated",
    }


def test_cors_allows_frontend_dev_server(logged_in):
    response = client.get("/api/devices", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_security_headers_on_api_responses(logged_in):
    response = client.get("/api/devices")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"


def test_auth_responses_are_never_cached():
    response = client.get("/api/auth/me")  # 401 without a token, and still must not be cached
    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"
