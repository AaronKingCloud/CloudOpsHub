"""Alert listing, acknowledge, and resolve endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.alert_engine import evaluate_all_devices
from app.auth.dependencies import require_role
from app.auth.schemas import UserResponse
from app.database import get_db
from app.device_status import to_utc
from app.models import AlertModel
from app.schemas import Alert

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _serialize_alert(a: AlertModel) -> Alert:
    return Alert(
        id=a.id,
        severity=a.severity,
        message=a.message,
        device_id=a.device_id,
        status=a.status,
        created_at=to_utc(a.created_at).isoformat() if a.created_at is not None else None,
        acknowledged_by=a.acknowledged_by,
        resolved_at=to_utc(a.resolved_at).isoformat() if a.resolved_at is not None else None,
    )


def _get_alert_or_404(db: Session, alert_id: int) -> AlertModel:
    alert = db.get(AlertModel, alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return alert


@router.get("", response_model=list[Alert])
def list_alerts(
    alert_status: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[Alert]:
    evaluate_all_devices(db)
    stmt = select(AlertModel).order_by(AlertModel.id)
    if alert_status != "all":
        stmt = stmt.where(AlertModel.status != "resolved")
    rows = db.scalars(stmt).all()
    return [_serialize_alert(a) for a in rows]


@router.post("/{alert_id}/acknowledge", response_model=Alert)
def acknowledge_alert(
    alert_id: int,
    user: UserResponse = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> Alert:
    alert = _get_alert_or_404(db, alert_id)
    if alert.status == "resolved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot acknowledge a resolved alert",
        )
    alert.status = "acknowledged"
    alert.acknowledged_by = user.username
    db.commit()
    db.refresh(alert)
    return _serialize_alert(alert)


@router.post("/{alert_id}/resolve", response_model=Alert)
def resolve_alert(
    alert_id: int,
    _user: UserResponse = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> Alert:
    alert = _get_alert_or_404(db, alert_id)
    if alert.status != "resolved":
        alert.status = "resolved"
        alert.resolved_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(alert)
    return _serialize_alert(alert)
