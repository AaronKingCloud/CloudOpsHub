"""Brute-force protection on POST /api/auth/login."""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import app.auth.database as db_module
from app.auth.database import get_db, init_db
from app.auth.rate_limit import LoginRateLimiter, login_limiter
from app.auth.utils import hash_password
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db(tmp_path, monkeypatch):
    monkeypatch.setattr(db_module, "DB_PATH", str(tmp_path / "test_auth.db"))
    init_db()
    with get_db() as conn:
        conn.execute(
            """INSERT INTO users (id, username, email, hashed_password, role, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, 1, ?)""",
            (str(uuid.uuid4()), "alice", "alice@test.local", hash_password("Correct123!"),
             "viewer", datetime.now(timezone.utc).isoformat()),
        )


def _login(password: str, username: str = "alice"):
    return client.post("/api/auth/login", json={"username": username, "password": password})


def test_locks_out_after_max_failed_attempts():
    for _ in range(login_limiter.max_attempts):
        assert _login("wrong").status_code == 401

    blocked = _login("wrong")
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0
    assert "Too many failed sign-in attempts" in blocked.json()["detail"]


def test_lockout_also_blocks_the_correct_password():
    for _ in range(login_limiter.max_attempts):
        _login("wrong")
    assert _login("Correct123!").status_code == 429


def test_successful_login_resets_the_counter():
    for _ in range(login_limiter.max_attempts - 1):
        _login("wrong")
    assert _login("Correct123!").status_code == 200
    for _ in range(login_limiter.max_attempts - 1):
        assert _login("wrong").status_code == 401


def test_lockout_is_per_username():
    for _ in range(login_limiter.max_attempts):
        _login("wrong")
    assert _login("whatever", username="bob").status_code == 401


def test_username_case_does_not_bypass_the_limit():
    for _ in range(login_limiter.max_attempts):
        _login("wrong")
    assert _login("wrong", username="ALICE").status_code == 429


def test_failures_expire_after_the_window():
    now = [1000.0]
    limiter = LoginRateLimiter(max_attempts=2, window_seconds=60, clock=lambda: now[0])
    limiter.record_failure("1.2.3.4", "alice")
    limiter.record_failure("1.2.3.4", "alice")
    assert limiter.retry_after("1.2.3.4", "alice") == 60

    now[0] += 30
    assert limiter.retry_after("1.2.3.4", "alice") == 30

    now[0] += 30
    assert limiter.retry_after("1.2.3.4", "alice") is None
