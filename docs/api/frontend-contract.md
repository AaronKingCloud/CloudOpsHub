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
