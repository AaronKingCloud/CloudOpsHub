"""List endpoints for devices, alerts, accounts and metrics."""

from fastapi import APIRouter

from app.mock_data import ACCOUNTS, ALERTS, CPU_METRICS, DEVICES, MEMORY_METRICS, STORAGE_METRICS
from app.schemas import Account, Alert, Device, MetricPoint

router = APIRouter()


@router.get("/devices", response_model=list[Device], tags=["devices"])
def list_devices() -> list[Device]:
    return DEVICES


@router.get("/alerts", response_model=list[Alert], tags=["alerts"])
def list_alerts() -> list[Alert]:
    return ALERTS


@router.get("/accounts", response_model=list[Account], tags=["accounts"])
def list_accounts() -> list[Account]:
    return ACCOUNTS


@router.get("/metrics/cpu", response_model=list[MetricPoint], tags=["metrics"])
def get_cpu_metrics() -> list[MetricPoint]:
    return CPU_METRICS


@router.get("/metrics/memory", response_model=list[MetricPoint], tags=["metrics"])
def get_memory_metrics() -> list[MetricPoint]:
    return MEMORY_METRICS


@router.get("/metrics/storage", response_model=list[MetricPoint], tags=["metrics"])
def get_storage_metrics() -> list[MetricPoint]:
    return STORAGE_METRICS
