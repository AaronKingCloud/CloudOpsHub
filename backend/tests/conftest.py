"""Shared test setup."""

import pytest

from app.auth.rate_limit import login_limiter


@pytest.fixture(autouse=True)
def reset_login_limiter():
    """Failed logins in one test must not lock out the next one."""
    login_limiter.reset()
    yield
    login_limiter.reset()
