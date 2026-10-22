"""Checks that every endpoint responds and matches the API contract shapes."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_dashboard_summary_is_consistent():
    summary = client.get("/api/dashboard/summary").json()
    assert set(summary) == {"onlineDevices", "offlineDevices", "activeAlerts", "totalDevices"}
    assert summary["onlineDevices"] + summary["offlineDevices"] == summary["totalDevices"]
    assert summary["totalDevices"] == len(client.get("/api/devices").json())
    assert summary["activeAlerts"] == len(client.get("/api/alerts").json())


def test_devices_shape():
    devices = client.get("/api/devices").json()
    assert devices
    assert set(devices[0]) == {"id", "hostname", "status", "cpu", "memory", "storage"}


def test_cpu_metrics_shape():
    points = client.get("/api/metrics/cpu").json()
    assert points
    assert set(points[0]) == {"timestamp", "value"}


def test_alerts_shape():
    alerts = client.get("/api/alerts").json()
    assert alerts
    assert set(alerts[0]) == {"id", "severity", "message"}


def test_accounts_use_camel_case():
    accounts = client.get("/api/accounts").json()
    assert accounts
    assert set(accounts[0]) == {
        "id", "provider", "accountName", "status", "alertCount", "lastUpdated",
    }


def test_cors_allows_frontend_dev_server():
    response = client.get("/api/devices", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
