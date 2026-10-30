"""Seed the database with default users for development and demo.

Usage (from the backend/ directory):
    python -m seed

Default credentials:
    admin    / Admin123!
    operator / Operator123!
    viewer   / Viewer123!
"""

import uuid
from datetime import datetime, timezone

from app.auth.database import init_db, get_db
from app.auth.utils import hash_password

SEED_USERS = [
    {"username": "admin",    "email": "admin@cloudopshub.local",    "password": "Admin123!",    "role": "admin"},
    {"username": "operator", "email": "operator@cloudopshub.local", "password": "Operator123!", "role": "operator"},
    {"username": "viewer",   "email": "viewer@cloudopshub.local",   "password": "Viewer123!",   "role": "viewer"},
]


def seed() -> None:
    print("Initialising auth database…")
    init_db()

    now = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        for u in SEED_USERS:
            exists = conn.execute(
                "SELECT id FROM users WHERE username = ?", (u["username"],)
            ).fetchone()
            if exists:
                print(f"  ⏭  '{u['username']}' already exists — skipping")
                continue

            conn.execute(
                """INSERT INTO users
                   (id, username, email, hashed_password, role, is_active, created_at)
                   VALUES (?, ?, ?, ?, ?, 1, ?)""",
                (str(uuid.uuid4()), u["username"], u["email"],
                 hash_password(u["password"]), u["role"], now),
            )
            print(f"  ✅ Created '{u['username']}' ({u['role']})")

    print("\nDefault credentials:")
    for u in SEED_USERS:
        print(f"  {u['role']:>10}  →  {u['username']} / {u['password']}")


if __name__ == "__main__":
    seed()

