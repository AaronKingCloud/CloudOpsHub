from fastapi import APIRouter

from app.mock_data import ALERTS, DEVICES
from app.schemas import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary() -> DashboardSummary:
    online = sum(1 for d in DEVICES if d.status == "online")
    return DashboardSummary(
        online_devices=online,
        offline_devices=len(DEVICES) - online,
        active_alerts=len(ALERTS),
        total_devices=len(DEVICES),
    )
