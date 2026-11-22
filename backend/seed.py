"""Seed the databases with default users and sample infrastructure data.

Usage (from the backend/ directory):
    python -m seed

Default credentials:
    admin    / Admin123!
    operator / Operator123!
    viewer   / Viewer123!
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select

from app.auth.database import get_db as get_auth_db
from app.auth.database import init_db as init_auth_db
from app.auth.utils import hash_password
from app.database import get_session_factory, init_app_db
from app.models import AlertModel, DeviceModel, MetricModel

SEED_USERS = [
    {"username": "admin",    "email": "admin@cloudopshub.local",    "password": "Admin123!",    "role": "admin"},
    {"username": "operator", "email": "operator@cloudopshub.local", "password": "Operator123!", "role": "operator"},
    {"username": "viewer",   "email": "viewer@cloudopshub.local",   "password": "Viewer123!",   "role": "viewer"},
]


def seed_users() -> None:
    """Create the default demo users if they do not already exist."""
    print("Initialising auth database...")
    init_auth_db()

    now = datetime.now(timezone.utc).isoformat()

    with get_auth_db() as conn:
        for u in SEED_USERS:
            exists = conn.execute(
                "SELECT id FROM users WHERE username = ?", (u["username"],)
            ).fetchone()
            if exists:
                print(f"  [skip] '{u['username']}' already exists - skipping")
                continue

            conn.execute(
                """INSERT INTO users
                   (id, username, email, hashed_password, role, is_active, created_at)
                   VALUES (?, ?, ?, ?, ?, 1, ?)""",
                (str(uuid.uuid4()), u["username"], u["email"],
                 hash_password(u["password"]), u["role"], now),
            )
            print(f"  [ok]   Created '{u['username']}' ({u['role']})")


def seed_app_data() -> None:
    """Populate sample devices, metric history, and alerts if empty."""
    print("Initialising application database...")
    init_app_db()

    now = datetime.now(timezone.utc)
    db = get_session_factory()()
    try:
        existing = db.scalar(select(func.count()).select_from(DeviceModel)) or 0
        if existing > 0:
            print(f"  [skip] App database already has {existing} device(s) - skipping")
            return

        sample_devices = [
            DeviceModel(
                hostname="plex-server",
                type="server",
                ip_address="192.168.1.20",
                description="Media server",
                status="online",
                cpu=25.0,
                memory=48.0,
                storage=62.0,
                last_seen=now,
            ),
            DeviceModel(
                hostname="nas-01",
                type="nas",
                ip_address="192.168.1.30",
                description="Synology NAS, backups and media",
                status="online",
                cpu=12.0,
                memory=35.0,
                storage=91.0,
                last_seen=now,
            ),
            DeviceModel(
                hostname="proxmox-host",
                type="server",
                ip_address="192.168.1.10",
                description="Hypervisor node",
                status="online",
                cpu=68.0,
                memory=74.0,
                storage=40.0,
                last_seen=now,
            ),
            DeviceModel(
                hostname="pihole",
                type="service",
                ip_address="192.168.1.2",
                description="DNS and ad blocker",
                status="online",
                cpu=5.0,
                memory=22.0,
                storage=18.0,
                last_seen=now,
            ),
            DeviceModel(
                hostname="backup-vm",
                type="vm",
                ip_address="192.168.1.45",
                description="Offsite backup target",
                status="offline",
                cpu=0.0,
                memory=0.0,
                storage=77.0,
                last_seen=None,
            ),
        ]
        db.add_all(sample_devices)
        db.flush()

        by_host = {d.hostname: d for d in sample_devices}

        # 6 five-minute buckets whose averages across online devices equal the overview curves
        buckets = [
            (datetime(2026, 10, 15, 10, 0, tzinfo=timezone.utc), 20.0, 41.0, 56.0),
            (datetime(2026, 10, 15, 10, 5, tzinfo=timezone.utc), 35.0, 44.0, 56.0),
            (datetime(2026, 10, 15, 10, 10, tzinfo=timezone.utc), 50.0, 49.0, 57.0),
            (datetime(2026, 10, 15, 10, 15, tzinfo=timezone.utc), 42.0, 47.0, 58.0),
            (datetime(2026, 10, 15, 10, 20, tzinfo=timezone.utc), 65.0, 53.0, 58.0),
            (datetime(2026, 10, 15, 10, 25, tzinfo=timezone.utc), 58.0, 51.0, 59.0),
        ]
        offsets = {
            "plex-server": (-5.0, -2.0, 4.0),
            "nas-01": (-10.0, -8.0, 32.0),
            "proxmox-host": (25.0, 20.0, -16.0),
            "pihole": (-10.0, -10.0, -20.0),
        }

        for host, (cpu_off, mem_off, disk_off) in offsets.items():
            dev_id = by_host[host].id
            for ts, cpu_avg, mem_avg, disk_avg in buckets:
                db.add(
                    MetricModel(
                        device_id=dev_id,
                        timestamp=ts,
                        cpu=max(0.0, min(100.0, cpu_avg + cpu_off)),
                        memory=max(0.0, min(100.0, mem_avg + mem_off)),
                        storage=max(0.0, min(100.0, disk_avg + disk_off)),
                    )
                )

        db.add_all(
            [
                AlertModel(
                    device_id=by_host["nas-01"].id,
                    severity="critical",
                    message="nas-01 storage exceeds 90%",
                    status="open",
                    created_at=now,
                ),
                AlertModel(
                    device_id=by_host["backup-vm"].id,
                    severity="critical",
                    message="backup-vm is offline",
                    status="open",
                    created_at=now,
                ),
                AlertModel(
                    device_id=by_host["proxmox-host"].id,
                    severity="warning",
                    message="proxmox-host memory above 70%",
                    status="open",
                    created_at=now,
                ),
            ]
        )
        db.commit()
        print(f"  [ok]   Seeded {len(sample_devices)} devices, metric history, and 3 alerts")
    finally:
        db.close()


def seed() -> None:
    seed_users()
    seed_app_data()

    print("\nDefault credentials:")
    for u in SEED_USERS:
        print(f"  {u['role']:>10}  ->  {u['username']} / {u['password']}")


if __name__ == "__main__":
    seed()
