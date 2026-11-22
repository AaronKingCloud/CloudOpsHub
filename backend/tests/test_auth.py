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


# ── user updates & password change ───────────────────────────────────

def test_patch_user_role_and_disable_and_reenable():
    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}
    created = client.post(
        "/api/auth/register",
        json={"username": "bob", "email": "bob@test.local", "password": "BobPass123!", "role": "viewer"},
        headers=admin_headers,
    )
    assert created.status_code == 201
    bob_id = created.json()["id"]
    bob_token = _login("bob", "BobPass123!").json()["accessToken"]

    # Promote to operator
    promoted = client.patch(
        f"/api/auth/users/{bob_id}",
        json={"role": "operator"},
        headers=admin_headers,
    )
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "operator"
    assert promoted.json()["isActive"] is True

    # Disable user -> existing token rejected & login fails
    disabled = client.patch(
        f"/api/auth/users/{bob_id}",
        json={"isActive": False},
        headers=admin_headers,
    )
    assert disabled.status_code == 200
    assert disabled.json()["isActive"] is False
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {bob_token}"}).status_code == 401
    assert _login("bob", "BobPass123!").status_code == 401

    # Re-enable user -> login works again with promoted role
    enabled = client.patch(
        f"/api/auth/users/{bob_id}",
        json={"isActive": True},
        headers=admin_headers,
    )
    assert enabled.status_code == 200
    assert enabled.json()["isActive"] is True
    assert _login("bob", "BobPass123!").json()["user"]["role"] == "operator"


def test_patch_user_permissions_and_self_protection():
    admin_headers = {"Authorization": f"Bearer {_admin_token()}"}
    me = client.get("/api/auth/me", headers=admin_headers).json()
    admin_id = me["id"]

    client.post(
        "/api/auth/register",
        json={"username": "op2", "email": "op2@test.local", "password": "Operator1!", "role": "operator"},
        headers=admin_headers,
    )
    op_headers = {"Authorization": f"Bearer {_login('op2', 'Operator1!').json()['accessToken']}"}

    assert client.patch(f"/api/auth/users/{admin_id}", json={"role": "viewer"}, headers=op_headers).status_code == 403
    assert client.patch(f"/api/auth/users/{admin_id}", json={"role": "viewer"}, headers=admin_headers).status_code == 400
    assert client.patch(f"/api/auth/users/{admin_id}", json={"isActive": False}, headers=admin_headers).status_code == 400
    assert client.patch(f"/api/auth/users/{admin_id}", json={}, headers=admin_headers).status_code == 400
    assert client.patch("/api/auth/users/no-such-id", json={"role": "viewer"}, headers=admin_headers).status_code == 404


def test_change_own_password():
    assert client.post(
        "/api/auth/me/password",
        json={"currentPassword": "Admin123!", "newPassword": "NewAdmin123!"},
    ).status_code == 401

    headers = {"Authorization": f"Bearer {_admin_token()}"}
    assert client.post(
        "/api/auth/me/password",
        json={"currentPassword": "WrongPassword!", "newPassword": "NewAdmin123!"},
        headers=headers,
    ).status_code == 400

    assert client.post(
        "/api/auth/me/password",
        json={"currentPassword": "Admin123!", "newPassword": "short"},
        headers=headers,
    ).status_code == 422

    ok = client.post(
        "/api/auth/me/password",
        json={"currentPassword": "Admin123!", "newPassword": "NewAdmin123!"},
        headers=headers,
    )
    assert ok.status_code == 204
    assert _login("testadmin", "Admin123!").status_code == 401
    assert _login("testadmin", "NewAdmin123!").status_code == 200


