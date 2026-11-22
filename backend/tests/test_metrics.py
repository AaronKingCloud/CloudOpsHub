"""Tests for memory and storage utilization metric endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.auth.schemas import UserResponse
from app.main import app

client = TestClient(app)


@pytest.fixture
def logged_in():
    app.dependency_overrides[get_current_user] = lambda: UserResponse(
        id="user-viewer",
        username="viewer",
        email="viewer@test.local",
        role="viewer",
        is_active=True,
        created_at="2026-11-21T00:00:00+00:00",
    )
    yield
    app.dependency_overrides.clear()


def test_memory_metrics_shape(logged_in):
    resp = client.get("/api/metrics/memory")
    assert resp.status_code == 200
    points = resp.json()
    assert points
    assert set(points[0]) == {"timestamp", "value"}


def test_storage_metrics_shape(logged_in):
    resp = client.get("/api/metrics/storage")
    assert resp.status_code == 200
    points = resp.json()
    assert points
    assert set(points[0]) == {"timestamp", "value"}
