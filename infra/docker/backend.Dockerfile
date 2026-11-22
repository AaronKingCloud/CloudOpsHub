# Backend image: FastAPI served by uvicorn.
# Build context is backend/ (see infra/docker-compose.yml).
FROM python:3.13-slim

# Both databases live in /app/data: writable by appuser and mounted as a volume, so they survive rebuilds.
# Without DATABASE_URL the app database would default to /app/cloudopshub.db, which appuser can't create.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AUTH_DB_PATH=/app/data/cloudopshub_auth.db \
    DATABASE_URL=sqlite:////app/data/cloudopshub.db

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY seed.py .
# Backup tool: docker compose exec backend python -m scripts.backup_db backup --dest /app/data/backups
COPY scripts ./scripts

# Run as a non-root user. /app is owned by root, so give appuser its own
# writable folder for the SQLite database (mounted as a volume in compose).
RUN useradd --create-home appuser \
    && mkdir -p /app/data \
    && chown appuser:appuser /app/data
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
