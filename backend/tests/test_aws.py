"""Tests for /api/aws/* using moto, so no real AWS account or credentials are needed."""

from datetime import datetime, timedelta, timezone

import boto3
import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

from app.auth.dependencies import get_current_user
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def fake_aws(monkeypatch):
    """Fake credentials + region, and start moto's in-memory AWS."""
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    with mock_aws():
        yield


@pytest.fixture
def logged_in():
    """Skip the real JWT check for these tests (auth itself is covered in test_auth.py)."""
    app.dependency_overrides[get_current_user] = lambda: {"username": "tester"}
    yield
    app.dependency_overrides.clear()


def _launch_instance(name: str = "web-01") -> str:
    ec2 = boto3.client("ec2")
    resp = ec2.run_instances(
        ImageId="ami-12345678",
        InstanceType="t3.micro",
        MinCount=1,
        MaxCount=1,
        TagSpecifications=[
            {"ResourceType": "instance", "Tags": [{"Key": "Name", "Value": name}]}
        ],
    )
    return resp["Instances"][0]["InstanceId"]


def test_aws_routes_require_login():
    for path in ("/api/aws/account", "/api/aws/ec2", "/api/aws/ec2/i-123/cpu"):
        assert client.get(path).status_code == 401


def test_account(logged_in):
    body = client.get("/api/aws/account").json()
    assert set(body) == {"accountId", "userName", "arn"}


def test_ec2_list(logged_in):
    instance_id = _launch_instance("web-01")

    body = client.get("/api/aws/ec2").json()

    assert len(body) == 1
    inst = body[0]
    assert inst["instanceId"] == instance_id
    assert inst["name"] == "web-01"
    assert inst["state"] == "running"
    assert inst["instanceType"] == "t3.micro"
    assert set(inst) == {
        "instanceId", "name", "state", "instanceType",
        "availabilityZone", "privateIp", "launchTime",
    }


def test_ec2_list_empty(logged_in):
    assert client.get("/api/aws/ec2").json() == []


def test_ec2_cpu(logged_in):
    instance_id = _launch_instance()
    boto3.client("cloudwatch").put_metric_data(
        Namespace="AWS/EC2",
        MetricData=[
            {
                "MetricName": "CPUUtilization",
                "Dimensions": [{"Name": "InstanceId", "Value": instance_id}],
                "Timestamp": datetime.now(timezone.utc) - timedelta(minutes=10),
                "Value": 42.0,
                "Unit": "Percent",
            }
        ],
    )

    body = client.get(f"/api/aws/ec2/{instance_id}/cpu").json()

    assert body and set(body[0]) == {"timestamp", "value"}
    assert body[0]["value"] == 42.0