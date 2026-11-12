"""AWS Cost Explorer billing summary endpoint.

Calls AWS Cost Explorer (``ce``) in ``us-east-1`` to retrieve:
- Current month-to-date spend
- Spend broken down by AWS service
- End-of-month forecasted spend

If ``BILLING_USE_MOCK=true`` or AWS credentials / Cost Explorer permissions are
unavailable in local development, it falls back to representative mock data
(unless ``BILLING_STRICT_AWS=true``) so the dashboard remains functional.
"""

import calendar
import os
from datetime import date, timedelta

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, HTTPException

from app.schemas import BillingSummary, ServiceCost

router = APIRouter(prefix="/billing", tags=["billing"])


def _month_bounds(today: date) -> tuple[str, str, str, str]:
    """Return (month_start, usage_end, forecast_start, next_month_start) ISO dates.

    AWS Cost Explorer treats TimePeriod.End as exclusive, so usage_end is at
    least tomorrow to avoid Start == End errors on the 1st of the month.
    """
    month_start = today.replace(day=1)
    usage_end = today + timedelta(days=1)
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    next_month_start = month_start + timedelta(days=days_in_month)
    return (
        month_start.isoformat(),
        usage_end.isoformat(),
        today.isoformat(),
        next_month_start.isoformat(),
    )


def _mock_billing_summary(today: date) -> BillingSummary:
    """Return representative billing data when AWS Cost Explorer is unavailable."""
    month_start = today.replace(day=1).isoformat()
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    period_end = today.replace(day=days_in_month).isoformat()

    services = [
        ("Amazon Elastic Compute Cloud - Compute", 42.80),
        ("Amazon Relational Database Service", 24.50),
        ("Amazon Simple Storage Service", 8.15),
        ("Amazon CloudWatch", 5.40),
        ("AWS Key Management Service", 3.00),
    ]
    total = round(sum(amount for _, amount in services), 2)
    breakdown = [
        ServiceCost(
            service=name,
            amount=round(amount, 2),
            currency="USD",
            percentage=round((amount / total) * 100, 1) if total > 0 else 0.0,
        )
        for name, amount in services
    ]
    prorated_forecast = round(max(total * (days_in_month / max(today.day, 1)), total), 2)

    return BillingSummary(
        current_month_spend=total,
        forecasted_spend=prorated_forecast,
        currency="USD",
        period_start=month_start,
        period_end=period_end,
        service_breakdown=breakdown,
        source="mock",
    )


def _fetch_aws_billing(today: date) -> BillingSummary:
    """Query AWS Cost Explorer for current month spend, service breakdown, and forecast."""
    month_start, usage_end, forecast_start, next_month_start = _month_bounds(today)
    ce = boto3.client("ce", region_name="us-east-1")

    usage_resp = ce.get_cost_and_usage(
        TimePeriod={"Start": month_start, "End": usage_end},
        Granularity="MONTHLY",
        Metrics=["UnblendedCost"],
        GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
    )

    raw_services: list[tuple[str, float, str]] = []
    currency = "USD"

    for result in usage_resp.get("ResultsByTime", []):
        for group in result.get("Groups", []):
            service_name = group["Keys"][0]
            metric = group["Metrics"]["UnblendedCost"]
            amount = float(metric["Amount"])
            currency = metric.get("Unit", currency)
            if amount > 0:
                raw_services.append((service_name, amount, currency))

    raw_services.sort(key=lambda item: item[1], reverse=True)
    total_spend = round(sum(item[1] for item in raw_services), 2)

    breakdown = [
        ServiceCost(
            service=name,
            amount=round(amount, 2),
            currency=unit,
            percentage=round((amount / total_spend) * 100, 1) if total_spend > 0 else 0.0,
        )
        for name, amount, unit in raw_services
    ]

    # Forecast can fail with DataUnavailableException on brand-new AWS accounts.
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    forecasted_spend = round(total_spend * (days_in_month / max(today.day, 1)), 2)

    try:
        forecast_resp = ce.get_cost_forecast(
            TimePeriod={"Start": forecast_start, "End": next_month_start},
            Metric="UNBLENDED_COST",
            Granularity="MONTHLY",
        )
        forecasted_spend = round(float(forecast_resp["Total"]["Amount"]), 2)
    except ClientError:
        # Keep the pro-rated estimate if AWS Cost Forecast has insufficient history.
        pass

    period_end = today.replace(day=days_in_month).isoformat()
    return BillingSummary(
        current_month_spend=total_spend,
        forecasted_spend=forecasted_spend,
        currency=currency,
        period_start=month_start,
        period_end=period_end,
        service_breakdown=breakdown,
        source="aws",
    )


@router.get("/summary", response_model=BillingSummary)
def get_billing_summary() -> BillingSummary:
    """Return current month spend, service breakdown, and forecasted spend."""
    today = date.today()
    if os.getenv("BILLING_USE_MOCK", "").lower() == "true":
        return _mock_billing_summary(today)

    try:
        return _fetch_aws_billing(today)
    except (BotoCoreError, ClientError) as exc:
        if os.getenv("BILLING_STRICT_AWS", "").lower() == "true":
            raise HTTPException(status_code=502, detail=f"AWS Cost Explorer failed: {exc}")
        return _mock_billing_summary(today)

