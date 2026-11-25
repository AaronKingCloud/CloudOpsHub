"""Tests for the real cloud account status (no AWS calls)."""

import json
from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError, NoCredentialsError

from app import cloud_accounts

OTHER = {
    "name": "Second",
    "role_arn": "arn:aws:iam::111122223333:role/CloudOpsHubReadOnly",
    "external_id": "ext-1",
    "region": "us-east-1",
}


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    monkeypatch.delenv("AWS_ACCOUNTS_PARAM", raising=False)
    monkeypatch.setenv("AWS_ACCOUNT_NAME", "Main")
    cloud_accounts.clear_cache()
    yield
    cloud_accounts.clear_cache()


class FakeAws:
    """Stands in for the AWS clients. Alarms are keyed by region (None = own account)."""

    def __init__(self, monkeypatch, *, param=None, alarms=None, assume_error=None, own_error=None):
        self.param = param
        self.alarms = alarms or {}
        self.own_error = own_error
        self.calls: list[tuple[str, dict]] = []
        self.sts = MagicMock()
        self.sts.assume_role.side_effect = assume_error
        self.sts.assume_role.return_value = {
            "Credentials": {"AccessKeyId": "a", "SecretAccessKey": "s", "SessionToken": "t"}
        }
        monkeypatch.setattr(cloud_accounts, "_client", self.client)

    def client(self, service, **kwargs):
        self.calls.append((service, kwargs))
        if service == "sts":
            return self.sts
        fake = MagicMock()
        if service == "ssm":
            fake.get_parameter.return_value = {"Parameter": {"Value": self.param}}
            return fake
        region = kwargs.get("region_name")
        if region is None and self.own_error:
            raise self.own_error
        fake.get_paginator.return_value.paginate.return_value = [
            {"MetricAlarms": [{}] * self.alarms.get(region, 0), "CompositeAlarms": []}
        ]
        return fake


def _summary():
    return [(a.id, a.account_name, a.status, a.alert_count) for a in cloud_accounts.get_accounts()]


def test_only_the_own_account_without_settings(monkeypatch):
    FakeAws(monkeypatch)
    assert _summary() == [(1, "Main", "Healthy", 0)]


def test_other_account_uses_role_external_id_region_and_temporary_credentials(monkeypatch):
    monkeypatch.setenv("AWS_ACCOUNTS_PARAM", "/accounts")
    aws = FakeAws(monkeypatch, param=json.dumps([OTHER]), alarms={"us-east-1": 2})

    assert _summary() == [(1, "Main", "Healthy", 0), (2, "Second", "Warning", 2)]
    aws.sts.assume_role.assert_called_once_with(
        RoleArn=OTHER["role_arn"], RoleSessionName="cloudops-hub", ExternalId="ext-1"
    )
    used = next(k for s, k in aws.calls if s == "cloudwatch" and k.get("region_name"))
    assert (used["region_name"], used["aws_session_token"]) == ("us-east-1", "t")


def test_unreachable_account_is_critical_and_does_not_hide_the_others(monkeypatch):
    monkeypatch.setenv("AWS_ACCOUNTS_PARAM", "/accounts")
    denied = ClientError({"Error": {"Code": "AccessDenied", "Message": "no"}}, "AssumeRole")
    FakeAws(monkeypatch, param=json.dumps([OTHER]), assume_error=denied)
    assert _summary() == [(1, "Main", "Healthy", 0), (2, "Second (can't connect)", "Critical", 0)]


def test_missing_aws_credentials_are_shown_not_an_error(monkeypatch):
    FakeAws(monkeypatch, own_error=NoCredentialsError())
    assert _summary() == [(1, "Main (can't connect)", "Critical", 0)]


@pytest.mark.parametrize("param", ["not json", '{"name": "x"}', json.dumps([{"name": "x"}]), "[1]"])
def test_bad_settings_still_show_the_own_account(monkeypatch, param):
    monkeypatch.setenv("AWS_ACCOUNTS_PARAM", "/accounts")
    FakeAws(monkeypatch, param=param)
    assert _summary() == [(1, "Main", "Healthy", 0)]


def test_result_is_cached(monkeypatch):
    aws = FakeAws(monkeypatch)
    cloud_accounts.get_accounts()
    calls = len(aws.calls)
    cloud_accounts.get_accounts()
    assert len(aws.calls) == calls
