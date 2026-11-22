"""Tests for the SQLAlchemy database layer (persistence, queries, cascades)."""

from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.database import configure_database, get_engine, get_session_factory, init_app_db
from app.main import app
from app.models import AlertModel, DeviceModel, MetricModel

client = TestClient(app)


def test_data_survives_restart(tmp_path):
    """Data written to the database remains available after re-configuring the engine."""
    db_url = f"sqlite:///{tmp_path / 'persist.db'}"
    configure_database(db_url)
    init_app_db()

    now = datetime.now(timezone.utc)
    db = get_session_factory()()
    try:
        dev = DeviceModel(
            hostname="web-edge",
            type="vm",
            status="online",
            cpu=42.0,
            memory=55.0,
            storage=30.0,
            last_seen=now,
        )
        db.add(dev)
        db.flush()
        db.add(
            AlertModel(
                device_id=dev.id,
                severity="warning",
                message="web-edge cpu spike",
                status="open",
                created_at=now,
            )
        )
        db.commit()
    finally:
        db.close()

    # Simulate an application restart pointing at the same database file
    configure_database(db_url)
    init_app_db()

    devices = client.get("/api/devices").json()
    alerts = client.get("/api/alerts").json()
    summary = client.get("/api/dashboard/summary").json()

    assert len(devices) == 1
    assert devices[0]["hostname"] == "web-edge"
    assert len(alerts) == 1
    assert alerts[0]["message"] == "web-edge cpu spike"
    assert summary == {
        "onlineDevices": 1,
        "offlineDevices": 0,
        "activeAlerts": 1,
        "totalDevices": 1,
    }
    get_engine().dispose()


def test_overview_metrics_average_online_devices_in_5min_buckets(tmp_path):
    """Overview metrics average across online devices per 5-minute bucket and ignore offline."""
    configure_database(f"sqlite:///{tmp_path / 'buckets.db'}")
    init_app_db()

    db = get_session_factory()()
    try:
        on1 = DeviceModel(hostname="on-1", status="online", cpu=10, memory=20, storage=30)
        on2 = DeviceModel(hostname="on-2", status="online", cpu=30, memory=60, storage=50)
        off = DeviceModel(hostname="off-1", status="offline", cpu=0, memory=0, storage=90)
        db.add_all([on1, on2, off])
        db.flush()

        # Bucket 10:00 (10:01 and 10:03) + offline device at 10:02 (must be excluded)
        db.add_all(
            [
                MetricModel(
                    device_id=on1.id,
                    timestamp=datetime(2026, 11, 21, 10, 1, tzinfo=timezone.utc),
                    cpu=10.0,
                    memory=20.0,
                    storage=30.0,
                ),
                MetricModel(
                    device_id=on2.id,
                    timestamp=datetime(2026, 11, 21, 10, 3, tzinfo=timezone.utc),
                    cpu=30.0,
                    memory=60.0,
                    storage=50.0,
                ),
                MetricModel(
                    device_id=off.id,
                    timestamp=datetime(2026, 11, 21, 10, 2, tzinfo=timezone.utc),
                    cpu=99.0,
                    memory=99.0,
                    storage=99.0,
                ),
                MetricModel(
                    device_id=on1.id,
                    timestamp=datetime(2026, 11, 21, 10, 6, tzinfo=timezone.utc),
                    cpu=50.0,
                    memory=40.0,
                    storage=70.0,
                ),
            ]
        )
        db.commit()
    finally:
        db.close()

    cpu = client.get("/api/metrics/cpu").json()
    mem = client.get("/api/metrics/memory").json()
    disk = client.get("/api/metrics/storage").json()

    assert cpu == [
        {"timestamp": "10:00", "value": 20.0},
        {"timestamp": "10:05", "value": 50.0},
    ]
    assert mem == [
        {"timestamp": "10:00", "value": 40.0},
        {"timestamp": "10:05", "value": 40.0},
    ]
    assert disk == [
        {"timestamp": "10:00", "value": 40.0},
        {"timestamp": "10:05", "value": 70.0},
    ]
    get_engine().dispose()


def test_resolved_alerts_excluded_from_active_and_summary(tmp_path):
    configure_database(f"sqlite:///{tmp_path / 'alerts.db'}")
    init_app_db()

    now = datetime.now(timezone.utc)
    db = get_session_factory()()
    try:
        dev = DeviceModel(hostname="node-a", status="online", cpu=10, memory=10, storage=10)
        db.add(dev)
        db.flush()
        db.add_all(
            [
                AlertModel(device_id=dev.id, severity="critical", message="open alert", status="open", created_at=now),
                AlertModel(
                    device_id=dev.id,
                    severity="warning",
                    message="ack alert",
                    status="acknowledged",
                    acknowledged_by="operator",
                    created_at=now,
                ),
                AlertModel(
                    device_id=dev.id,
                    severity="info",
                    message="resolved alert",
                    status="resolved",
                    created_at=now,
                    resolved_at=now,
                ),
            ]
        )
        db.commit()
    finally:
        db.close()

    alerts = client.get("/api/alerts").json()
    summary = client.get("/api/dashboard/summary").json()

    assert [a["message"] for a in alerts] == ["open alert", "ack alert"]
    assert summary["activeAlerts"] == 2
    get_engine().dispose()


def test_empty_database_returns_empty_lists_and_zero_counts(tmp_path):
    configure_database(f"sqlite:///{tmp_path / 'empty.db'}")
    init_app_db()

    assert client.get("/api/devices").json() == []
    assert client.get("/api/alerts").json() == []
    assert client.get("/api/metrics/cpu").json() == []
    assert client.get("/api/metrics/memory").json() == []
    assert client.get("/api/metrics/storage").json() == []
    assert client.get("/api/dashboard/summary").json() == {
        "onlineDevices": 0,
        "offlineDevices": 0,
        "activeAlerts": 0,
        "totalDevices": 0,
    }
    get_engine().dispose()


def test_delete_device_cascades_metrics_and_alerts(tmp_path):
    configure_database(f"sqlite:///{tmp_path / 'cascade.db'}")
    init_app_db()

    now = datetime.now(timezone.utc)
    db = get_session_factory()()
    try:
        dev = DeviceModel(hostname="temp-node", status="online", cpu=10, memory=10, storage=10)
        db.add(dev)
        db.flush()
        db.add(MetricModel(device_id=dev.id, timestamp=now, cpu=10, memory=10, storage=10))
        db.add(AlertModel(device_id=dev.id, severity="warning", message="temp", status="open", created_at=now))
        db.commit()

        db.delete(dev)
        db.commit()

        assert db.scalar(select(func.count()).select_from(DeviceModel)) == 0
        assert db.scalar(select(func.count()).select_from(MetricModel)) == 0
        assert db.scalar(select(func.count()).select_from(AlertModel)) == 0
    finally:
        db.close()
        get_engine().dispose()
