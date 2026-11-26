# Disaster Recovery

What CloudOps Hub can lose, how we get it back, how long that takes, and proof that it works.

Last drill: **2026-11-24 — PASS, both databases, cloud snapshot: RTO 55 s, RPO 17 h 55 min** (details at the end). Update this file after every drill.

## Targets

| | Target | Why |
| --- | --- | --- |
| **RPO** (data we can afford to lose) | ≤ 24 h now; ≤ 5 min once the cloud database exists | Daily backups and cloud snapshots today; managed-database point-in-time recovery later |
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
  database's own backups for the rest.
- **Copy backups off the machine** (another disk or an S3 bucket; in the cloud, the daily snapshots do this). A backup on the
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
| Cloud server lost | `terraform apply -replace=aws_instance.app`; the data disk is kept | 2–5 min |
| Cloud data disk lost or damaged | Volume from the newest snapshot (below) | < 30 min, lose changes since that snapshot |
| Server / VM lost (not on AWS) | New machine → clone repo → install backend (README) → restore latest off-machine backup | < 30 min |
| AWS key leaked | IAM → deactivate the `cloudopshub-service` key → create a new one → update `~/.aws` | < 15 min |
| `JWT_SECRET` leaked | Set a new `JWT_SECRET` and restart (cloud: `infra/terraform/README.md` → Rotating the JWT secret); all sessions sign out, everyone signs in again | < 5 min |
| GitHub unavailable | Keep working from local clones; push when it's back | – |

## In the cloud (A3)

| | How |
| --- | --- |
| **Where the data is** | Both SQLite databases on their own encrypted EBS disk (`cloudopshub-dev-data`), mounted at `/srv/cloudopshub-data` = the backend's `/app/data`. Replacing the server keeps it (tested by Aaron) |
| **Backups** | Automatic snapshot of that disk every day at 07:00 UTC, newest 7 kept → **RPO ≤ 24 h** |
| **Server lost** | `terraform apply -replace=aws_instance.app`: a new server attaches the same disk (2–5 min) |
| **Disk lost or data damaged** | Create a volume from a snapshot and make it the live disk (`infra/terraform/README.md` → Restoring from a snapshot) |
| **Bad deploy** | CD rolls back on its own within 2 minutes |
| **Not covered yet** | Losing the whole Region (snapshots stay in us-east-2) |

### Cloud drill (C7): restore a snapshot next to the live site

Proves a snapshot really contains working databases **without touching the live site**: a copy of the disk is attached to
the server as an extra disk, and a second, private backend runs on it. Needs the AWS CLI with the team's admin profile
(Aaron) and at least one snapshot. Cost: a few cents (5 GB volume for under an hour), **as long as step 6 is done**.
Run the commands in Git Bash, with a stopwatch.

> Don't reboot or rebuild the server during the drill: both disks have the same filesystem ID until the copy is detached.

**1. Before: note what's live.** Sign in to the site: devices ____, users ____. Pick something that existed before the last 07:00 UTC snapshot.

**2. Start the stopwatch. Newest snapshot → new volume → attach it**

```bash
export AWS_PROFILE=cloudopshub-admin AWS_DEFAULT_REGION=us-east-2
read -r INSTANCE AZ <<< "$(aws ec2 describe-volumes --filters Name=tag:Name,Values=cloudopshub-dev-data Name=status,Values=in-use --query 'Volumes[0].[Attachments[0].InstanceId,AvailabilityZone]' --output text)"
SNAP=$(aws ec2 describe-snapshots --owner-ids self --filters Name=tag:Name,Values=cloudopshub-dev-data Name=status,Values=completed --query 'sort_by(Snapshots,&StartTime)[-1].SnapshotId' --output text)
aws ec2 describe-snapshots --snapshot-ids "$SNAP" --query 'Snapshots[0].[SnapshotId,StartTime]' --output text   # RPO = now - this time
VOL=$(aws ec2 create-volume --snapshot-id "$SNAP" --availability-zone "$AZ" --volume-type gp3 --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=cloudopshub-dr-drill}]' --query VolumeId --output text)
aws ec2 wait volume-available --volume-ids "$VOL"
aws ec2 attach-volume --volume-id "$VOL" --instance-id "$INSTANCE" --device /dev/sdg
aws ec2 wait volume-in-use --volume-ids "$VOL"; echo "$VOL"
aws ssm start-session --target "$INSTANCE"
```

**3. On the server: mount the copy and start a private backend on it** (put the volume ID from step 2 in the first line)

```bash
VOL=vol-xxxxxxxx
sudo mkdir -p /mnt/drill
sudo mount "/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_${VOL/-/}" /mnt/drill && sudo ls -l /mnt/drill
IMAGE=$(sudo docker inspect -f '{{.Config.Image}}' cloudops-backend)
sudo docker run -d --rm --name drill-backend -p 127.0.0.1:8001:8000 -v /mnt/drill:/app/data -e JWT_SECRET="$(openssl rand -hex 32)" "$IMAGE"
sleep 10; curl -s http://127.0.0.1:8001/health
```

**4. Check the data.** Row counts should match step 1 (minus anything added after the snapshot), and a real sign-in must work:

```bash
sudo docker exec drill-backend python -c "
import sqlite3
for f, t in (('cloudopshub_auth.db', 'users'), ('cloudopshub.db', 'devices'), ('cloudopshub.db', 'metrics'), ('cloudopshub.db', 'alerts')):
    c = sqlite3.connect('/app/data/' + f)
    print(t, c.execute('select count(*) from ' + t).fetchone()[0], c.execute('pragma integrity_check').fetchone()[0])"
read -rsp 'Admin password: ' PW; echo
curl -s -o /dev/null -w 'sign in: %{http_code}\n' -H 'Content-Type: application/json' -d "{\"username\":\"admin\",\"password\":\"$PW\"}" http://127.0.0.1:8001/api/auth/login
```

**5. Stop the stopwatch.** Every `integrity_check` is `ok` and sign in is `200` → PASS.

**6. Clean up (always).** On the server: `sudo docker stop drill-backend && sudo umount /mnt/drill`, then `exit`. Back in Git Bash:

```bash
aws ec2 detach-volume --volume-id "$VOL" && aws ec2 wait volume-available --volume-ids "$VOL" && aws ec2 delete-volume --volume-id "$VOL"
aws ec2 describe-volumes --filters Name=tag:Name,Values=cloudopshub-dr-drill --query 'Volumes[].VolumeId' --output text   # must print nothing
```

**7. Record it** in the drill log below:

| Step | Result |
| --- | --- |
| Snapshot used (time → RPO at that moment) | |
| Volume created and attached | |
| Private backend healthy on the copy | |
| Users / devices / metrics / alerts, integrity | |
| Sign in | |
| **Total recovery time** (target ≤ 30 min) | |
| Copy deleted, nothing left behind | |

## Drill log

### 2026-11-24 — both databases, cloud snapshot — PASS (Aaron, using Tirth's procedure)

Newest daily snapshot restored to a new disk, with a second private backend running on it. Started 2026-11-25 01:23:41 UTC
(8:23 p.m. Nov 24 ET). The live site stayed up throughout. Run through SSM Run Command instead of an interactive session.

| Step | Result | Elapsed |
| --- | --- | --- |
| Live before the drill | 3 users, 1 device (`aaron-laptop`), 5 metric rows, 0 alerts | – |
| Snapshot used | `snap-02a87c860c321d47c`, 2026-11-24 07:28:47 UTC | – |
| Volume created from the snapshot and attached | `vol-017dc9ca03da1e698`, 5 GB gp3 | 7 s |
| Copy mounted (checked: a different disk from the live one), private backend healthy | `{"status":"ok"}` | 31 s |
| Users / devices / metrics / alerts on the copy | 3 / 5 / 24 / 7, `integrity_check` **ok** for both databases | – |
| Sign in as admin on the copy | **200**, role admin | 55 s |
| **Total recovery time (RTO)** | **55 s** — target 30 min | |
| **Data loss (RPO)** | **17 h 55 min** since the snapshot — target 24 h | |
| Live site during the drill | 200, backend healthy | |
| Clean-up | Backend stopped, copy unmounted, detached and deleted; nothing left; `terraform plan`: no changes | |

- **What would have been lost:** everything after 07:28 UTC. The copy doesn't have `aaron-laptop` or its readings, added that
  evening, and still has the 5 sample devices deleted before the drill. All user accounts and current passwords were there
- **What the 55 s doesn't include:** noticing the failure, and pointing the live site at the restored disk. It ran on the
  existing server; a lost server also needs a rebuild
- **What surprised us:** one attempt stopped on a wrong check command (`findmnt`) after the disk was mounted, so the second
  attempt picked up from there; that delay is included in the 55 s. An extra API read after the sign-in failed because the
  test script used the wrong field name (the API returns `accessToken`); the sign-in itself had already passed

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
