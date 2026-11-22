"""Tests for backend/seed.py (Windows cp1252 output safety and idempotency)."""

import os
import subprocess
import sys
from pathlib import Path

import app.auth.database as db_module
from seed import SEED_USERS, seed

BACKEND_DIR = Path(__file__).resolve().parent.parent


def test_seed_idempotent_and_cp1252_safe(tmp_path, monkeypatch, capsys):
    """seed() creates default users once, skips on repeat, and emits cp1252-safe text."""
    monkeypatch.setattr(db_module, "DB_PATH", str(tmp_path / "seed_test.db"))

    seed()
    first_out = capsys.readouterr().out
    first_out.encode("cp1252")
    assert "[ok]" in first_out
    assert "Default credentials:" in first_out

    with db_module.get_db() as conn:
        usernames = {row["username"] for row in conn.execute("SELECT username FROM users").fetchall()}
    assert usernames == {u["username"] for u in SEED_USERS}

    seed()
    second_out = capsys.readouterr().out
    second_out.encode("cp1252")
    assert "[skip]" in second_out


def test_seed_cli_under_cp1252(tmp_path):
    """python -m seed succeeds when stdout uses cp1252 encoding (Windows redirect)."""
    env = os.environ.copy()
    env["AUTH_DB_PATH"] = str(tmp_path / "cli_seed.db")
    env["PYTHONIOENCODING"] = "cp1252"

    result = subprocess.run(
        [sys.executable, "-m", "seed"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        encoding="cp1252",
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert "Default credentials:" in result.stdout
