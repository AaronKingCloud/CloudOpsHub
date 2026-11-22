"""Shared test setup."""

import pytest

from app.auth.rate_limit import login_limiter
from app.database import configure_database, get_engine, init_app_db
from seed import seed_app_data


@pytest.fixture(autouse=True)
def reset_login_limiter():
    """Failed logins in one test must not lock out the next one."""
    login_limiter.reset()
    yield
    login_limiter.reset()


@pytest.fixture(autouse=True)
def isolated_app_db(tmp_path):
    """Give every test a fresh, seeded SQLite app database in tmp_path."""
    configure_database(f"sqlite:///{tmp_path / 'test_app.db'}")
    init_app_db()
    seed_app_data()
    yield
    get_engine().dispose()
