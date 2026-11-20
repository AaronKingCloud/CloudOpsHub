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

## Auth

Implemented in `backend/app/routers/auth.py`. Frontend: `frontend/src/services/authService.ts`
and `userService.ts`. Protected endpoints need `Authorization: Bearer <accessToken>`.

| Method | Path              | Who            | Body                                        | Returns |
| ------ | ----------------- | -------------- | ------------------------------------------- | ------- |
| POST   | `/auth/login`     | anyone         | `{ "username", "password" }`                | `{ accessToken, refreshToken, tokenType, user }` |
| POST   | `/auth/refresh`   | anyone         | `{ "refreshToken" }`                        | `{ accessToken, tokenType }` |
| GET    | `/auth/me`        | signed in      | —                                           | `User` |
| GET    | `/auth/users`     | admin          | —                                           | `User[]` (newest first) |
| POST   | `/auth/register`  | admin          | `{ "username", "email", "password", "role" }` | `User` (201); `409` if username/email exists |

Access tokens last 30 minutes, refresh tokens 7 days. The frontend refreshes access tokens
automatically on a `401`.

`User`:

```json
{
  "id": "6f1c…",
  "username": "alice",
  "email": "alice@example.com",
  "role": "operator",
  "isActive": true,
  "createdAt": "2026-11-12T22:40:00+00:00",
  "lastLogin": null
}
```

`role` is `"admin"`, `"operator"`, or `"viewer"`. Register limits: username 3–50 chars,
email 5–255, password 8–128. Validation failures return `422` with a `detail` list.


---

# Proposed endpoints (frontend ready, backend to build)

The frontend for these already exists and works in mock mode (`VITE_USE_MOCK=true`). The backend
tasks are in `docs/REMAINING_WORK.md` (B2–B5). **Building to these shapes means the screens work
with no frontend changes.** If something here doesn't fit the backend design, change it here first
and tell Tirth, so both sides move together.

The frontend copes with today's backend in the meantime: missing optional fields are hidden, a `404`
on device history shows "History isn't available from the backend yet", and alerts without `status`
are treated as open.

## Devices (proposed · B2)

`Device` gains optional fields (existing fields unchanged):

```json
{
  "id": 2,
  "hostname": "nas-01",
  "status": "online",
  "cpu": 12,
  "memory": 35,
  "storage": 91,
  "type": "nas",
  "ipAddress": "192.168.1.30",
  "description": "Synology NAS, backups and media",
  "lastSeen": "2026-11-20T19:20:00+00:00"
}
```

`type` is `"server"`, `"vm"`, `"container"`, `"nas"` or `"service"`. `ipAddress`, `description` and
`lastSeen` may be `null`. `lastSeen` is when the agent last reported (`null` = never).

| Method | Path | Who | Body | Returns |
| --- | --- | --- | --- | --- |
| GET | `/devices` | signed in | – | `Device[]` |
| GET | `/devices/{id}` | signed in | – | `Device`, `404` if missing |
| POST | `/devices` | admin | `{ "hostname", "type", "ipAddress"?, "description"? }` | `201` `{ "device": Device, "agentKey": "coa_…" }`, `409` if the hostname exists |
| PUT | `/devices/{id}` | admin | same as POST | `Device` |
| DELETE | `/devices/{id}` | admin | – | `204` (also deletes its metrics and alerts) |
| POST | `/devices/{id}/agent-key` | admin | – | `{ "agentKey": "coa_…" }`; the old key stops working |
| GET | `/devices/{id}/metrics?metric=cpu&hours=24` | signed in | – | `MetricPoint[]` (`metric`: `cpu` \| `memory` \| `storage`; `hours`: 1–168) |

- A new device starts `"offline"` with `cpu`/`memory`/`storage` = 0 until its agent reports.
- **Agent keys are shown once.** Store only a hash (like passwords); never return the key again.
  Format used by the mock: `coa_` + 32 hex characters.
- Metrics: 5-minute points up to 24 h, hourly beyond, oldest first, `timestamp` as `"HH:MM"`
  (or `"20 Nov 14:00"` beyond 24 h), same shape as `/metrics/cpu`.

## Agent reports (proposed · B3)

`POST /agent/metrics` with header `X-Agent-Key: coa_…` (no user login):

```json
{ "cpu": 23.5, "memory": 61.2, "storage": 74.0, "uptimeSeconds": 86400 }
```

Returns `204`. `401` for an unknown key. Sets the device `online`, updates its current values and
`lastSeen`, and stores a history point. The agent sends every 60 s; the backend marks a device
`offline` after 3 missed reports. Install guide: `docs/agent/INSTALL.md`.

## Alerts (proposed · B4)

`Alert` gains optional fields:

```json
{
  "id": 3,
  "severity": "warning",
  "message": "proxmox-host memory above 70%",
  "deviceId": 3,
  "status": "acknowledged",
  "createdAt": "2026-11-20T19:05:00+00:00",
  "acknowledgedBy": "operator",
  "resolvedAt": null
}
```

`status` is `"open"`, `"acknowledged"` or `"resolved"`.

| Method | Path | Who | Returns |
| --- | --- | --- | --- |
| GET | `/alerts` | signed in | open + acknowledged alerts |
| GET | `/alerts?status=all` | signed in | including resolved (history) |
| POST | `/alerts/{id}/acknowledge` | operator, admin | updated `Alert` (`acknowledgedBy` = current user) |
| POST | `/alerts/{id}/resolve` | operator, admin | updated `Alert` (`resolvedAt` set) |

`/dashboard/summary` `activeAlerts` should count open + acknowledged.

## Login on every endpoint (proposed · B5)

Every endpoint except `/health`, `/auth/login`, `/auth/refresh` and `/agent/metrics` should return
`401` without a valid token. The frontend is ready: on a `401` with nobody signed in it shows the
sign-in screen, and it hides buttons each role can't use (`frontend/src/utils/permissions.ts`):

| Action | Roles |
| --- | --- |
| Manage users, manage devices (add / edit / delete / new agent key) | admin |
| Acknowledge and resolve alerts | admin, operator |
| View everything | admin, operator, viewer |
