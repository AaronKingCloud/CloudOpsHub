from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AlertModel, DeviceModel
from app.schemas import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: Session = Depends(get_db)) -> DashboardSummary:
    total = db.scalar(select(func.count()).select_from(DeviceModel)) or 0
    online = (
        db.scalar(
            select(func.count())
            .select_from(DeviceModel)
            .where(DeviceModel.status == "online")
        )
        or 0
    )
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
