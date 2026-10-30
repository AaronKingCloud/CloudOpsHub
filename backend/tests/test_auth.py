"""Tests for the authentication endpoints (``/api/auth/*``).

Each test gets a fresh temporary SQLite database via the ``setup_db``
fixture so tests are fully isolated from one another.
"""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import app.auth.database as db_module
from app.auth.database import get_db, init_db
from app.auth.utils import hash_password
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db(tmp_path, monkeypatch):
    """Point the auth database at a temp file and seed one admin user."""
    db_path = str(tmp_path / "test_auth.db")
    monkeypatch.setattr(db_module, "DB_PATH", db_path)
    init_db()

    with get_db() as conn:
        conn.execute(
            """INSERT INTO users
               (id, username, email, hashed_password, role, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, 1, ?)""",
            (
                str(uuid.uuid4()), "testadmin", "admin@test.local",
                hash_password("Admin123!"), "admin",
                datetime.now(timezone.utc).isoformat(),
            ),
        )


# ── helpers ──────────────────────────────────────────────────────────

def _login(username: str = "testadmin", password: str = "Admin123!"):
    return client.post("/api/auth/login", json={"username": username, "password": password})


def _admin_token() -> str:
    return _login().json()["accessToken"]


# ── login ────────────────────────────────────────────────────────────

def test_login_success():
    resp = _login()
    assert resp.status_code == 200
    body = resp.json()
    assert "accessToken" in body
    assert "refreshToken" in body
    assert body["user"]["username"] == "testadmin"
    assert body["user"]["role"] == "admin"


def test_login_wrong_password():
    assert _login(password="wrong").status_code == 401


def test_login_unknown_user():
    assert _login(username="ghost").status_code == 401


# ── profile ──────────────────────────────────────────────────────────

def test_get_profile():
    token = _admin_token()
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "testadmin"


def test_profile_without_token():
    assert client.get("/api/auth/me").status_code == 401


# ── registration ─────────────────────────────────────────────────────

def test_register_as_admin():
    resp = client.post(
        "/api/auth/register",
        json={"username": "newbie", "email": "n@test.local", "password": "NewUser123!", "role": "viewer"},
        headers={"Authorization": f"Bearer {_admin_token()}"},
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "viewer"


def test_register_duplicate_username():
    token = _admin_token()
    client.post(
        "/api/auth/register",
        json={"username": "dup", "email": "dup@test.local", "password": "Duplicate1!", "role": "viewer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = client.post(
        "/api/auth/register",
        json={"username": "dup", "email": "other@test.local", "password": "Duplicate1!", "role": "viewer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409


def test_register_forbidden_for_viewer():
    token = _admin_token()
    # Create a viewer first (username must be >= 3 chars)
    create_res = client.post(
        "/api/auth/register",
        json={"username": "viewer1", "email": "viewer1@test.local", "password": "Viewer1234!", "role": "viewer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    viewer_token = _login("viewer1", "Viewer1234!").json()["accessToken"]

    resp = client.post(
        "/api/auth/register",
        json={"username": "hacker", "email": "h@test.local", "password": "Hacker123!"},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert resp.status_code == 403


# ── token refresh ────────────────────────────────────────────────────

def test_refresh_token():
    data = _login().json()
    resp = client.post("/api/auth/refresh", json={"refreshToken": data["refreshToken"]})
    assert resp.status_code == 200
    assert "accessToken" in resp.json()


def test_refresh_with_access_token_fails():
    """An access token is not a valid refresh token."""
    data = _login().json()
    resp = client.post("/api/auth/refresh", json={"refreshToken": data["accessToken"]})
    assert resp.status_code == 401


# ── user listing ─────────────────────────────────────────────────────

def test_list_users_admin():
    resp = client.get("/api/auth/users", headers={"Authorization": f"Bearer {_admin_token()}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


def test_list_users_forbidden_for_operator():
    token = _admin_token()
    client.post(
        "/api/auth/register",
        json={"username": "op1", "email": "op1@test.local", "password": "Operator1!", "role": "operator"},
        headers={"Authorization": f"Bearer {token}"},
    )
    op_token = _login("op1", "Operator1!").json()["accessToken"]
    assert client.get("/api/auth/users", headers={"Authorization": f"Bearer {op_token}"}).status_code == 403

