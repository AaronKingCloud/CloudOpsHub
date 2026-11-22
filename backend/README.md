# CloudOps Hub — Backend

REST API for the dashboard, built with **Python + FastAPI** and **SQLAlchemy**.
Devices, metric history, and alerts are stored in a SQLite/Postgres database (`DATABASE_URL`);
cloud accounts still use sample data in `app/mock_data.py`.

## Run it

```bash
cd backend

# 1. Create a virtual environment (first time only)
python -m venv .venv

# 2. Activate it
#    Windows (PowerShell):  .venv\Scripts\Activate.ps1
#    Windows (Git Bash):    source .venv/Scripts/activate
#    macOS / Linux:         source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements-dev.txt

# 4. Seed demo users + sample devices, metrics and alerts (first time only)
python -m seed

# 5. Start the API with auto-reload
fastapi dev app/main.py        # http://localhost:8000
```

- Interactive API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Run the tests

```bash
pytest
```

## Connect the frontend

In `frontend/.env.local`:

```
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:8000/api
```

## Endpoints

All endpoints are under `/api`. Full shapes: [`docs/api/frontend-contract.md`](../docs/api/frontend-contract.md).

| Method | Path                 | Returns                 |
| ------ | -------------------- | ----------------------- |
| GET    | `/health`            | `{"status": "ok"}`      |
| GET    | `/api/dashboard/summary` | Device / alert counts |
| GET    | `/api/devices`       | List of devices         |
| GET    | `/api/devices/{id}`  | Single device details (requires login) |
| POST   | `/api/devices`       | Create device + one-time agent key (admin) |
| PUT    | `/api/devices/{id}`  | Update device metadata (admin) |
| DELETE | `/api/devices/{id}`  | Delete device and its history (admin) |
| POST   | `/api/devices/{id}/agent-key` | Rotate device agent key (admin) |
| GET    | `/api/devices/{id}/metrics` | Per-device CPU/memory/storage history (requires login) |
| POST   | `/api/agent/metrics` | Ingest device CPU/memory/disk/uptime (`X-Agent-Key`) |
| GET    | `/api/metrics/cpu`   | CPU time series         |
| GET    | `/api/metrics/memory` | Memory time series     |
| GET    | `/api/metrics/storage` | Storage time series   |
| GET    | `/api/alerts`        | Active alerts           |
| GET    | `/api/accounts`      | Cloud accounts          |
| GET    | `/api/billing/summary` | AWS cost summary (cached, requires login) |

## Configuration

| Env var        | Default                 | Purpose                                   |
| -------------- | ----------------------- | ----------------------------------------- |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated origins allowed to call the API |
| `APP_ENV`      | `development`           | Set to `production` when deployed          |
| `DATABASE_URL` | `sqlite:///./cloudopshub.db` | SQLAlchemy database URL for devices, metrics and alerts (SQLite locally, Postgres in RDS) |
| `JWT_SECRET`   | dev-only placeholder    | Token signing key. **Required** when `APP_ENV=production`; the backend refuses to start without it |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30`     | Access token lifetime (the frontend refreshes it automatically) |
| `REFRESH_TOKEN_EXPIRE_DAYS`   | `7`      | How long a user stays signed in        |
| `AUTH_DB_PATH` | `cloudopshub_auth.db`   | SQLite file holding user accounts          |
| `LOGIN_MAX_ATTEMPTS` | `5`               | Failed logins per username + address before a lockout |
| `LOGIN_WINDOW_SECONDS` | `900`           | Lockout window in seconds (15 minutes)     |
| `BILLING_CACHE_SECONDS` | `21600`        | How long `/api/billing/summary` caches AWS Cost Explorer results in memory (6 hours; set `0` to disable) |
| `AGENT_OFFLINE_SECONDS` | `180`          | Seconds without an agent report before a device is marked `offline` (3 minutes) |

Generate a production secret with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

## Backups

```bash
python -m scripts.backup_db backup     # verified, timestamped copy of the user database in backups/
python -m scripts.backup_db restore backups/<file>.db   # stop the backend first
```

Procedure, targets and drill results: [`docs/operations/DISASTER_RECOVERY.md`](../docs/operations/DISASTER_RECOVERY.md).

## Folder layout

```
backend/
├── app/
│   ├── main.py         App setup, CORS, router registration
│   ├── schemas.py      Pydantic response models (snake_case in Python, camelCase in JSON)
│   ├── mock_data.py    Temporary in-memory data
│   └── routers/        One file per group of endpoints
├── tests/              pytest tests
├── requirements.txt    Runtime dependencies
└── requirements-dev.txt  Runtime + test dependencies
```

## Adding an endpoint

1. Add / update the model in `app/schemas.py`
2. Add the route in `app/routers/` (register new router files in `app/main.py`)
3. Add a test in `tests/`
4. Document it in `docs/api/frontend-contract.md` and add the matching frontend type
