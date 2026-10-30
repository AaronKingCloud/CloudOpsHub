"""SQLite database for user authentication.

Uses a lightweight SQLite file so there are no extra infrastructure
dependencies during development.  The path is configurable via the
``AUTH_DB_PATH`` environment variable (defaults to ``cloudopshub_auth.db``
in the working directory).
"""

import os
import sqlite3
from contextlib import contextmanager
from typing import Generator

DB_PATH = os.getenv("AUTH_DB_PATH", "cloudopshub_auth.db")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Yield a database connection that auto-commits on success."""
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create the ``users`` table if it does not already exist."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id              TEXT PRIMARY KEY,
                username        TEXT UNIQUE NOT NULL,
                email           TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                role            TEXT NOT NULL DEFAULT 'viewer',
                is_active       INTEGER NOT NULL DEFAULT 1,
                created_at      TEXT NOT NULL,
                last_login      TEXT
            )
        """)

