"""Tests for memory and storage utilization metric endpoints."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_memory_metrics_shape():
    resp = client.get("/api/metrics/memory")
    assert resp.status_code == 200
    points = resp.json()
    assert points
    assert set(points[0]) == {"timestamp", "value"}


def test_storage_metrics_shape():
    resp = client.get("/api/metrics/storage")
    assert resp.status_code == 200
    points = resp.json()
    assert points
    assert set(points[0]) == {"timestamp", "value"}
