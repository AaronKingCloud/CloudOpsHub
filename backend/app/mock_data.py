"""Temporary in-memory data, kept in sync with frontend/src/mock/.

This will be replaced by a database / metrics collector later.
"""

from app.schemas import Account, Alert, Device, MetricPoint

DEVICES = [
    Device(id=1, hostname="plex-server", status="online", cpu=25, memory=48, storage=62),
    Device(id=2, hostname="nas-01", status="online", cpu=12, memory=35, storage=91),
    Device(id=3, hostname="proxmox-host", status="online", cpu=68, memory=74, storage=40),
    Device(id=4, hostname="pihole", status="online", cpu=5, memory=22, storage=18),
    Device(id=5, hostname="backup-vm", status="offline", cpu=0, memory=0, storage=77),
]

ALERTS = [
    Alert(id=1, severity="critical", message="nas-01 storage exceeds 90%"),
    Alert(id=2, severity="critical", message="backup-vm is offline"),
    Alert(id=3, severity="warning", message="proxmox-host memory above 70%"),
]

CPU_METRICS = [
    MetricPoint(timestamp="10:00", value=20),
    MetricPoint(timestamp="10:05", value=35),
    MetricPoint(timestamp="10:10", value=50),
    MetricPoint(timestamp="10:15", value=42),
    MetricPoint(timestamp="10:20", value=65),
    MetricPoint(timestamp="10:25", value=58),
]

ACCOUNTS = [
    Account(id=1, provider="AWS", account_name="AWS Production", status="Critical",
            alert_count=2, last_updated="2026-10-15 13:00"),
    Account(id=2, provider="AWS", account_name="AWS Sandbox", status="Healthy",
            alert_count=0, last_updated="2026-10-15 13:00"),
    Account(id=3, provider="Azure", account_name="Azure Development", status="Warning",
            alert_count=1, last_updated="2026-10-15 13:00"),
    Account(id=4, provider="Azure", account_name="Azure Production", status="Healthy",
            alert_count=0, last_updated="2026-10-15 13:00"),
]
