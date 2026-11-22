"""List endpoints for devices, alerts, accounts and metrics."""

from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.mock_data import ACCOUNTS
from app.models import AlertModel, DeviceModel, MetricModel
from app.schemas import Account, Alert, Device, MetricPoint

router = APIRouter()


def _overview_metrics(db: Session, field: str) -> list[MetricPoint]:
    """Average a metric across all online devices grouped into 5-minute buckets."""
    metric_col = getattr(MetricModel, field)
    rows = db.execute(
        select(MetricModel.timestamp, metric_col)
        .join(DeviceModel, MetricModel.device_id == DeviceModel.id)
        .where(DeviceModel.status == "online")
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


@router.get("/devices", response_model=list[Device], tags=["devices"])
def list_devices(db: Session = Depends(get_db)) -> list[Device]:
    rows = db.scalars(select(DeviceModel).order_by(DeviceModel.id)).all()
    return [
        Device(
            id=d.id,
            hostname=d.hostname,
            status=d.status,
            cpu=round(d.cpu),
            memory=round(d.memory),
            storage=round(d.storage),
        )
        for d in rows
    ]


@router.get("/alerts", response_model=list[Alert], tags=["alerts"])
def list_alerts(db: Session = Depends(get_db)) -> list[Alert]:
    rows = db.scalars(
        select(AlertModel)
        .where(AlertModel.status != "resolved")
        .order_by(AlertModel.id)
    ).all()
    return [
        Alert(id=a.id, severity=a.severity, message=a.message)
        for a in rows
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
