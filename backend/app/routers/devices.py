"""Device / asset management endpoints, agent key rotation, and per-device metrics."""

import hashlib
import secrets
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import DeviceModel, MetricModel
from app.schemas import (
    AgentKeyResponse,
    Device,
    DeviceCreateResponse,
    DeviceInput,
    MetricPoint,
)

router = APIRouter(prefix="/devices", tags=["devices"])


def hash_agent_key(plain_key: str) -> str:
    """Return the SHA-256 hex digest of a device agent key."""
    return hashlib.sha256(plain_key.encode("utf-8")).hexdigest()


def generate_agent_key() -> tuple[str, str]:
    """Generate a new ``coa_...`` agent key and its SHA-256 hash."""
    plain = "coa_" + secrets.token_hex(16)
    return plain, hash_agent_key(plain)


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _serialize_device(d: DeviceModel) -> Device:
    return Device(
        id=d.id,
        hostname=d.hostname,
        status=d.status,
        cpu=round(d.cpu),
        memory=round(d.memory),
        storage=round(d.storage),
        type=d.type,
        ip_address=d.ip_address,
        description=d.description,
        last_seen=_to_utc(d.last_seen).isoformat() if d.last_seen is not None else None,
    )


def _get_device_or_404(db: Session, device_id: int) -> DeviceModel:
    device = db.get(DeviceModel, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


@router.get("", response_model=list[Device])
def list_devices(db: Session = Depends(get_db)) -> list[Device]:
    rows = db.scalars(select(DeviceModel).order_by(DeviceModel.id)).all()
    return [_serialize_device(d) for d in rows]


@router.get("/{device_id}", response_model=Device)
def get_device(
    device_id: int,
    _user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Device:
    return _serialize_device(_get_device_or_404(db, device_id))


@router.post("", response_model=DeviceCreateResponse, status_code=status.HTTP_201_CREATED)
def create_device(
    body: DeviceInput,
    _admin=Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> DeviceCreateResponse:
    duplicate = db.scalar(
        select(DeviceModel.id).where(func.lower(DeviceModel.hostname) == body.hostname.lower())
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A device with this hostname already exists",
        )

    plain_key, key_hash = generate_agent_key()
    device = DeviceModel(
        hostname=body.hostname,
        type=body.type,
        ip_address=body.ip_address,
        description=body.description,
        status="offline",
        cpu=0.0,
        memory=0.0,
        storage=0.0,
        last_seen=None,
        agent_key_hash=key_hash,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return DeviceCreateResponse(device=_serialize_device(device), agent_key=plain_key)


@router.put("/{device_id}", response_model=Device)
def update_device(
    device_id: int,
    body: DeviceInput,
    _admin=Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> Device:
    device = _get_device_or_404(db, device_id)

    duplicate = db.scalar(
        select(DeviceModel.id).where(
            func.lower(DeviceModel.hostname) == body.hostname.lower(),
            DeviceModel.id != device_id,
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A device with this hostname already exists",
        )

    device.hostname = body.hostname
    device.type = body.type
    device.ip_address = body.ip_address
    device.description = body.description
    db.commit()
    db.refresh(device)
    return _serialize_device(device)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    device_id: int,
    _admin=Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> Response:
    device = _get_device_or_404(db, device_id)
    db.delete(device)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{device_id}/agent-key", response_model=AgentKeyResponse)
def rotate_agent_key(
    device_id: int,
    _admin=Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> AgentKeyResponse:
    device = _get_device_or_404(db, device_id)
    plain_key, key_hash = generate_agent_key()
    device.agent_key_hash = key_hash
    db.commit()
    return AgentKeyResponse(agent_key=plain_key)


@router.get("/{device_id}/metrics", response_model=list[MetricPoint])
def get_device_metrics(
    device_id: int,
    metric: Literal["cpu", "memory", "storage"] = Query("cpu"),
    hours: int = Query(24, ge=1, le=168),
    _user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MetricPoint]:
    _get_device_or_404(db, device_id)

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    metric_col = getattr(MetricModel, metric)
    rows = db.execute(
        select(MetricModel.timestamp, metric_col)
        .where(MetricModel.device_id == device_id)
        .order_by(MetricModel.timestamp.asc())
    ).all()

    buckets: dict[datetime, list[float]] = defaultdict(list)
    use_hourly = hours > 24

    for raw_ts, value in rows:
        ts = _to_utc(raw_ts)
        if ts < cutoff:
            continue
        if use_hourly:
            bucket = ts.replace(minute=0, second=0, microsecond=0)
        else:
            bucket = ts.replace(minute=(ts.minute // 5) * 5, second=0, microsecond=0)
        buckets[bucket].append(float(value))

    points: list[MetricPoint] = []
    for bucket, values in sorted(buckets.items()):
        label = (
            f"{bucket.day} {bucket.strftime('%b %H:%M')}"
            if use_hourly
            else bucket.strftime("%H:%M")
        )
        points.append(MetricPoint(timestamp=label, value=round(sum(values) / len(values), 1)))
    return points
