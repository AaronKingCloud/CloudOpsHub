"""Lightweight metrics agent for CloudOps Hub.

Collects CPU, memory, root disk usage, and system uptime using ``psutil`` and
posts them to ``POST /api/agent/metrics`` on the configured interval.

Usage:
    python cloudops_agent.py --server http://localhost:8000/api --key coa_...
    python cloudops_agent.py --server https://hub.example.com/api --key-file /opt/cloudops/agent.key
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import requests


def load_key(key: str | None, key_file: str | None) -> str:
    """Return the trimmed agent key from --key or --key-file."""
    if key is not None:
        cleaned = key.strip()
        if not cleaned:
            raise ValueError("Agent key cannot be empty")
        return cleaned
    if key_file is not None:
        cleaned = Path(key_file).read_text(encoding="utf-8").strip()
        if not cleaned:
            raise ValueError(f"Agent key file is empty: {key_file}")
        return cleaned
    raise ValueError("Either --key or --key-file is required")


def root_disk_path() -> str:
    """Return the root / system drive path for the current OS."""
    return os.path.abspath(os.sep)


def collect_metrics(cpu_sample_interval: float = 1.0) -> dict[str, float | int]:
    """Read current CPU, memory, root disk percentages and uptime in seconds."""
    import psutil

    cpu = round(float(psutil.cpu_percent(interval=cpu_sample_interval)), 1)
    memory = round(float(psutil.virtual_memory().percent), 1)
    storage = round(float(psutil.disk_usage(root_disk_path()).percent), 1)
    uptime_seconds = max(0, int(time.time() - psutil.boot_time()))
    return {
        "cpu": cpu,
        "memory": memory,
        "storage": storage,
        "uptimeSeconds": uptime_seconds,
    }


def send_report(
    server_url: str,
    agent_key: str,
    payload: dict[str, float | int],
    timeout: float = 10.0,
) -> str:
    """Send a single metrics payload. Returns 'ok', 'unauthorized', or 'error'."""
    endpoint = f"{server_url.rstrip('/')}/agent/metrics"
    try:
        resp = requests.post(
            endpoint,
            json=payload,
            headers={"X-Agent-Key": agent_key},
            timeout=timeout,
        )
    except requests.RequestException:
        return "error"

    if 200 <= resp.status_code < 300:
        return "ok"
    if resp.status_code == 401:
        print(
            "Agent key rejected (401 Unauthorized). "
            "Verify --key / --key-file or generate a new key on the device page.",
            file=sys.stderr,
        )
        return "unauthorized"
    return "error"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CloudOps Hub host metrics agent")
    parser.add_argument(
        "--server",
        required=True,
        help="Base API URL (for example http://localhost:8000/api)",
    )
    key_group = parser.add_mutually_exclusive_group(required=True)
    key_group.add_argument("--key", help="Per-device agent key (coa_...)")
    key_group.add_argument("--key-file", help="Path to a file containing the agent key")
    parser.add_argument(
        "--interval",
        type=float,
        default=60.0,
        help="Seconds between reports (default: 60)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Send a single report and exit",
    )
    args = parser.parse_args(argv)
    if args.interval < 1:
        parser.error("--interval must be at least 1 second")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        import psutil  # noqa: F401
    except ImportError:
        print(
            "Missing dependency 'psutil'. Install with: pip install psutil requests",
            file=sys.stderr,
        )
        return 1

    try:
        agent_key = load_key(args.key, args.key_file)
    except (OSError, ValueError) as exc:
        print(f"Failed to load agent key: {exc}", file=sys.stderr)
        return 1

    print(f"CloudOps Hub agent started -> {args.server.rstrip('/')}/agent/metrics (interval={int(args.interval)}s)")
    try:
        while True:
            payload = collect_metrics()
            status = send_report(args.server, agent_key, payload)
            if args.once:
                return 0 if status == "ok" else 1
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("Agent stopped.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
