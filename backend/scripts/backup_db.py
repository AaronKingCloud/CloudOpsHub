"""Back up and restore the user-accounts database (SQLite).

Uses SQLite's online backup API, so a backup is consistent even while the backend is running.
Every backup is integrity-checked and gets a SHA-256 checksum file next to it.

Usage (from backend/):
    python -m scripts.backup_db backup [--dest backups] [--keep 14]
    python -m scripts.backup_db verify backups/cloudopshub_auth-20261120-190000.db
    python -m scripts.backup_db restore backups/cloudopshub_auth-20261120-190000.db

The database path comes from AUTH_DB_PATH (same as the backend). Restore keeps the current
database as <name>.before-restore so a wrong restore can be undone. Stop the backend before
restoring. Full procedure: docs/operations/DISASTER_RECOVERY.md
"""

import argparse
import hashlib
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

from app.auth import database


class BackupError(Exception):
    pass


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _copy(source: Path, target: Path) -> None:
    """Consistent copy of a SQLite database, safe while it is in use."""
    with sqlite3.connect(source) as src, sqlite3.connect(target) as dst:
        src.backup(dst)
    # sqlite3's context manager commits but does not close; make sure both files are released.
    src.close()
    dst.close()


def verify(path: Path) -> int:
    """Check a backup file; returns the number of user rows. Raises BackupError if it is unusable."""
    if not path.is_file():
        raise BackupError(f"{path} does not exist")
    checksum_file = path.with_name(path.name + ".sha256")
    if checksum_file.is_file() and checksum_file.read_text().split()[0] != _sha256(path):
        raise BackupError(f"{path} does not match its checksum; the file was changed or damaged")
    try:
        conn = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
        try:
            result = conn.execute("PRAGMA integrity_check").fetchone()[0]
            if result != "ok":
                raise BackupError(f"{path} failed the integrity check: {result}")
            return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        finally:
            conn.close()
    except sqlite3.DatabaseError as exc:
        raise BackupError(f"{path} is not a usable database: {exc}") from exc


def backup(dest: Path, keep: int = 14) -> Path:
    """Write a timestamped, verified backup into dest and keep only the newest `keep` backups."""
    source = Path(database.DB_PATH)
    if not source.is_file():
        raise BackupError(f"No database at {source}; nothing to back up")
    dest.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    target = dest / f"{source.stem}-{stamp}.db"
    _copy(source, target)
    target.with_name(target.name + ".sha256").write_text(f"{_sha256(target)}  {target.name}\n")
    verify(target)

    backups = sorted(dest.glob(f"{source.stem}-*.db"))
    for old in backups[:-keep] if keep > 0 else []:
        old.unlink()
        old.with_name(old.name + ".sha256").unlink(missing_ok=True)
    return target


def restore(path: Path) -> Path:
    """Replace the live database with a verified backup. Returns where the old database was kept."""
    verify(path)
    live = Path(database.DB_PATH)
    kept = live.with_name(live.name + ".before-restore")
    if live.is_file():
        shutil.copy2(live, kept)
    for suffix in ("-wal", "-shm"):  # leftovers from the old database must not be replayed
        Path(str(live) + suffix).unlink(missing_ok=True)
    _copy(path, live)
    return kept


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Back up or restore the CloudOps Hub user database.")
    sub = parser.add_subparsers(dest="command", required=True)
    b = sub.add_parser("backup", help="write a new verified backup")
    b.add_argument("--dest", default="backups", type=Path)
    b.add_argument("--keep", default=14, type=int, help="how many backups to keep (default 14)")
    v = sub.add_parser("verify", help="check a backup file")
    v.add_argument("file", type=Path)
    r = sub.add_parser("restore", help="replace the live database with a backup (stop the backend first)")
    r.add_argument("file", type=Path)
    args = parser.parse_args(argv)

    try:
        if args.command == "backup":
            path = backup(args.dest, args.keep)
            print(f"Backup written: {path} ({verify(path)} users)")
        elif args.command == "verify":
            print(f"OK: {args.file} ({verify(args.file)} users)")
        else:
            kept = restore(args.file)
            print(f"Restored {args.file} into {database.DB_PATH} ({verify(Path(database.DB_PATH))} users).")
            print(f"The previous database was kept as {kept}")
    except BackupError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
