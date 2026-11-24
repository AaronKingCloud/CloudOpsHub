"""Background check for devices that stopped reporting.

The offline rule depends on time passing, not on a request, so it needs its own timer: without it,
an offline alert (and its notification) only appears when someone opens the dashboard.
"""

import asyncio
import logging
import os

from app.alert_engine import evaluate_all_devices
from app.database import get_session_factory

logger = logging.getLogger(__name__)

DEFAULT_CHECK_SECONDS = 60
# Agents report every minute. After a restart, give them time to report before calling them offline.
STARTUP_GRACE_SECONDS = 120


def check_interval_seconds() -> int:
    """Seconds between checks (``ALERT_CHECK_SECONDS``, default 60)."""
    try:
        value = int(os.getenv("ALERT_CHECK_SECONDS", str(DEFAULT_CHECK_SECONDS)))
    except ValueError:
        return DEFAULT_CHECK_SECONDS
    return value if value > 0 else DEFAULT_CHECK_SECONDS


def check_once() -> None:
    """Evaluate the offline rule for every device in its own database session."""
    db = get_session_factory()()
    try:
        evaluate_all_devices(db)
    finally:
        db.close()


async def run_alert_checker(grace_seconds: float = STARTUP_GRACE_SECONDS) -> None:
    """Check until cancelled. A failed check is logged and the next one still runs."""
    await asyncio.sleep(grace_seconds)
    while True:
        try:
            # In a thread: the database and notification calls block
            await asyncio.to_thread(check_once)
        except Exception:
            logger.exception("Background alert check failed")
        await asyncio.sleep(check_interval_seconds())
