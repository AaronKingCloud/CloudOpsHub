"""The backend must refuse to run in production with the built-in dev JWT secret."""

import pytest

from app.auth.utils import DEV_JWT_SECRET, load_jwt_secret


def test_dev_falls_back_to_dev_secret(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    assert load_jwt_secret() == DEV_JWT_SECRET


@pytest.mark.parametrize("secret", [None, "", DEV_JWT_SECRET])
def test_production_rejects_missing_or_dev_secret(monkeypatch, secret):
    monkeypatch.setenv("APP_ENV", "production")
    if secret is None:
        monkeypatch.delenv("JWT_SECRET", raising=False)
    else:
        monkeypatch.setenv("JWT_SECRET", secret)
    with pytest.raises(RuntimeError):
        load_jwt_secret()


def test_production_accepts_real_secret(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "a-real-random-secret")
    assert load_jwt_secret() == "a-real-random-secret"
