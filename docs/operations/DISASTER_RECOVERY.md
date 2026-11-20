# Disaster Recovery

What CloudOps Hub can lose, how we get it back, how long that takes, and proof that it works.

Last drill: **2026-11-20 — PASS** (details at the end). Update this file after every drill.

## Targets

| | Target | Why |
| --- | --- | --- |
| **RPO** (data we can afford to lose) | ≤ 24 h now; ≤ 5 min once the cloud database exists | Daily backups today; managed-database point-in-time recovery later |
| **RTO** (time to be back up) | ≤ 30 min | Restore is seconds; most of the time is noticing and redeploying |

## What holds data today

| Data | Where | Loss if gone | Protected by |
| --- | --- | --- | --- |
| User accounts, roles, password hashes | SQLite file `AUTH_DB_PATH` (default `backend/cloudopshub_auth.db`) | Nobody can sign in | `scripts/backup_db.py` (below) |
| Source code, docs, CI config | GitHub | – | Git history; every clone is a full copy |
| AWS read-only credentials | Each developer's `~/.aws` (never in Git) | AWS pages stop working | Recreate the access key for `cloudopshub-service` in IAM |
| Dashboard data (devices, alerts, metrics) | Sample data in code (`mock_data.py`) | Nothing to lose yet | Becomes real data with task B1; see "Cloud plan" |

## Back up the user database

From `backend/`:

```bash
python -m scripts.backup_db backup --dest backups --keep 14
```

- Safe while the backend is running (SQLite online backup API).
- Writes `backups/cloudopshub_auth-<UTC time>.db` plus a `.sha256` checksum, checks the copy,
  and keeps the newest 14. The `backups/` folder is git-ignored.
- **Copy backups off the machine** (another disk, or an S3 bucket once A2 exists). A backup on the
  same disk doesn't survive a disk failure.

Schedule it daily:

- **Linux (cron):** `0 3 * * * cd /opt/cloudops/backend && .venv/bin/python -m scripts.backup_db backup`
- **Windows:** Task Scheduler → Daily 03:00 → `.venv\Scripts\python -m scripts.backup_db backup` (start in `backend\`)

## Restore

1. **Stop the backend.**
2. Check the backup you want: `python -m scripts.backup_db verify backups/cloudopshub_auth-<time>.db`
   (prints the number of users; refuses damaged files or a checksum mismatch).
3. Restore: `python -m scripts.backup_db restore backups/cloudopshub_auth-<time>.db`
   The current database is kept as `cloudopshub_auth.db.before-restore`, so a wrong restore can be undone.
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
