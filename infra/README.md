# CloudOps Hub — Infrastructure

Everything needed to package and deploy the app lives here, so `frontend/`
and `backend/` contain only application code.

```
infra/
├── docker-compose.yml          Runs frontend + backend together locally
├── docker/
│   ├── backend.Dockerfile      Python 3.13 + uvicorn, runs as non-root, has a healthcheck
│   ├── frontend.Dockerfile     Builds the Vite app, serves it with nginx
│   ├── nginx.conf              Serves the SPA and proxies /api → backend
│   └── *.dockerignore          Per-Dockerfile ignore files
└── terraform/                  Cloud infrastructure (see terraform/README.md)
```

## Run the full stack with Docker

Requires Docker Desktop (or Docker Engine + Compose v2).

```bash
cd infra
docker compose up --build
```

| Service  | URL                          |
| -------- | ---------------------------- |
| Frontend | http://localhost:8080        |
| Backend  | http://localhost:8000/docs   |

Stop with `Ctrl+C`, then `docker compose down`.

### Demo users

The user database starts empty. Create admin / operator / viewer (passwords in `backend/seed.py`):

```bash
docker compose exec backend python -m seed
```

Users are stored in the `backend-data` volume (`/app/data` in the container), so they survive
`docker compose down` / `up` and rebuilds. `docker compose down -v` deletes them.

### Backups

The backup tool from `docs/operations/DISASTER_RECOVERY.md` is included in the image:

```bash
docker compose exec backend python -m scripts.backup_db backup --dest /app/data/backups
```

### AWS pages locally

The containers have no AWS credentials, so the **AWS Cloud** page shows a "no AWS credentials"
error locally. That's expected; in AWS the backend uses its instance role (see `terraform/`).

## How the containers talk

```
Browser ──► frontend (nginx :80, published on :8080)
              ├── /        → static React build
              └── /api/*   → backend:8000/api/*  (FastAPI)
```

The frontend image is built with `VITE_USE_MOCK=false` and `VITE_API_URL=/api`,
so in Docker it always uses the real backend through the nginx proxy.

## Status

Tested 2026-11-20 by Aaron (Docker Desktop 29.3.1, Windows 11):

| Check | Result |
| --- | --- |
| `docker compose config --quiet` | ✅ Valid |
| `docker compose up --build` | ✅ Both containers healthy |
| Seed users, sign in at http://localhost:8080 | ✅ Login works; dashboard shows **Live backend** data |
| `docker compose down` then `up` | ✅ Users still there (volume) |
| Backup tool in the container | ✅ Backup written and verified (3 users) |
| `curl -I http://localhost:8080` | ✅ `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` present |
| Browser console on all pages | ✅ No CSP errors |

The same images also run on AWS (`terraform/envs/dev`).
