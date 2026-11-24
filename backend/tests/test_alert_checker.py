"""Tests for the background offline check."""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app import alert_checker
from app.database import get_session_factory
from app.main import app
from app.models import AlertModel, DeviceModel


@pytest.fixture
def sent(monkeypatch):
    calls: list[tuple] = []
    monkeypatch.setattr("app.alert_engine.notify_critical_alert", lambda *args: calls.append(args))
    return calls


def _stop_reporting(hostname: str) -> None:
    with get_session_factory()() as db:
        device = db.scalar(select(DeviceModel).where(DeviceModel.hostname == hostname))
        device.last_seen = datetime.now(timezone.utc) - timedelta(minutes=10)
        db.commit()


def _offline_alerts(hostname: str) -> list[AlertModel]:
    with get_session_factory()() as db:
        return list(db.scalars(
            select(AlertModel).join(DeviceModel).where(
                DeviceModel.hostname == hostname, AlertModel.rule == "offline"
            )
        ))


def test_silent_device_is_alerted_once_without_any_request(sent):
    _stop_reporting("pihole")
    alert_checker.check_once()
    alert_checker.check_once()

    assert [a.status for a in _offline_alerts("pihole")] == ["open"]
    assert sent == [("pihole", "pihole is offline", "offline")]


def test_reporting_device_is_not_alerted(sent):
    alert_checker.check_once()
    assert sent == []


def test_alert_resolves_when_the_device_reports_again(sent):
    _stop_reporting("pihole")
    alert_checker.check_once()
    with get_session_factory()() as db:
        device = db.scalar(select(DeviceModel).where(DeviceModel.hostname == "pihole"))
        device.last_seen = datetime.now(timezone.utc)
        db.commit()
    alert_checker.check_once()

    assert [a.status for a in _offline_alerts("pihole")] == ["resolved"]


def test_a_failed_check_does_not_stop_the_loop(monkeypatch):
    runs: list[int] = []

    def flaky() -> None:
        runs.append(1)
        if len(runs) == 1:
            raise RuntimeError("database is locked")

    monkeypatch.setattr(alert_checker, "check_once", flaky)
    monkeypatch.setattr(alert_checker, "check_interval_seconds", lambda: 0.01)

    async def run_briefly() -> None:
        task = asyncio.create_task(alert_checker.run_alert_checker(grace_seconds=0))
        for _ in range(200):
            if len(runs) >= 2:
                break
            await asyncio.sleep(0.01)
        assert not task.done()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(run_briefly())
    assert len(runs) >= 2


@pytest.mark.parametrize(("raw", "expected"), [("30", 30), ("0", 60), ("-5", 60), ("abc", 60)])
def test_check_interval(monkeypatch, raw, expected):
    monkeypatch.setenv("ALERT_CHECK_SECONDS", raw)
    assert alert_checker.check_interval_seconds() == expected


def test_app_starts_the_checker_and_stops_it_cleanly(monkeypatch, tmp_path):
    monkeypatch.setattr("app.auth.database.DB_PATH", str(tmp_path / "auth.db"))
    events: list[str] = []

    async def fake_checker() -> None:
        events.append("started")
        try:
            await asyncio.Event().wait()
        finally:
            events.append("stopped")

    monkeypatch.setattr("app.main.run_alert_checker", fake_checker)
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
    assert events == ["started", "stopped"]
