# CloudOps Hub — Backend

REST API for the dashboard, built with **Python + FastAPI**.
It currently serves in-memory mock data (`app/mock_data.py`); a database
and real metrics collection will replace it later.

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

# 4. Start the API with auto-reload
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
| GET    | `/api/metrics/cpu`   | CPU time series         |
| GET    | `/api/alerts`        | Active alerts           |
| GET    | `/api/accounts`      | Cloud accounts          |

## Configuration

| Env var        | Default                 | Purpose                                   |
| -------------- | ----------------------- | ----------------------------------------- |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated origins allowed to call the API |

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
