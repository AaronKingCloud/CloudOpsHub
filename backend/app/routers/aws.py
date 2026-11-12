"""Live AWS endpoints (account identity, EC2 inventory, CloudWatch metrics).

Credentials come from the standard boto3 chain (env vars, ~/.aws, or an IAM role).
All routes require a logged-in user.
"""

from datetime import datetime, timedelta, timezone

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.dependencies import get_current_user
from app.schemas import AwsAccount, Ec2Instance, MetricPoint

router = APIRouter(
    prefix="/aws",
    tags=["aws"],
    dependencies=[Depends(get_current_user)],
)


def _aws_error(exc: Exception) -> HTTPException:
    """Turn a boto3 failure into a clean 502 instead of a 500 stack trace."""
    return HTTPException(status_code=502, detail=f"AWS request failed: {exc}")


@router.get("/account", response_model=AwsAccount)
def get_aws_account() -> AwsAccount:
    try:
        identity = boto3.client("sts").get_caller_identity()
    except (BotoCoreError, ClientError) as exc:
        raise _aws_error(exc)

    return AwsAccount(
        account_id=identity["Account"],
        user_name=identity["Arn"].split("/")[-1],
        arn=identity["Arn"],
    )


@router.get("/ec2", response_model=list[Ec2Instance])
def list_ec2_instances() -> list[Ec2Instance]:
    try:
        pages = boto3.client("ec2").get_paginator("describe_instances").paginate()
        reservations = [r for page in pages for r in page["Reservations"]]
    except (BotoCoreError, ClientError) as exc:
        raise _aws_error(exc)

    instances = []
    for reservation in reservations:
        for inst in reservation["Instances"]:
            tags = {t["Key"]: t["Value"] for t in inst.get("Tags", [])}
            instances.append(
                Ec2Instance(
                    instance_id=inst["InstanceId"],
                    name=tags.get("Name", "Unnamed"),
                    state=inst["State"]["Name"],
                    instance_type=inst["InstanceType"],
                    availability_zone=inst["Placement"]["AvailabilityZone"],
                    private_ip=inst.get("PrivateIpAddress"),
                    launch_time=inst["LaunchTime"].isoformat(),
                )
            )
    return instances


@router.get("/ec2/{instance_id}/cpu", response_model=list[MetricPoint])
def get_ec2_cpu(
    instance_id: str,
    hours: int = Query(3, ge=1, le=24, description="How far back to look"),
) -> list[MetricPoint]:
    """Average CPU utilization in 5-minute buckets, shaped like /metrics/cpu."""
    end = datetime.now(timezone.utc)
    try:
        resp = boto3.client("cloudwatch").get_metric_statistics(
            Namespace="AWS/EC2",
            MetricName="CPUUtilization",
            Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
            StartTime=end - timedelta(hours=hours),
            EndTime=end,
            Period=300,
            Statistics=["Average"],
        )
    except (BotoCoreError, ClientError) as exc:
        raise _aws_error(exc)

    points = sorted(resp["Datapoints"], key=lambda p: p["Timestamp"])
    return [
        MetricPoint(timestamp=p["Timestamp"].strftime("%H:%M"), value=round(p["Average"], 1))
        for p in points
    ]