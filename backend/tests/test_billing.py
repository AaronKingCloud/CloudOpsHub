"""Tests for the AWS Cost Explorer billing summary endpoint (/api/billing/summary)."""

from unittest.mock import MagicMock, patch

from botocore.exceptions import ClientError, NoCredentialsError
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_billing_summary_from_aws_cost_explorer(monkeypatch):
    monkeypatch.delenv("BILLING_USE_MOCK", raising=False)
    monkeypatch.delenv("BILLING_STRICT_AWS", raising=False)

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


def test_billing_summary_handles_forecast_unavailable(monkeypatch):
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


def test_billing_summary_fallback_when_no_credentials(monkeypatch):
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


def test_billing_summary_strict_aws_returns_502(monkeypatch):
    monkeypatch.delenv("BILLING_USE_MOCK", raising=False)
    monkeypatch.setenv("BILLING_STRICT_AWS", "true")

    mock_ce = MagicMock()
    mock_ce.get_cost_and_usage.side_effect = NoCredentialsError()

    with patch("app.routers.billing.boto3.client", return_value=mock_ce):
        resp = client.get("/api/billing/summary")

    assert resp.status_code == 502
    assert "AWS Cost Explorer failed" in resp.json()["detail"]

