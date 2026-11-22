"""Temporary in-memory cloud account data.

Devices, metrics, and alerts now live in the SQLAlchemy database
(see ``app/database.py`` and ``app/models.py``); ``ACCOUNTS`` remains
sample data until a real multi-account feature is added.
"""

from app.schemas import Account

ACCOUNTS = [
    Account(id=1, provider="AWS", account_name="AWS Production", status="Critical",
            alert_count=2, last_updated="2026-10-15 13:00"),
    Account(id=2, provider="AWS", account_name="AWS Sandbox", status="Healthy",
            alert_count=0, last_updated="2026-10-15 13:00"),
    Account(id=3, provider="Azure", account_name="Azure Development", status="Warning",
            alert_count=1, last_updated="2026-10-15 13:00"),
    Account(id=4, provider="Azure", account_name="Azure Production", status="Healthy",
            alert_count=0, last_updated="2026-10-15 13:00"),
]
