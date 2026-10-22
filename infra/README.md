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
└── terraform/                  Cloud infrastructure (not started, see terraform/README.md)
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

## How the containers talk

```
Browser ──► frontend (nginx :80, published on :8080)
              ├── /        → static React build
              └── /api/*   → backend:8000/api/*  (FastAPI)
```

The frontend image is built with `VITE_USE_MOCK=false` and `VITE_API_URL=/api`,
so in Docker it always uses the real backend through the nginx proxy.

## Status

- `docker compose config` validates.
- ⚠️ The images have **not yet been built and run** end-to-end. Whoever first runs
  `docker compose up --build`, please note the result in `docs/PROGRESS.md`.
