# Disaster Recovery

What CloudOps Hub can lose, how we get it back, how long that takes, and proof that it works.

Last drill: **2026-11-22 — PASS, both databases** (details at the end). Update this file after every drill.

## Targets

| | Target | Why |
| --- | --- | --- |
| **RPO** (data we can afford to lose) | ≤ 24 h now; ≤ 5 min once the cloud database exists | Daily backups today; managed-database point-in-time recovery later |
| **RTO** (time to be back up) | ≤ 30 min | Restore is seconds; most of the time is noticing and redeploying |

## What holds data today

| Data | Where | Loss if gone | Protected by |
| --- | --- | --- | --- |
| User accounts, roles, password hashes | SQLite file `AUTH_DB_PATH` (default `backend/cloudopshub_auth.db`; `/app/data/` in Docker) | Nobody can sign in | `scripts/backup_db.py` (below) |
| Devices, metric history, alerts, agent key hashes | SQLite file from `DATABASE_URL` (default `backend/cloudopshub.db`; must be under `/app/data/` in Docker) | Dashboard empty; every agent needs a new key | `scripts/backup_db.py` (below); Postgres: its own backups |
| Source code, docs, CI config | GitHub | – | Git history; every clone is a full copy |
| AWS read-only credentials | Each developer's `~/.aws` (never in Git) | AWS pages stop working | Recreate the access key for `cloudopshub-service` in IAM |

## Back up the databases

From `backend/`:

```bash
python -m scripts.backup_db backup --dest backups --keep 14
```

- Backs up **both** databases in one run: `cloudopshub_auth-<UTC time>.db` (users) and
  `cloudopshub-<UTC time>.db` (devices, metrics, alerts). Uses the same `AUTH_DB_PATH` / `DATABASE_URL`
  as the backend, so run it with the backend's settings.
- Safe while the backend is running (SQLite online backup API).
- Each file gets a `.sha256` checksum and is checked after writing; the newest 14 of each are kept.
  Backups never leave `-wal` / `-shm` files behind. The `backups/` folder is git-ignored.
- In Docker: `docker compose exec backend python -m scripts.backup_db backup --dest /app/data/backups`.
- If `DATABASE_URL` points at Postgres, only the users database is backed up here; use the managed
  database's own backups for the rest (see "Cloud plan").
- **Copy backups off the machine** (another disk, or an S3 bucket once A2 exists). A backup on the
  same disk doesn't survive a disk failure.

Schedule it daily:

- **Linux (cron):** `0 3 * * * cd /opt/cloudops/backend && .venv/bin/python -m scripts.backup_db backup`
- **Windows:** Task Scheduler → Daily 03:00 → `.venv\Scripts\python -m scripts.backup_db backup` (start in `backend\`)

## Restore

1. **Stop the backend.**
2. Check the backup you want: `python -m scripts.backup_db verify backups/<file>.db`
   (prints which database it is and its row count; refuses damaged files or a checksum mismatch).
3. Restore: `python -m scripts.backup_db restore backups/<file>.db`. The tool tells from the file's tables
   whether it's the users or the app database and replaces the right one. To recover everything, restore
   one file of each from the **same time**. The current database is kept as `<name>.before-restore`,
   so a wrong restore can be undone.
4. Start the backend and sign in to confirm.
5. Note what happened and how long it took in the drill log below.

## Scenarios

| Scenario | Do this | Expected time |
| --- | --- | --- |
| Database file deleted or corrupted | Restore the latest backup | < 5 min |
| Bad change (e.g. users deleted by mistake) | Restore the backup from before the change | < 5 min, lose changes since that backup |
| Server / VM lost | New machine → clone repo → install backend (README) → restore latest off-machine backup | < 30 min |
| AWS key leaked | IAM → deactivate the `cloudopshub-service` key → create a new one → update `~/.aws` | < 15 min |
| `JWT_SECRET` leaked | Set a new `JWT_SECRET` and restart; all sessions sign out, everyone signs in again | < 5 min |
| GitHub unavailable | Keep working from local clones; push when it's back | – |

## Cloud plan (after tasks A3 + B1)

- **Database:** use the managed database's automated backups with point-in-time recovery
  (e.g. RDS, 7-day retention) → RPO ≤ 5 min. Take a manual snapshot before every risky migration.
- **Infrastructure:** everything in Terraform (A2/A3), so a lost environment is rebuilt with `terraform apply`.
- **Backups off-site:** S3 bucket with versioning and a lifecycle rule; block public access.
- **Drill:** restore a snapshot into a new database, point a test backend at it, sign in, compare row
  counts; record it below. Repeat each month and before the final demo.

## Drill log

### 2026-11-22 — both databases, local — PASS (Tirth)

Real backend with throwaway users and app databases. Created a user, a device and one real agent report through
the API, backed up both databases while the backend ran, stopped it and **deleted both database files**, restored
both and restarted.

| Step | Result |
| --- | --- |
| Create user `drilluser`, device `drill-vm`, one agent report | 201 / 201 / 204 |
| Backup of both databases (backend running) | 730 ms · users: 4 rows · app: 6 devices |
| Leftover `-wal` / `-shm` files in the backup folder | 0 (Aaron's report fixed) |
| Disaster: both database files deleted | gone |
| Restore both | 1.3 s |
| Backend restart | 1.8 s |
| `drilluser` signs in | 200, role operator |
| Device `drill-vm` and its history | back: CPU 42 %, 1 history point |
| **Total recovery (restore + restart + checks)** | **3.7 s** — target 30 min |

Automated tests: `backend/tests/test_backup.py` (8 tests: both databases, restore of lost users and lost
devices, no leftover files, damaged backup rejected, keep-newest-N, CLI errors).


### 2026-11-20 — user database, local — PASS (Tirth)

Real backend on a throwaway database. A user was created through the API, the database was backed up,
the backend stopped and the database file **deleted**, then restored and the backend restarted.

| Step | Result |
| --- | --- |
| Create user `drilluser` (operator) via `POST /api/auth/register` | 201 |
| Backup while the backend was running | 137 ms, verified, 4 users |
| Disaster: database file deleted | gone |
| Restore from backup | 120 ms |
| Backend restart | 1.2 s |
| `drilluser` signs in | 200, role operator |
| **Total recovery (restore + restart + check)** | **1.6 s** — well within the 30 min RTO |

RPO in this drill: 0 (no changes between backup and failure). In practice it is the time since the
last backup, so ≤ 24 h with a daily schedule.

Automated tests for the same tool: `backend/tests/test_backup.py` (restore after data loss, damaged
backup rejected, checksum check, keep-newest-N).
