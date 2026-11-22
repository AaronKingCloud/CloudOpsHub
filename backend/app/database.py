"""SQLAlchemy database setup for devices, metric history, and alerts.

Configured via ``DATABASE_URL`` (defaults to ``sqlite:///./cloudopshub.db``).
Any SQLAlchemy-supported database (SQLite locally/in Docker, Postgres in RDS)
works without code changes.

User accounts intentionally stay in ``app.auth.database`` (``AUTH_DB_PATH``)
so ``backend/scripts/backup_db.py`` and the DR setup continue working unchanged.
"""

import os
from collections.abc import Generator

from sqlalchemy import Engine, create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DEFAULT_DATABASE_URL = "sqlite:///./cloudopshub.db"


class Base(DeclarativeBase):
    """Base class for all application ORM models."""


_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def _make_engine(url: str) -> Engine:
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True)

    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _set_sqlite_pragmas(dbapi_conn, _connection_record) -> None:
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

    return engine


def configure_database(url: str | None = None) -> Engine:
    """Create (or replace) the SQLAlchemy engine and session factory."""
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()

    resolved_url = url or os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    _engine = _make_engine(resolved_url)
    _SessionLocal = sessionmaker(
        bind=_engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )
    return _engine


def get_engine() -> Engine:
    if _engine is None:
        return configure_database()
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    if _SessionLocal is None:
        configure_database()
    assert _SessionLocal is not None
    return _SessionLocal


def init_app_db() -> None:
    """Create application tables if they do not already exist."""
    import app.models  # noqa: F401  # ensure ORM models are registered on Base.metadata

    engine = get_engine()
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    if inspector.has_table("alerts"):
        cols = {c["name"] for c in inspector.get_columns("alerts")}
        if "rule" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE alerts ADD COLUMN rule VARCHAR(50)"))


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a SQLAlchemy session."""
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()
