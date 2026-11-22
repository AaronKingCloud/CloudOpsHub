"""Metrics ingestion endpoint for the CloudOps Hub device agent."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DeviceModel, MetricModel
from app.routers.devices import hash_agent_key
from app.schemas import AgentMetricReport

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/metrics", status_code=status.HTTP_204_NO_CONTENT)
def ingest_agent_metrics(
    body: AgentMetricReport,
    x_agent_key: str | None = Header(default=None, alias="X-Agent-Key"),
    db: Session = Depends(get_db),
) -> Response:
    """Accept CPU, memory, disk, and uptime from a device agent using its X-Agent-Key."""
    if not x_agent_key or not x_agent_key.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Agent-Key header",
        )

    key_hash = hash_agent_key(x_agent_key.strip())
    device = db.scalar(select(DeviceModel).where(DeviceModel.agent_key_hash == key_hash))
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid agent key",
        )

    now = datetime.now(timezone.utc)
    device.status = "online"
    device.cpu = float(body.cpu)
    device.memory = float(body.memory)
    device.storage = float(body.storage)
    device.last_seen = now

    db.add(
        MetricModel(
            device_id=device.id,
            timestamp=now,
            cpu=float(body.cpu),
            memory=float(body.memory),
            storage=float(body.storage),
        )
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
