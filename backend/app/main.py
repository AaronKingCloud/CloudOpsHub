import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.database import init_db
from app.routers import dashboard, resources, aws, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="CloudOps Hub API",
    description="Backend API for the CloudOps Hub dashboard. Contract: docs/api/frontend-contract.md",
    version="0.1.0",
    lifespan=lifespan,
)

# Comma-separated list of origins allowed to call the API (the frontend dev server by default).
allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api")
app.include_router(resources.router, prefix="/api")
app.include_router(aws.router, prefix="/api")
app.include_router(auth.router, prefix="/api")


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Liveness check used by Docker / load balancers."""
    return {"status": "ok"}
