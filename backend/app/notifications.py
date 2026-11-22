"""Notification dispatch for new or escalated critical alerts.

Configured exclusively via environment variables (never hardcoded or user-supplied):
- ``ALERT_WEBHOOK_URL``: HTTPS Discord (or compatible JSON) webhook URL
- ``ALERT_SNS_TOPIC_ARN``: AWS SNS topic ARN (published via boto3)
"""

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)


def _is_safe_webhook_url(url: str) -> bool:
    """Allow only HTTPS webhook URLs with a valid host (SSRF guard)."""
    parsed = urllib.parse.urlparse(url)
    return parsed.scheme == "https" and bool(parsed.netloc)


def _send_webhook(url: str, hostname: str, message: str) -> bool:
    if not _is_safe_webhook_url(url):
        logger.warning("Ignoring ALERT_WEBHOOK_URL: must be an https:// URL")
        return False

    body = json.dumps({"content": f"[CRITICAL] {hostname}: {message}"}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "CloudOpsHub/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return 200 <= getattr(resp, "status", 200) < 300
    except (urllib.error.URLError, OSError, TimeoutError) as exc:
        logger.warning("Webhook notification failed for %s: %s", hostname, exc)
        return False


def _send_sns(topic_arn: str, hostname: str, message: str, rule: str | None) -> bool:
    subject = f"[CloudOps Hub] Critical: {hostname}"[:100]
    full_message = f"{message} (rule: {rule})" if rule else message
    try:
        boto3.client("sns").publish(
            TopicArn=topic_arn,
            Subject=subject,
            Message=full_message,
        )
        return True
    except (BotoCoreError, ClientError) as exc:
        logger.warning("SNS notification failed for %s: %s", hostname, exc)
        return False


def notify_critical_alert(
    hostname: str,
    message: str,
    rule: str | None = None,
) -> list[str]:
    """Send notifications for a critical alert. Returns channels that succeeded."""
    sent: list[str] = []

    webhook_url = os.getenv("ALERT_WEBHOOK_URL", "").strip()
    if webhook_url and _send_webhook(webhook_url, hostname, message):
        sent.append("discord")

    topic_arn = os.getenv("ALERT_SNS_TOPIC_ARN", "").strip()
    if topic_arn and _send_sns(topic_arn, hostname, message, rule):
        sent.append("sns")

    return sent
