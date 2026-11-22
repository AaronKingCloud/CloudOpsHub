"""Backup and restore of the users and app databases (scripts/backup_db.py)."""

import uuid
from datetime import datetime, timezone

import pytest

import app.auth.database as db_module
from app.auth.database import get_db, init_db
from app.database import get_session_factory
from app.models import DeviceModel
from scripts.backup_db import BackupError, backup, kind_of, main, restore, verify


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


def _hostnames() -> set[str]:
    with get_session_factory()() as s:
        return {d.hostname for d in s.query(DeviceModel).all()}


@pytest.fixture(autouse=True)
def live_users_db(tmp_path, monkeypatch):
    # The app database comes from conftest.isolated_app_db (seeded with 5 sample devices).
    monkeypatch.setattr(db_module, "DB_PATH", str(tmp_path / "cloudopshub_auth.db"))
    init_db()
    _add_user("alice")
    _add_user("bob")


def _by_kind(paths):
    return {kind_of(p): p for p in paths}


def test_backs_up_both_databases_with_checksums(tmp_path):
    paths = _by_kind(backup(tmp_path / "backups"))
    assert set(paths) == {"users", "app"}
    assert verify(paths["users"]) == 2
    assert verify(paths["app"]) == len(_hostnames())
    for p in paths.values():
        assert (p.parent / (p.name + ".sha256")).is_file()


def test_backup_and_verify_leave_no_wal_or_shm_files(tmp_path):
    dest = tmp_path / "backups"
    for p in backup(dest):
        verify(p)
    leftovers = [p.name for p in dest.iterdir() if p.name.endswith(("-wal", "-shm"))]
    assert leftovers == []


def test_restore_brings_back_lost_users(tmp_path):
    path = _by_kind(backup(tmp_path / "backups"))["users"]
    with get_db() as conn:
        conn.execute("DELETE FROM users")
    _add_user("mallory")

    kept = restore(path)

    assert _usernames() == {"alice", "bob"}
    assert kept.is_file()  # the replaced database is kept, so a wrong restore can be undone


def test_restore_brings_back_lost_devices(tmp_path):
    before = _hostnames()
    path = _by_kind(backup(tmp_path / "backups"))["app"]
    with get_session_factory()() as s:
        s.query(DeviceModel).delete()
        s.commit()
    assert _hostnames() == set()

    restore(path)

    assert _hostnames() == before


def test_damaged_backup_is_rejected_and_live_db_untouched(tmp_path):
    path = _by_kind(backup(tmp_path / "backups"))["users"]
    path.write_bytes(path.read_bytes()[:100] + b"garbage")
    with pytest.raises(BackupError, match="checksum"):
        restore(path)
    assert _usernames() == {"alice", "bob"}


def test_non_database_file_is_rejected(tmp_path):
    bogus = tmp_path / "notes.db"
    bogus.write_text("not a database")
    with pytest.raises(BackupError, match="not a usable database"):
        verify(bogus)


def test_keeps_only_the_newest_backups_of_each_database(tmp_path, monkeypatch):
    stamps = iter(f"20261122-0000{i:02d}" for i in range(5))

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
    names = sorted(p.name for p in (tmp_path / "backups").glob("*.db"))
    assert names == sorted(
        [f"cloudopshub_auth-20261122-0000{i:02d}.db" for i in (2, 3, 4)]
        + [f"test_app-20261122-0000{i:02d}.db" for i in (2, 3, 4)]
    )


def test_command_line_reports_errors_with_exit_code(tmp_path, capsys):
    assert main(["verify", str(tmp_path / "missing.db")]) == 1
    assert "does not exist" in capsys.readouterr().err
