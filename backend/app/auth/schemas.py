"""Pydantic request / response models for authentication.

Follows the same camelCase serialization pattern as ``app.schemas``
so every JSON key is consistent across the API.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ── Shared type ──────────────────────────────────────────────────────

UserRole = Literal["admin", "operator", "viewer"]


# ── Requests ─────────────────────────────────────────────────────────

class UserCreate(_Camel):
    username: str = Field(min_length=3, max_length=50)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = "viewer"


class UserLogin(_Camel):
    username: str
    password: str


class TokenRefresh(_Camel):
    refresh_token: str


# ── Responses ────────────────────────────────────────────────────────

class UserResponse(_Camel):
    id: str
    username: str
    email: str
    role: UserRole
    is_active: bool
    created_at: str
    last_login: str | None = None


class TokenResponse(_Camel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class AccessTokenResponse(_Camel):
    access_token: str
    token_type: str = "bearer"

