"""Backup and restore of the user database (scripts/backup_db.py)."""

import uuid
from datetime import datetime, timezone

import pytest

import app.auth.database as db_module
from app.auth.database import get_db, init_db
from scripts.backup_db import BackupError, backup, main, restore, verify


def _add_user(name: str) -> None:
    with get_db() as conn:
        conn.execute(
            """INSERT INTO users (id, username, email, hashed_password, role, is_active, created_at)
               VALUES (?, ?, ?, 'x', 'viewer', 1, ?)""",
            (str(uuid.uuid4()), name, f"{name}@test.local", datetime.now(timezone.utc).isoformat()),
        )


def _usernames() -> set[str]:
    with get_db() as conn:
        return {r["username"] for r in conn.execute("SELECT username FROM users")}


@pytest.fixture(autouse=True)
def live_db(tmp_path, monkeypatch):
    monkeypatch.setattr(db_module, "DB_PATH", str(tmp_path / "cloudopshub_auth.db"))
    init_db()
    _add_user("alice")
    _add_user("bob")


def test_backup_is_verified_and_has_a_checksum(tmp_path):
    path = backup(tmp_path / "backups")
    assert verify(path) == 2
    assert (path.parent / (path.name + ".sha256")).is_file()


def test_restore_brings_back_lost_data(tmp_path):
    path = backup(tmp_path / "backups")
    with get_db() as conn:
        conn.execute("DELETE FROM users")
    _add_user("mallory")

    kept = restore(path)

    assert _usernames() == {"alice", "bob"}
    assert kept.is_file()  # the replaced database is kept, so a wrong restore can be undone


def test_damaged_backup_is_rejected_and_live_db_untouched(tmp_path):
    path = backup(tmp_path / "backups")
    path.write_bytes(path.read_bytes()[:100] + b"garbage")
    with pytest.raises(BackupError, match="checksum"):
        restore(path)
    assert _usernames() == {"alice", "bob"}


def test_non_database_file_is_rejected(tmp_path):
    bogus = tmp_path / "notes.db"
    bogus.write_text("not a database")
    with pytest.raises(BackupError, match="not a usable database"):
        verify(bogus)


def test_keeps_only_the_newest_backups(tmp_path, monkeypatch):
    stamps = iter(f"20261120-0000{i:02d}" for i in range(5))

    class FakeNow:
        @staticmethod
        def strftime(_fmt):
            return next(stamps)

    class FakeDatetime:
        @staticmethod
        def now(_tz):
            return FakeNow()

    monkeypatch.setattr("scripts.backup_db.datetime", FakeDatetime)
    for _ in range(5):
        backup(tmp_path / "backups", keep=3)
    remaining = sorted(p.name for p in (tmp_path / "backups").glob("*.db"))
    assert remaining == [f"cloudopshub_auth-20261120-0000{i:02d}.db" for i in (2, 3, 4)]


def test_command_line_reports_errors_with_exit_code(tmp_path, capsys):
    assert main(["verify", str(tmp_path / "missing.db")]) == 1
    assert "does not exist" in capsys.readouterr().err
