"""Back up and restore CloudOps Hub's SQLite databases.

There are two:
  * users  - accounts, roles, password hashes (AUTH_DB_PATH)
  * app    - devices, metric history, alerts  (DATABASE_URL, when it points at SQLite)

Uses SQLite's online backup API, so a backup is consistent even while the backend is running.
Every backup is integrity-checked and gets a SHA-256 checksum file next to it. Backups are stored
in rollback-journal mode, so checking or opening one never leaves -wal / -shm files behind.

Usage (from backend/, with the same AUTH_DB_PATH / DATABASE_URL the backend uses):
    python -m scripts.backup_db backup [--dest backups] [--keep 14]   # both databases
    python -m scripts.backup_db verify backups/<file>.db
    python -m scripts.backup_db restore backups/<file>.db             # stop the backend first

`restore` works out from the file's tables which database it belongs to, and keeps the current one
as <name>.before-restore so a wrong restore can be undone. When DATABASE_URL points at Postgres, the
app database is skipped: use the managed database's own backups (see the DR doc).
Full procedure: docs/operations/DISASTER_RECOVERY.md
"""

import argparse
import hashlib
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

from app import database as app_database
from app.auth import database as auth_database

# Which table identifies each database, and the backup file name prefix.
KINDS = {"users": "users", "app": "devices"}


class BackupError(Exception):
    pass


def targets() -> dict[str, Path]:
    """The live SQLite database files, by kind. The app database is left out when it isn't SQLite."""
    found = {"users": Path(auth_database.DB_PATH)}
    url = app_database.get_engine().url
    if url.get_backend_name() == "sqlite" and url.database and url.database != ":memory:":
        found["app"] = Path(url.database)
    return found


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _copy(source: Path, target: Path, journal: str) -> None:
    """Consistent copy of a SQLite database, safe while it is in use."""
    src = sqlite3.connect(source)
    dst = sqlite3.connect(target)
    try:
        src.backup(dst)
        # The copy inherits the source's WAL mode; switch it so the file is self-contained.
        dst.execute(f"PRAGMA journal_mode={journal}")
    finally:
        dst.close()
        src.close()


def _open_readonly(path: Path) -> sqlite3.Connection:
    # immutable=1: never write anything (no -wal / -shm), even for older WAL-mode backups.
    return sqlite3.connect(f"file:{path.as_posix()}?mode=ro&immutable=1", uri=True)


def kind_of(path: Path) -> str:
    """'users' or 'app', from the tables inside the file."""
    if not path.is_file():
        raise BackupError(f"{path} does not exist")
    try:
        conn = _open_readonly(path)
        try:
            tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        finally:
            conn.close()
    except sqlite3.DatabaseError as exc:
        raise BackupError(f"{path} is not a usable database: {exc}") from exc
    for kind, table in KINDS.items():
        if table in tables:
            return kind
    raise BackupError(f"{path} is not a CloudOps Hub database (no users or devices table)")


def verify(path: Path) -> int:
    """Check a backup file; returns the row count of its main table. Raises BackupError if unusable."""
    if not path.is_file():
        raise BackupError(f"{path} does not exist")
    checksum_file = path.with_name(path.name + ".sha256")
    if checksum_file.is_file() and checksum_file.read_text().split()[0] != _sha256(path):
        raise BackupError(f"{path} does not match its checksum; the file was changed or damaged")
    try:
        kind = kind_of(path)
        conn = _open_readonly(path)
        try:
            result = conn.execute("PRAGMA integrity_check").fetchone()[0]
            if result != "ok":
                raise BackupError(f"{path} failed the integrity check: {result}")
            return conn.execute(f"SELECT COUNT(*) FROM {KINDS[kind]}").fetchone()[0]
        finally:
            conn.close()
    except sqlite3.DatabaseError as exc:
        raise BackupError(f"{path} is not a usable database: {exc}") from exc


def _prune(dest: Path, stem: str, keep: int) -> None:
    if keep <= 0:
        return
    for old in sorted(dest.glob(f"{stem}-*.db"))[:-keep]:
        old.unlink()
        old.with_name(old.name + ".sha256").unlink(missing_ok=True)


def backup(dest: Path, keep: int = 14) -> list[Path]:
    """Write a timestamped, verified backup of every SQLite database; keep the newest `keep` of each."""
    dest.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    written = []
    for kind, source in targets().items():
        if not source.is_file():
            raise BackupError(f"No {kind} database at {source}; nothing to back up")
        target = dest / f"{source.stem}-{stamp}.db"
        _copy(source, target, journal="DELETE")
        target.with_name(target.name + ".sha256").write_text(f"{_sha256(target)}  {target.name}\n")
        verify(target)
        _prune(dest, source.stem, keep)
        written.append(target)
    return written


def restore(path: Path) -> Path:
    """Replace the matching live database with a verified backup. Returns where the old one was kept."""
    verify(path)
    kind = kind_of(path)
    live_targets = targets()
    if kind not in live_targets:
        raise BackupError("DATABASE_URL doesn't point at SQLite here; restore the app database with its own tools")
    live = live_targets[kind]
    if kind == "app":
        # Release this process's own connections so the file can be replaced (Windows locks open files).
        app_database.get_engine().dispose()
    kept = live.with_name(live.name + ".before-restore")
    if live.is_file():
        shutil.copy2(live, kept)
    for suffix in ("-wal", "-shm"):  # leftovers from the old database must not be replayed
        Path(str(live) + suffix).unlink(missing_ok=True)
    _copy(path, live, journal="WAL")
    return kept


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Back up or restore the CloudOps Hub databases.")
    sub = parser.add_subparsers(dest="command", required=True)
    b = sub.add_parser("backup", help="write new verified backups of both databases")
    b.add_argument("--dest", default="backups", type=Path)
    b.add_argument("--keep", default=14, type=int, help="how many backups of each database to keep (default 14)")
    v = sub.add_parser("verify", help="check a backup file")
    v.add_argument("file", type=Path)
    r = sub.add_parser("restore", help="replace the matching live database with a backup (stop the backend first)")
    r.add_argument("file", type=Path)
    args = parser.parse_args(argv)

    try:
        if args.command == "backup":
            for path in backup(args.dest, args.keep):
                print(f"Backup written: {path} ({kind_of(path)}, {verify(path)} rows)")
            if "app" not in targets():
                print("App database is not SQLite (DATABASE_URL); back it up with the database's own tools.")
        elif args.command == "verify":
            rows = verify(args.file)
            print(f"OK: {args.file} ({kind_of(args.file)} database, {rows} rows)")
        else:
            kept = restore(args.file)
            kind = kind_of(args.file)
            print(f"Restored the {kind} database from {args.file} into {targets()[kind]}.")
            print(f"The previous database was kept as {kept}")
    except BackupError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
