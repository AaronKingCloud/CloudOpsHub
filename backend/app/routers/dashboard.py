from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.alert_engine import evaluate_all_devices
from app.database import get_db
from app.device_status import is_device_online
from app.models import AlertModel, DeviceModel
from app.schemas import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: Session = Depends(get_db)) -> DashboardSummary:
    now = datetime.now(timezone.utc)
    evaluate_all_devices(db, now)
    devices = db.scalars(select(DeviceModel)).all()
    online = sum(1 for d in devices if is_device_online(d, now))
    total = len(devices)
    active_alerts = (
        db.scalar(
            select(func.count())
            .select_from(AlertModel)
            .where(AlertModel.status != "resolved")
        )
        or 0
    )
    return DashboardSummary(
        online_devices=online,
        offline_devices=total - online,
        active_alerts=active_alerts,
        total_devices=total,
    )
