"""Real status of every connected AWS account.

- The account the backend runs in, through its own credentials.
- Other accounts, through a read-only role in each one (``sts:AssumeRole`` with an external ID), so no keys are
  stored. They are listed in the SSM parameter named by ``AWS_ACCOUNTS_PARAM``, as JSON:
  ``[{"name": "...", "role_arn": "...", "external_id": "...", "region": "us-east-1"}]``

Status: Critical = the account can't be read, Warning = a CloudWatch alarm is firing, Healthy = neither.
"""

import json
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.schemas import Account

logger = logging.getLogger(__name__)

CACHE_SECONDS = 60  # the dashboard refreshes every 30 s per user; AWS is asked at most once a minute
_AWS_CONFIG = Config(connect_timeout=3, read_timeout=5, retries={"total_max_attempts": 2})
_AWS_ERRORS = (BotoCoreError, ClientError)

_lock = threading.Lock()
_cached: list[Account] | None = None
_expires_at = 0.0


@dataclass(frozen=True)
class AccountTarget:
    name: str
    role_arn: str | None = None  # None = the backend's own account
    external_id: str | None = None
    region: str | None = None


def clear_cache() -> None:
    """Forget the cached result (used by tests)."""
    global _cached, _expires_at
    with _lock:
        _cached = None
        _expires_at = 0.0


def _client(service: str, **kwargs):
    # A session per call: boto3's shared default session isn't safe to use from several threads
    return boto3.session.Session().client(service, config=_AWS_CONFIG, **kwargs)


def load_targets() -> list[AccountTarget]:
    """The backend's own account, then the configured ones. A broken entry is logged and skipped."""
    targets = [AccountTarget(name=os.getenv("AWS_ACCOUNT_NAME") or "AWS account")]
    param = os.getenv("AWS_ACCOUNTS_PARAM", "").strip()
    if not param:
        return targets

    try:
        response = _client("ssm").get_parameter(Name=param, WithDecryption=True)
        entries = json.loads(response["Parameter"]["Value"])
        if not isinstance(entries, list):
            raise ValueError("expected a list of accounts")
    except (*_AWS_ERRORS, ValueError):
        logger.exception("Could not read the connected accounts from %s", param)
        return targets

    for entry in entries:
        try:
            targets.append(
                AccountTarget(
                    name=entry["name"],
                    role_arn=entry["role_arn"],
                    external_id=entry["external_id"],
                    region=entry["region"],
                )
            )
        except (KeyError, TypeError):
            logger.warning("Skipping a connected account with missing settings")
    return targets


def _cloudwatch(target: AccountTarget):
    if target.role_arn is None:
        return _client("cloudwatch")
    credentials = _client("sts").assume_role(
        RoleArn=target.role_arn,
        RoleSessionName="cloudops-hub",
        ExternalId=target.external_id,
    )["Credentials"]
    return _client(
        "cloudwatch",
        region_name=target.region,
        aws_access_key_id=credentials["AccessKeyId"],
        aws_secret_access_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
    )


def _check(account_id: int, target: AccountTarget) -> Account:
    name, alarms, status = target.name, 0, "Healthy"
    try:
        pages = _cloudwatch(target).get_paginator("describe_alarms").paginate(
            StateValue="ALARM", AlarmTypes=["MetricAlarm", "CompositeAlarm"]
        )
        alarms = sum(len(p.get("MetricAlarms", [])) + len(p.get("CompositeAlarms", [])) for p in pages)
        if alarms:
            status = "Warning"
    except _AWS_ERRORS as exc:
        logger.warning("Could not read AWS account %s: %s", target.name, exc)
        name, status = f"{target.name} (can't connect)", "Critical"
    return Account(
        id=account_id,
        provider="AWS",
        account_name=name,
        status=status,
        alert_count=alarms,
        last_updated=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
    )


def get_accounts() -> list[Account]:
    """Status of every connected account, checked at most once per ``CACHE_SECONDS``."""
    global _cached, _expires_at
    with _lock:
        if _cached is None or time.monotonic() >= _expires_at:
            targets = load_targets()
            with ThreadPoolExecutor(max_workers=min(8, len(targets))) as pool:
                _cached = list(pool.map(_check, range(1, len(targets) + 1), targets))
            _expires_at = time.monotonic() + CACHE_SECONDS
        return _cached
