"""Measure CloudOps Hub against its performance requirements (docs/demo/DEMO_SCRIPT.md).

Standard library only, so it runs anywhere with Python 3.10+.

    # NFR-P2: API response times (95th percentile)
    python infra/scripts/demo_check.py latency --url https://drk4col17f8z3.cloudfront.net

    # NFR-P3 + NFR-P4: 20 simulated devices reporting every 60 s for 5 minutes, then cleaned up
    python infra/scripts/demo_check.py simulate --url https://drk4col17f8z3.cloudfront.net --devices 20 --minutes 5

Signs in as an admin. The password is read from the DEMO_PASSWORD environment variable, or asked for
(never pass it on the command line). Simulated devices are named demo-sim-NN and are always deleted at
the end, even after Ctrl+C.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import random
import statistics
import sys
import threading
import time
import urllib.error
import urllib.request

DASHBOARD_ENDPOINTS = ["/api/dashboard/summary", "/api/devices", "/api/alerts", "/api/metrics/cpu"]


def request(method: str, url: str, token: str | None = None, body: dict | None = None,
            headers: dict | None = None, timeout: float = 15) -> tuple[int, dict | list | None, float]:
    """Return (status, parsed JSON or None, seconds taken)."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            status = resp.status
    except urllib.error.HTTPError as exc:
        raw, status = exc.read(), exc.code
    took = time.perf_counter() - start
    try:
        parsed = json.loads(raw) if raw else None
    except ValueError:
        parsed = None
    return status, parsed, took


def sign_in(base: str, user: str) -> str:
    password = os.environ.get("DEMO_PASSWORD") or getpass.getpass(f"Password for {user}: ")
    status, body, _ = request("POST", f"{base}/api/auth/login", body={"username": user, "password": password})
    if status != 200 or not isinstance(body, dict):
        sys.exit(f"Sign-in failed ({status}). Check the user, password, and that your IP is allowed.")
    return body["accessToken"]


def percentile(values: list[float], pct: float) -> float:
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round(pct / 100 * len(ordered) + 0.5) - 1))
    return ordered[index]


def cmd_latency(args: argparse.Namespace) -> int:
    token = sign_in(args.url, args.user)
    print(f"{'endpoint':28} {'p50 ms':>8} {'p95 ms':>8} {'max ms':>8}  (n={args.requests} each)")
    worst_p95 = 0.0
    for path in DASHBOARD_ENDPOINTS:
        times = []
        for _ in range(args.requests):
            status, _, took = request("GET", f"{args.url}{path}", token)
            if status != 200:
                sys.exit(f"{path} returned {status}")
            times.append(took * 1000)
        p95 = percentile(times, 95)
        worst_p95 = max(worst_p95, p95)
        print(f"{path:28} {statistics.median(times):8.0f} {p95:8.0f} {max(times):8.0f}")
    verdict = "PASS" if worst_p95 <= 500 else "FAIL"
    print(f"\nNFR-P2 (p95 <= 500 ms): worst p95 = {worst_p95:.0f} ms -> {verdict}")
    print("Note: measured from this machine, so it includes the network round trip to AWS.")
    return 0 if verdict == "PASS" else 1


def cmd_simulate(args: argparse.Namespace) -> int:
    token = sign_in(args.url, args.user)
    created: list[tuple[int, str, str]] = []  # (id, hostname, key)
    stop = threading.Event()
    report_times: list[float] = []
    dashboard_times: list[float] = []
    seen_after: float | None = None
    failures = 0
    lock = threading.Lock()

    def agent(device_key: str) -> None:
        nonlocal failures
        stop.wait(random.uniform(0, args.interval))  # spread devices out like real agents
        while not stop.is_set():
            payload = {"cpu": round(random.uniform(5, 60), 1), "memory": round(random.uniform(20, 70), 1),
                       "storage": round(random.uniform(30, 80), 1), "uptimeSeconds": 3600}
            status, _, took = request("POST", f"{args.url}/api/agent/metrics", body=payload,
                                      headers={"X-Agent-Key": device_key})
            with lock:
                if 200 <= status < 300:
                    report_times.append(took * 1000)
                else:
                    failures += 1
            stop.wait(args.interval)

    try:
        print(f"Creating {args.devices} simulated devices...")
        for n in range(1, args.devices + 1):
            hostname = f"demo-sim-{n:02d}"
            status, body, _ = request("POST", f"{args.url}/api/devices", token,
                                      {"hostname": hostname, "type": "vm", "description": "Temporary load test device"})
            if status != 201 or not isinstance(body, dict):
                raise RuntimeError(f"creating {hostname} returned {status} (left over from an earlier run?)")
            created.append((body["device"]["id"], hostname, body["agentKey"]))

        threads = [threading.Thread(target=agent, args=(key,), daemon=True) for _, _, key in created]
        for t in threads:
            t.start()
        print(f"{args.devices} devices reporting every {args.interval:.0f} s for {args.minutes} min (Ctrl+C stops early)...")

        # Meanwhile, measure how fast the dashboard responds under that load (NFR-P2 under NFR-P3)
        deadline = time.time() + args.minutes * 60
        while time.time() < deadline:
            status, _, took = request("GET", f"{args.url}/api/devices", token)
            if status == 200:
                dashboard_times.append(took * 1000)
            time.sleep(5)

        # NFR-P4: a fresh report shows on the dashboard right away.
        # Stop the simulated agents first so nothing overwrites the probe value (the dashboard shows whole percents).
        stop.set()
        time.sleep(1)
        probe_id, _, probe_key = created[0]
        marker = 42
        request("POST", f"{args.url}/api/agent/metrics", body={"cpu": marker, "memory": 10, "storage": 10,
                                                                 "uptimeSeconds": 1}, headers={"X-Agent-Key": probe_key})
        sent = time.time()
        while time.time() - sent < 90:
            _, devices, _ = request("GET", f"{args.url}/api/devices", token)
            match = [d for d in devices or [] if d.get("id") == probe_id]
            if match and round(float(match[0].get("cpu", -1))) == marker:
                seen_after = time.time() - sent
                break
            time.sleep(2)
    except KeyboardInterrupt:
        print("\nStopped early.")
    finally:
        stop.set()
        print(f"Cleaning up {len(created)} simulated devices...")
        for device_id, _, _ in created:
            request("DELETE", f"{args.url}/api/devices/{device_id}", token)

    total = len(report_times) + failures
    print(f"\nAgent reports: {len(report_times)} ok, {failures} failed"
          + (f", p95 {percentile(report_times, 95):.0f} ms" if report_times else ""))
    if dashboard_times:
        print(f"Dashboard /api/devices under load: p95 {percentile(dashboard_times, 95):.0f} ms "
              f"(n={len(dashboard_times)})")
    p3 = total > 0 and failures == 0
    print(f"NFR-P3 (>= {args.devices} devices every {args.interval:.0f} s, no failures): {'PASS' if p3 else 'FAIL'}")
    if seen_after is not None:
        print(f"NFR-P4 (new reading visible <= 90 s): visible after {seen_after:.1f} s -> PASS")
    else:
        print("NFR-P4 (new reading visible <= 90 s): not seen within 90 s -> FAIL")
    return 0 if p3 and seen_after is not None else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("latency", "simulate"):
        p = sub.add_parser(name)
        p.add_argument("--url", required=True, help="Site address, e.g. https://drk4col17f8z3.cloudfront.net")
        p.add_argument("--user", default="admin", help="Admin username (default: admin)")
    sub.choices["latency"].add_argument("--requests", type=int, default=50, help="Requests per endpoint")
    sub.choices["simulate"].add_argument("--devices", type=int, default=20)
    sub.choices["simulate"].add_argument("--minutes", type=float, default=5)
    sub.choices["simulate"].add_argument("--interval", type=float, default=60, help="Seconds between reports")
    args = parser.parse_args()
    args.url = args.url.rstrip("/")
    return cmd_latency(args) if args.command == "latency" else cmd_simulate(args)


if __name__ == "__main__":
    sys.exit(main())
