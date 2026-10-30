import boto3
from fastapi import APIRouter

from app.schemas import AwsAccount

router = APIRouter(prefix="/aws", tags=["aws"])


@router.get("/account", response_model=AwsAccount)
def get_aws_account() -> AwsAccount:
    sts = boto3.client("sts")

    identity = sts.get_caller_identity()

    return AwsAccount(
        account_id=identity["Account"],
        user_name=identity["Arn"].split("/")[-1],
        arn=identity["Arn"],
    )

@router.get("/ec2")
def list_ec2_instances():
    ec2 = boto3.client("ec2")

    response = ec2.describe_instances()

    instances = []

    for reservation in response["Reservations"]:
        for instance in reservation["Instances"]:
            name = "Unnamed"

            for tag in instance.get("Tags", []):
                if tag["Key"] == "Name":
                    name = tag["Value"]

            instances.append(
                {
                    "instance_id": instance["InstanceId"],
                    "name": name,
                    "state": instance["State"]["Name"],
                }
            )

    return instances

@router.get("/ec2")
def list_ec2_instances():
    ec2 = boto3.client("ec2")

    response = ec2.describe_instances()

    instances = []

    for reservation in response["Reservations"]:
        for instance in reservation["Instances"]:
            name = "Unnamed"

            for tag in instance.get("Tags", []):
                if tag["Key"] == "Name":
                    name = tag["Value"]

            instances.append(
                {
                    "instance_id": instance["InstanceId"],
                    "name": name,
                    "state": instance["State"]["Name"],
                }
            )

    return instances