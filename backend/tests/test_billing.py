"""Tests for the AWS Cost Explorer billing summary endpoint (/api/billing/summary)."""

from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError, NoCredentialsError
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_user
from app.main import app
from app.routers.billing import clear_billing_cache

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_billing_cache():
    """Ensure each test starts and ends with an empty billing cache."""
    clear_billing_cache()
    yield
    clear_billing_cache()


@pytest.fixture
def logged_in():
    """Skip the real JWT check for billing tests (auth itself is covered in test_auth.py)."""
    app.dependency_overrides[get_current_user] = lambda: {"username": "tester"}
    yield
    app.dependency_overrides.clear()


def _sample_ce_client() -> MagicMock:
    mock_ce = MagicMock()
    mock_ce.get_cost_and_usage.return_value = {
        "ResultsByTime": [
            {
                "Groups": [
                    {
                        "Keys": ["Amazon S3"],
                        "Metrics": {"UnblendedCost": {"Amount": "10.00", "Unit": "USD"}},
                    },
                    {
                        "Keys": ["Amazon EC2"],
                        "Metrics": {"UnblendedCost": {"Amount": "30.00", "Unit": "USD"}},
                    },
                ]
            }
        ]
    }
    mock_ce.get_cost_forecast.return_value = {
        "Total": {"Amount": "75.50", "Unit": "USD"}
    }
    return mock_ce


def test_billing_summary_requires_login():
    resp = client.get("/api/billing/summary")
    assert resp.status_code == 401


def test_billing_summary_from_aws_cost_explorer(monkeypatch, logged_in):
    monkeypatch.delenv("BILLING_USE_MOCK", raising=False)
    monkeypatch.delenv("BILLING_STRICT_AWS", raising=False)

    mock_ce = _sample_ce_client()

    with patch("app.routers.billing.boto3.client", return_value=mock_ce) as mock_client:
        resp = client.get("/api/billing/summary")

    assert resp.status_code == 200
    mock_client.assert_called_once_with("ce", region_name="us-east-1")

    body = resp.json()
    assert body["source"] == "aws"
    assert body["currentMonthSpend"] == 40.0
    assert body["forecastedSpend"] == 75.5
    assert body["currency"] == "USD"
    assert len(body["serviceBreakdown"]) == 2
    # Sorted descending by spend
    assert body["serviceBreakdown"][0]["service"] == "Amazon EC2"
    assert body["serviceBreakdown"][0]["amount"] == 30.0
    assert body["serviceBreakdown"][0]["percentage"] == 75.0
    assert body["serviceBreakdown"][1]["service"] == "Amazon S3"
    assert body["serviceBreakdown"][1]["percentage"] == 25.0


def test_billing_summary_handles_forecast_unavailable(monkeypatch, logged_in):
    monkeypatch.delenv("BILLING_USE_MOCK", raising=False)

    mock_ce = MagicMock()
    mock_ce.get_cost_and_usage.return_value = {
        "ResultsByTime": [
            {
                "Groups": [
                    {
                        "Keys": ["Amazon EC2"],
                        "Metrics": {"UnblendedCost": {"Amount": "20.00", "Unit": "USD"}},
                    }
                ]
            }
        ]
    }
    mock_ce.get_cost_forecast.side_effect = ClientError(
        {"Error": {"Code": "DataUnavailableException", "Message": "Insufficient data"}},
        "GetCostForecast",
    )

    with patch("app.routers.billing.boto3.client", return_value=mock_ce):
        resp = client.get("/api/billing/summary")

    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "aws"
    assert body["currentMonthSpend"] == 20.0
    assert body["forecastedSpend"] >= 20.0


def test_billing_summary_fallback_when_no_credentials(monkeypatch, logged_in):
    monkeypatch.delenv("BILLING_USE_MOCK", raising=False)
    monkeypatch.delenv("BILLING_STRICT_AWS", raising=False)

    mock_ce = MagicMock()
    mock_ce.get_cost_and_usage.side_effect = NoCredentialsError()

    with patch("app.routers.billing.boto3.client", return_value=mock_ce):
        resp = client.get("/api/billing/summary")

    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "mock"
    assert body["currentMonthSpend"] > 0
    assert body["forecastedSpend"] >= body["currentMonthSpend"]
    assert len(body["serviceBreakdown"]) > 0


def test_billing_summary_strict_aws_returns_502(monkeypatch, logged_in):
    monkeypatch.delenv("BILLING_USE_MOCK", raising=False)
    monkeypatch.setenv("BILLING_STRICT_AWS", "true")

    mock_ce = MagicMock()
    mock_ce.get_cost_and_usage.side_effect = NoCredentialsError()

    with patch("app.routers.billing.boto3.client", return_value=mock_ce):
        resp = client.get("/api/billing/summary")

    assert resp.status_code == 502
    assert "AWS Cost Explorer failed" in resp.json()["detail"]


def test_billing_summary_caches_aws_calls(monkeypatch, logged_in):
    monkeypatch.delenv("BILLING_USE_MOCK", raising=False)
    monkeypatch.setenv("BILLING_CACHE_SECONDS", "21600")

    mock_ce = _sample_ce_client()

    with patch("app.routers.billing.boto3.client", return_value=mock_ce) as mock_client:
        first = client.get("/api/billing/summary")
        second = client.get("/api/billing/summary")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()
    assert mock_client.call_count == 1
    assert mock_ce.get_cost_and_usage.call_count == 1


def test_billing_summary_cache_expires(monkeypatch, logged_in):
    monkeypatch.delenv("BILLING_USE_MOCK", raising=False)
    monkeypatch.setenv("BILLING_CACHE_SECONDS", "60")

    clock = [1000.0]
    monkeypatch.setattr("app.routers.billing.time.monotonic", lambda: clock[0])

    mock_ce = _sample_ce_client()

    with patch("app.routers.billing.boto3.client", return_value=mock_ce) as mock_client:
        assert client.get("/api/billing/summary").status_code == 200
        clock[0] = 1030.0
        assert client.get("/api/billing/summary").status_code == 200
        assert mock_client.call_count == 1

        clock[0] = 1061.0
        assert client.get("/api/billing/summary").status_code == 200
        assert mock_client.call_count == 2
