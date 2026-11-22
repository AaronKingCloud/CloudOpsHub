import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.auth.database import init_db
from app.database import init_app_db
from app.routers import agent, alerts, auth, aws, billing, dashboard, devices, resources


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    init_app_db()
    yield


app = FastAPI(
    title="CloudOps Hub API",
    description="Backend API for the CloudOps Hub dashboard. Contract: docs/api/frontend-contract.md",
    version="0.1.0",
    lifespan=lifespan,
)

# Comma-separated list of origins allowed to call the API (the frontend dev server by default).
allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Browser security headers on every API response (see docs/security/SECURITY_CHECKLIST.md)."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    if request.url.path.startswith("/api/auth"):
        response.headers.setdefault("Cache-Control", "no-store")  # never cache tokens or user data
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api")
app.include_router(agent.router, prefix="/api")
app.include_router(devices.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(resources.router, prefix="/api")
app.include_router(aws.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(billing.router, prefix="/api")


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Liveness check used by Docker / load balancers."""
    return {"status": "ok"}
