"""List endpoints for accounts and overview metrics."""

from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.device_status import is_device_online
from app.mock_data import ACCOUNTS
from app.models import DeviceModel, MetricModel
from app.schemas import Account, MetricPoint

router = APIRouter()


def _overview_metrics(db: Session, field: str) -> list[MetricPoint]:
    """Average a metric across all online devices grouped into 5-minute buckets."""
    now = datetime.now(timezone.utc)
    devices = db.scalars(select(DeviceModel)).all()
    online_ids = [d.id for d in devices if is_device_online(d, now)]
    if not online_ids:
        return []

    metric_col = getattr(MetricModel, field)
    rows = db.execute(
        select(MetricModel.timestamp, metric_col)
        .where(MetricModel.device_id.in_(online_ids))
        .order_by(MetricModel.timestamp.asc())
    ).all()

    buckets: dict[datetime, list[float]] = defaultdict(list)
    for ts, value in rows:
        bucket = ts.replace(minute=(ts.minute // 5) * 5, second=0, microsecond=0)
        buckets[bucket].append(float(value))

    return [
        MetricPoint(
            timestamp=bucket.strftime("%H:%M"),
            value=round(sum(values) / len(values), 1),
        )
        for bucket, values in sorted(buckets.items())
    ]


@router.get("/accounts", response_model=list[Account], tags=["accounts"])
def list_accounts() -> list[Account]:
    return ACCOUNTS


@router.get("/metrics/cpu", response_model=list[MetricPoint], tags=["metrics"])
def get_cpu_metrics(db: Session = Depends(get_db)) -> list[MetricPoint]:
    return _overview_metrics(db, "cpu")


@router.get("/metrics/memory", response_model=list[MetricPoint], tags=["metrics"])
def get_memory_metrics(db: Session = Depends(get_db)) -> list[MetricPoint]:
    return _overview_metrics(db, "memory")


@router.get("/metrics/storage", response_model=list[MetricPoint], tags=["metrics"])
def get_storage_metrics(db: Session = Depends(get_db)) -> list[MetricPoint]:
    return _overview_metrics(db, "storage")
