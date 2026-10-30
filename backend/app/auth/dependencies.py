"""FastAPI dependencies for authentication and role-based access control.

Usage in a router::

    from app.auth.dependencies import get_current_user, require_role

    @router.get("/admin-only")
    def admin_view(user = Depends(require_role("admin"))):
        ...

    @router.get("/any-logged-in")
    def profile(user = Depends(get_current_user)):
        ...
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.auth.database import get_db
from app.auth.schemas import UserResponse
from app.auth.utils import decode_token

# tokenUrl points to the login endpoint so the Swagger UI "Authorize" button works.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=True)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserResponse:
    """Validate the JWT access token and return the authenticated user."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exc

    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise credentials_exc

    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ? AND is_active = 1", (user_id,)
        ).fetchone()

    if row is None:
        raise credentials_exc

    return UserResponse(
        id=row["id"],
        username=row["username"],
        email=row["email"],
        role=row["role"],
        is_active=bool(row["is_active"]),
        created_at=row["created_at"],
        last_login=row["last_login"],
    )


def require_role(*roles: str):
    """Dependency factory — restricts an endpoint to the given role(s)."""

    async def _check(user: UserResponse = Depends(get_current_user)) -> UserResponse:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted. Required: {', '.join(roles)}",
            )
        return user

    return _check

