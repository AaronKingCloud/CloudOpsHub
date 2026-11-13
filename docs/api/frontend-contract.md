# Frontend API Contract

The agreed shapes of data exchanged between `frontend/` and `backend/`.

- **Base URL:** `http://localhost:8000/api` (configurable via `VITE_API_URL`)
- **Format:** JSON
- **Frontend types:** `frontend/src/types/Dashboard.ts`, `frontend/src/types/Account.ts`
- **Backend schemas:** `backend/app/schemas.py`

> If you change a shape, update **this file, the frontend types, and the backend schemas** in the same PR.

---

## Dashboard Summary

`GET /dashboard/summary`

```json
{
  "onlineDevices": 15,
  "offlineDevices": 2,
  "activeAlerts": 3,
  "totalDevices": 17
}
```

## Devices

`GET /devices`

`status` is `"online"` or `"offline"`. `cpu`, `memory`, `storage` are percentages (0–100).

```json
[
  {
    "id": 1,
    "hostname": "plex-server",
    "status": "online",
    "cpu": 25,
    "memory": 48,
    "storage": 62
  }
]
```

## CPU Metrics

`GET /metrics/cpu`

```json
[
  {
    "timestamp": "10:00",
    "value": 25
  }
]
```

## Alerts

`GET /alerts`

`severity` is `"info"`, `"warning"`, or `"critical"`.

```json
[
  {
    "id": 1,
    "severity": "critical",
    "message": "Storage exceeds 90%"
  }
]
```

## Accounts

`GET /accounts`

Cloud accounts / subscriptions being monitored (see `docs/architecture/account-model.md`).
`status` is `"Healthy"`, `"Warning"`, or `"Critical"`.

```json
[
  {
    "id": 1,
    "provider": "AWS",
    "accountName": "AWS Production",
    "status": "Critical",
    "alertCount": 2,
    "lastUpdated": "2026-10-15 13:00"
  }
]
```

## AWS (live)

All `/aws/*` routes require a logged-in user (`Authorization: Bearer <accessToken>`).
If AWS rejects a call (missing permissions, restricted account), the API returns
`502` with AWS's error message in `detail`.

### Account

`GET /aws/account`

The AWS identity the backend is connected as (`sts:GetCallerIdentity`).

```json
{
  "accountId": "123456789012",
  "userName": "cloudopshub-service",
  "arn": "arn:aws:iam::123456789012:user/cloudopshub-service"
}
```

### EC2 Instances

`GET /aws/ec2`

```json
[
  {
    "instanceId": "i-0abc123def4567890",
    "name": "web-01",
    "state": "running",
    "instanceType": "t3.micro",
    "availabilityZone": "us-east-1a",
    "privateIp": "172.31.20.15",
    "launchTime": "2026-11-11T22:14:03+00:00"
  }
]
```

`privateIp` may be `null` (e.g. stopped instances).

### EC2 CPU Utilization

`GET /aws/ec2/{instanceId}/cpu?hours=3`

CloudWatch `CPUUtilization` averaged over 5-minute periods. `hours` is 1–24 (default 3).
Same shape as `GET /metrics/cpu`, so it can feed the existing CPU chart.

```json
[
  { "timestamp": "21:05", "value": 4.2 },
  { "timestamp": "21:10", "value": 3.8 }
]
```