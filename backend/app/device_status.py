"""Shared helper for computing device online/offline status.

A device is considered offline if its last agent report (``last_seen``) is older
than ``AGENT_OFFLINE_SECONDS`` (default 180 seconds = 3 missed 60s reports).
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Literal

from app.models import DeviceModel

DEFAULT_OFFLINE_SECONDS = 180


def offline_threshold_seconds() -> int:
    raw = os.getenv("AGENT_OFFLINE_SECONDS", str(DEFAULT_OFFLINE_SECONDS))
    try:
        value = int(raw)
        return value if value > 0 else DEFAULT_OFFLINE_SECONDS
    except ValueError:
        return DEFAULT_OFFLINE_SECONDS


def to_utc(dt: datetime) -> datetime:
    """Ensure a datetime from SQLite/Postgres is timezone-aware in UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def is_device_online(device: DeviceModel, now: datetime | None = None) -> bool:
    """Return True if the device is online and its last report is within the timeout."""
    if device.status != "online":
        return False
    if device.last_seen is None:
        return True
    current = now if now is not None else datetime.now(timezone.utc)
    return (current - to_utc(device.last_seen)) <= timedelta(seconds=offline_threshold_seconds())


def effective_device_status(
    device: DeviceModel, now: datetime | None = None
) -> Literal["online", "offline"]:
    return "online" if is_device_online(device, now) else "offline"
