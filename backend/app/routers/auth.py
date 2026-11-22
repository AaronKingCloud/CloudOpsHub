"""Authentication endpoints: register, login, token refresh, and profile.

All endpoints live under ``/api/auth/``.  The ``/api/aws/*`` endpoints require
login; dashboard / resource endpoints are still public for now.
"""

import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.auth.database import get_db
from app.auth.dependencies import get_current_user, require_role
from app.auth.rate_limit import login_limiter
from app.auth.schemas import (
    AccessTokenResponse,
    PasswordChange,
    TokenRefresh,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
)
from app.auth.utils import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Registration (admin-only) ────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    body: UserCreate,
    _admin: UserResponse = Depends(require_role("admin")),
) -> UserResponse:
    """Create a new user account.  Requires the *admin* role."""
    with get_db() as conn:
        conflict = conn.execute(
            "SELECT id FROM users WHERE username = ? OR email = ?",
            (body.username, body.email),
        ).fetchone()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username or email already exists",
            )

        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        conn.execute(
            """INSERT INTO users
               (id, username, email, hashed_password, role, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, 1, ?)""",
            (user_id, body.username, body.email, hash_password(body.password), body.role, now),
        )

    return UserResponse(
        id=user_id, username=body.username, email=body.email,
        role=body.role, is_active=True, created_at=now,
    )


# ── Login ────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: UserLogin, request: Request) -> TokenResponse:
    """Authenticate with username + password and receive JWT tokens.

    Repeated failures for one username from one address are slowed down (see app/auth/rate_limit.py).
    """
    client = request.client.host if request.client else None
    wait = login_limiter.retry_after(client, body.username)
    if wait is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed sign-in attempts. Try again in {math.ceil(wait / 60)} minute(s).",
            headers={"Retry-After": str(wait)},
        )

    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? AND is_active = 1",
            (body.username,),
        ).fetchone()

    if row is None or not verify_password(body.password, row["hashed_password"]):
        login_limiter.record_failure(client, body.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    login_limiter.record_success(client, body.username)
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        conn.execute("UPDATE users SET last_login = ? WHERE id = ?", (now, row["id"]))

    user = UserResponse(
        id=row["id"], username=row["username"], email=row["email"],
        role=row["role"], is_active=bool(row["is_active"]),
        created_at=row["created_at"], last_login=now,
    )

    return TokenResponse(
        access_token=create_access_token(user.id, user.username, user.role),
        refresh_token=create_refresh_token(user.id),
        user=user,
    )


# ── Token refresh ────────────────────────────────────────────────────

@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(body: TokenRefresh) -> AccessTokenResponse:
    """Exchange a valid refresh token for a fresh access token."""
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ? AND is_active = 1", (user_id,)
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    return AccessTokenResponse(
        access_token=create_access_token(row["id"], row["username"], row["role"]),
    )


# ── Profile ──────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def get_profile(user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """Return the current user's profile."""
    return user


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_own_password(
    body: PasswordChange,
    user: UserResponse = Depends(get_current_user),
) -> Response:
    """Change the currently signed-in user's password."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT hashed_password FROM users WHERE id = ?",
            (user.id,),
        ).fetchone()
        if row is None or not verify_password(body.current_password, row["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        conn.execute(
            "UPDATE users SET hashed_password = ? WHERE id = ?",
            (hash_password(body.new_password), user.id),
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── User management (admin-only) ─────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
def list_users(
    _admin: UserResponse = Depends(require_role("admin")),
) -> list[UserResponse]:
    """List every user account.  Requires the *admin* role."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()

    return [
        UserResponse(
            id=r["id"], username=r["username"], email=r["email"],
            role=r["role"], is_active=bool(r["is_active"]),
            created_at=r["created_at"], last_login=r["last_login"],
        )
        for r in rows
    ]


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    body: UserUpdate,
    admin: UserResponse = Depends(require_role("admin")),
) -> UserResponse:
    """Update a user's role or active status.  Admins cannot demote or disable themselves."""
    if body.role is None and body.is_active is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide role or isActive to update",
        )
    if user_id == admin.id:
        if body.role is not None and body.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admins cannot demote themselves",
            )
        if body.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admins cannot disable themselves",
            )

    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        new_role = body.role if body.role is not None else row["role"]
        new_active = int(body.is_active) if body.is_active is not None else row["is_active"]
        conn.execute(
            "UPDATE users SET role = ?, is_active = ? WHERE id = ?",
            (new_role, new_active, user_id),
        )

    return UserResponse(
        id=row["id"],
        username=row["username"],
        email=row["email"],
        role=new_role,
        is_active=bool(new_active),
        created_at=row["created_at"],
        last_login=row["last_login"],
    )

