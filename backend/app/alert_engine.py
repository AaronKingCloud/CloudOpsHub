"""Automatic alert rules evaluation and deduplication.

Rules match the dashboard usage thresholds in ``frontend/src/utils/status.ts``:
- offline: device has reported at least once (last_seen != None) and timed out -> critical
- storage: >= 90% -> critical
- cpu: >= 90% -> critical, >= 70% -> warning
- memory: >= 90% -> critical, >= 70% -> warning

At most one active (open or acknowledged) alert is maintained per (device, rule).
When a condition clears, active alerts for that rule auto-resolve.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.device_status import is_device_online, to_utc
from app.models import AlertModel, DeviceModel
from app.notifications import notify_critical_alert


def _sync_rule_alert(
    db: Session,
    device: DeviceModel,
    rule: str,
    triggered: tuple[str, str] | None,
    now: datetime,
) -> bool:
    """Create, update, or auto-resolve the active alert for (device, rule)."""
    active = db.scalars(
        select(AlertModel)
        .where(
            AlertModel.device_id == device.id,
            AlertModel.rule == rule,
            AlertModel.status != "resolved",
        )
        .order_by(AlertModel.id)
    ).all()

    if triggered is not None:
        severity, message = triggered
        if active:
            existing = active[0]
            was_critical = existing.severity == "critical"
            changed = False
            if existing.severity != severity:
                existing.severity = severity
                changed = True
            if existing.message != message:
                existing.message = message
                changed = True
            if not was_critical and severity == "critical":
                notify_critical_alert(device.hostname, message, rule)
            return changed

        db.add(
            AlertModel(
                device_id=device.id,
                rule=rule,
                severity=severity,
                message=message,
                status="open",
                created_at=now,
            )
        )
        if severity == "critical":
            notify_critical_alert(device.hostname, message, rule)
        return True

    if not active:
        return False

    for alert in active:
        alert.status = "resolved"
        alert.resolved_at = now
    return True


def _threshold_trigger(
    hostname: str,
    label: str,
    value: float,
    warn_at: float | None = 70.0,
    crit_at: float = 90.0,
) -> tuple[str, str] | None:
    if value >= crit_at:
        return ("critical", f"{hostname} {label} exceeds 90%")
    if warn_at is not None and value >= warn_at:
        return ("warning", f"{hostname} {label} above 70%")
    return None


def evaluate_offline_alert(
    db: Session,
    device: DeviceModel,
    now: datetime | None = None,
) -> bool:
    """Evaluate only the time-based offline rule for a single device."""
    current = now if now is not None else datetime.now(timezone.utc)
    if is_device_online(device, current):
        return _sync_rule_alert(db, device, "offline", None, current)
    if device.last_seen is None:
        return False

    # Do not recreate an offline alert that an operator already resolved for this outage.
    active = db.scalar(
        select(AlertModel.id).where(
            AlertModel.device_id == device.id,
            AlertModel.rule == "offline",
            AlertModel.status != "resolved",
        )
    )
    if active is None:
        latest_resolved = db.scalar(
            select(AlertModel)
            .where(
                AlertModel.device_id == device.id,
                AlertModel.rule == "offline",
                AlertModel.status == "resolved",
            )
            .order_by(AlertModel.resolved_at.desc())
        )
        if (
            latest_resolved is not None
            and latest_resolved.resolved_at is not None
            and to_utc(latest_resolved.resolved_at) >= to_utc(device.last_seen)
        ):
            return False

    return _sync_rule_alert(
        db,
        device,
        "offline",
        ("critical", f"{device.hostname} is offline"),
        current,
    )


def evaluate_device_alerts(
    db: Session,
    device: DeviceModel,
    now: datetime | None = None,
) -> bool:
    """Evaluate offline and resource-threshold alert rules on an agent report."""
    current = now if now is not None else datetime.now(timezone.utc)
    changed = evaluate_offline_alert(db, device, current)

    changed |= _sync_rule_alert(
        db,
        device,
        "storage",
        _threshold_trigger(device.hostname, "storage", device.storage, warn_at=None, crit_at=90.0),
        current,
    )
    changed |= _sync_rule_alert(
        db,
        device,
        "cpu",
        _threshold_trigger(device.hostname, "CPU", device.cpu),
        current,
    )
    changed |= _sync_rule_alert(
        db,
        device,
        "memory",
        _threshold_trigger(device.hostname, "memory", device.memory),
        current,
    )

    return changed


def evaluate_all_devices(db: Session, now: datetime | None = None) -> bool:
    """Evaluate the time-based offline rule across all devices on read."""
    current = now if now is not None else datetime.now(timezone.utc)
    devices = db.scalars(select(DeviceModel).order_by(DeviceModel.id)).all()
    changed = False
    for device in devices:
        changed |= evaluate_offline_alert(db, device, current)
    if changed:
        db.commit()
    return changed
