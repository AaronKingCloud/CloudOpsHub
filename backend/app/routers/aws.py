import boto3
from fastapi import APIRouter

from app.schemas import AwsAccount

router = APIRouter(prefix="/aws", tags=["aws"])


@router.get("/account", response_model=AwsAccount)
def get_aws_account() -> AwsAccount:
    sts = boto3.client("sts")
    iam = boto3.client("iam")

    identity = sts.get_caller_identity()
    user = iam.get_user()

    return AwsAccount(
        account_id=identity["Account"],
        user_name=user["User"]["UserName"],
        arn=identity["Arn"],
    )