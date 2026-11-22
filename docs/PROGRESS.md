# Project Progress Log

A running log of what the team has done, what is in progress, and what is next.
**Add an entry whenever you open a Pull Request.** Newest entries go at the top.

---

## Current Status

| Area                | Status                                                  |
| ------------------- | ----------------------------------------------------    |
| Planning docs       | ✅ Done (risk register, SWOT, mind map, workflow)      |
| Architecture docs   | 🟡 Started (`docs/architecture/`)                      |
| API contract        | 🟡 Updated (`docs/api/frontend-contract.md`)           |
| Frontend            | 🟡 Dashboard UI + login; mock or live backend          |
| Backend             | 🟡 FastAPI: auth + live AWS + SQLAlchemy DB (devices/metrics/alerts) |
| Authentication/RBAC | ✅ Done (JWT + Login UI + Admin/Operator/Viewer)       |
| CI/CD               | 🟡 CI on PRs (lint, build, tests); no CD yet           |
| Docker / Infra      | ✅ Compose tested end-to-end (users persist, backups) |
| Terraform / Cloud   | 🟡 Foundation done; dev environment deployed (EC2)     |

## Next Up

Full task list with owners: [`docs/REMAINING_WORK.md`](REMAINING_WORK.md)

- Team: confirm or object to the infrastructure decisions in the 2026-11-20 Terraform entry (AWS, EC2 + Docker, SQLite for now)
- Requirements specification document
- Replace mock data with real metrics collection (agent or cloud APIs)

---

## Log

### 2026-11-20 — Requirements specification draft (`docs/requirements-spec`) — Aaron

- Task **0.3** from `docs/REMAINING_WORK.md` (draft done, **needs review from everyone**)
- New `docs/requirements/REQUIREMENTS.md`: MVP scope (the F1 demo story), roles, 24 functional requirements (FR-1…FR-24),
  non-functional requirements with numbers (security, availability/recovery, cost, performance, delivery, usability),
  constraints and an out-of-scope list
- Every requirement shows its status today and maps to a task or an existing feature (checked: none unmapped)
- Numbers come from the existing docs: RTO ≤ 30 min / RPO ≤ 24 h (DR doc), token lifetimes, lockout, 70/90 % thresholds,
  "offline after 3 missed reports" (API contract), $10 budget. Performance numbers are marked as *targets* to measure in F1
- **For the team:** section 6 lists gaps with no task yet (audit log, token revocation, service health, **SonarQube owner**).
  Please check your track's rows and approve or comment on the PR
### 2026-11-21 — Critical alert notifications (`feature/alert-notifications`) — pshrestha49

- Task **B9** (stretch) from `docs/REMAINING_WORK.md`
- Added `backend/app/notifications.py`: dispatches new or escalated `critical` alerts to an HTTPS webhook (`ALERT_WEBHOOK_URL`, e.g. Discord) and/or AWS SNS (`ALERT_SNS_TOPIC_ARN`); rejects non-HTTPS webhook URLs and logs delivery errors without breaking metric ingestion
- Wired `notify_critical_alert` into `backend/app/alert_engine.py` so notifications fire only when a critical alert opens or escalates from warning (never on repeats or recoveries)
- Added 5 tests in `backend/tests/test_notifications.py` and documented both env vars in `backend/README.md`; verified with `pytest -q` (88 passed)
- For Aaron: `ALERT_WEBHOOK_URL` / `ALERT_SNS_TOPIC_ARN` are optional runtime env vars (never committed to Git); for Tirth: item **A10** in `docs/security/SECURITY_CHECKLIST.md` can be rechecked (webhook URL comes only from env var and enforces `https://`)

### 2026-11-21 — User management extras (`feature/user-management`) — pshrestha49

- Task **B7** from `docs/REMAINING_WORK.md`
- Documented `PATCH /api/auth/users/{id}` and `POST /api/auth/me/password` in `docs/api/frontend-contract.md`
- Added `UserUpdate` and `PasswordChange` schemas (`backend/app/auth/schemas.py`) and endpoints in `backend/app/routers/auth.py`: admins can change roles or disable/re-enable users (blocked from demoting or disabling themselves), and any signed-in user can change their password
- Added 3 tests in `backend/tests/test_auth.py` and updated `backend/README.md`; verified with `pytest -q` (83 passed)
- For Tirth: contract updated in `docs/api/frontend-contract.md` so UI screens can hook into both endpoints, and item **A07** in `docs/security/SECURITY_CHECKLIST.md` (password change) can be updated

### 2026-11-21 — Login on every endpoint (`feature/login-everywhere`) — pshrestha49

- Task **B5** from `docs/REMAINING_WORK.md`
- Added `Depends(get_current_user)` to `dashboard`, `resources`, `devices`, and `alerts` routers so every data endpoint returns `401` when signed out; `/health`, `/api/auth/login`, `/api/auth/refresh`, and `/api/agent/metrics` (`X-Agent-Key`) remain public
- Role enforcement preserved: device add/edit/delete/rotate-key = `admin`, alert acknowledge/resolve = `admin` + `operator`, viewing = any signed-in user
- Updated `tests/test_api.py` (with `test_all_data_endpoints_require_login`), `tests/test_metrics.py`, `tests/test_database.py`, and `backend/README.md`; verified with `pytest -q` (80 passed)
- Team heads-up: everyone now needs `python -m seed` locally to sign in (`C3` frontend sign-in screen activates automatically on `401`); Tirth can mark **A01** complete in `docs/security/SECURITY_CHECKLIST.md`

### 2026-11-21 — Alert engine and acknowledge/resolve API (`feature/alert-engine`) — pshrestha49

- Task **B4** from `docs/REMAINING_WORK.md`
- Added `backend/app/alert_engine.py`: evaluates `offline` (> 3 min), `storage` (>= 90% critical), and `cpu` / `memory` (>= 70% warning, >= 90% critical) on every agent report and device/alert/summary read; keeps one active alert per `(device, rule)` and auto-resolves when conditions clear
- Extended `Alert` schema (`deviceId`, `status`, `createdAt`, `acknowledgedBy`, `resolvedAt`) and `AlertModel.rule` column (with safe `ALTER TABLE` check in `init_app_db()` for existing DBs); updated `seed.py`
- Created `backend/app/routers/alerts.py`: `GET /api/alerts` (open + acknowledged; `?status=all` includes resolved) and `POST /api/alerts/{id}/acknowledge` + `/resolve` (`operator` and `admin`)
- Added 4 tests in `backend/tests/test_alerts.py` and updated `test_api.py` + `backend/README.md`; verified with `pytest -q` (all 79 backend tests passing)
- For Tirth: `C2` frontend Alerts page (acknowledge, resolve, alert history) now works against the real backend with no frontend changes needed

### 2026-11-21 — Metrics agent and ingestion endpoint (`feature/metrics-agent`) — pshrestha49

- Task **B3** from `docs/REMAINING_WORK.md`
- Added `POST /api/agent/metrics` (`backend/app/routers/agent.py`) authenticated by per-device `X-Agent-Key` hash (no user login); sets the device `online`, updates current CPU/memory/storage and `lastSeen`, and appends a `MetricModel` history point
- Added shared `app/device_status.py` (`AGENT_OFFLINE_SECONDS`, default `180` s = 3 missed reports) so `/api/devices`, `/api/devices/{id}`, `/api/dashboard/summary`, and overview metrics treat stale devices as `offline`
- Created `agent/cloudops_agent.py` and `agent/requirements.txt` (`psutil`, `requests`) supporting `--server`, `--key` / `--key-file`, `--interval` (default 60 s), and `--once`; retries quietly when the server is down and prints a clear error on `401`
- Added 7 tests in `backend/tests/test_agent.py`, updated `docs/agent/INSTALL.md` and `backend/README.md`, and verified live end-to-end against local Uvicorn with `cloudops_agent.py --once` + `pytest -q` (75 passed)
- For Tirth: `C4` agent setup screens and `docs/agent/INSTALL.md` commands match the implemented script

### 2026-11-21 — Device API (`feature/device-api`) — pshrestha49

- Task **B2** from `docs/REMAINING_WORK.md`
- Extended `Device` schema (`type`, `ipAddress`, `description`, `lastSeen`) and added `DeviceInput`, `AgentKeyResponse`, and `DeviceCreateResponse` matching `docs/api/frontend-contract.md`
- Built `backend/app/routers/devices.py`: `GET /devices/{id}`, `POST /devices` (returns `coa_...` agent key once, stores only SHA-256 hash, `409` on duplicate hostname), `PUT /devices/{id}`, `DELETE /devices/{id}` (cascades metrics/alerts), `POST /devices/{id}/agent-key`, and `GET /devices/{id}/metrics?metric=...&hours=...` (5-min buckets up to 24 h, hourly beyond)
- Added `backend/tests/test_devices.py` covering every endpoint, role check (`admin` vs `operator`/`viewer`/signed out), key hashing, cascade delete, and metric bucketing; updated `test_api.py` and `backend/README.md`
- Verified with `pytest -q` (all backend tests passing)
- For Tirth: `C1` device management screens now have the full matching backend API (no frontend changes needed)

### 2026-11-21 — Real database for devices, metrics and alerts (`feature/database`) — pshrestha49

- Task **B1** from `docs/REMAINING_WORK.md`
- Added SQLAlchemy (`app/database.py`, `app/models.py`) configured via `DATABASE_URL` (defaults to `sqlite:///./cloudopshub.db`; drop-in compatible with RDS Postgres) with `devices`, `metrics` (indexed on `device_id + timestamp`), and `alerts` tables
- Replaced `mock_data.py` in `/api/dashboard/summary`, `/api/devices`, `/api/alerts`, and `/api/metrics/{cpu,memory,storage}` with database queries; overview metrics now average online devices in 5-minute buckets; `/api/accounts` remains sample data
- Moved sample devices, metric history, and alerts into `backend/seed.py` (`seed_app_data()`, idempotent) and an `isolated_app_db` fixture in `tests/conftest.py`
- Added 5 database tests in `tests/test_database.py` (persistence across restarts, 5-min bucket averaging, active alert counts, empty DB, cascade deletes) and updated `test_seed.py`; verified with `pytest -q` (59 passed) and `pip-audit -r requirements.txt` (0 vulnerabilities)
- Documented `DATABASE_URL` and seeding in `backend/README.md` (for Aaron's deployment)
- Kept user accounts on `AUTH_DB_PATH` (`app/auth/database.py`) so Tirth's `scripts/backup_db.py` and DR workflow keep working unchanged

### 2026-11-21 — Billing cache and login (`feature/billing-cache`) — pshrestha49

- Task **B6** from `docs/REMAINING_WORK.md`
- Added in-memory TTL caching (default 6 h via `BILLING_CACHE_SECONDS`, default `21600`) to `GET /api/billing/summary` so repeated dashboard reloads make at most one AWS Cost Explorer call per cache window
- Added `Depends(get_current_user)` to the billing router so signed-out requests return `401`
- Documented `BILLING_CACHE_SECONDS` and `/api/billing/summary` in `backend/README.md`
- Added 3 tests in `backend/tests/test_billing.py` (401 when signed out, two calls hit AWS once, cache expiry refreshes); verified with `pytest -q` (54 passed)
- For Tirth: `docs/security/SECURITY_CHECKLIST.md` items A01 and A04 (billing login + cache) can be updated

### 2026-11-20 — Fix seed.py Windows output (`fix/seed-windows-output`) — pshrestha49

- Task **B8** from `docs/REMAINING_WORK.md`
- Replaced emoji and non-ASCII characters in `backend/seed.py` output with plain ASCII so redirecting output on Windows (`python -m seed > out.txt`) works without `UnicodeEncodeError`
- Added `backend/tests/test_seed.py` verifying cp1252 encoding, idempotency, and CLI execution
- Verified on Windows PowerShell with `python -m seed > out.txt` (temp DB) and `pytest -q` (all 51 backend tests passing)

### 2026-11-20 — Docker follow-ups (`infra/docker-followups`) — Aaron

- Task **A1** from `docs/REMAINING_WORK.md` (done)
- Backend image now includes `scripts/`, so the backup tool runs in the container:
  `docker compose exec backend python -m scripts.backup_db backup --dest /app/data/backups`
- `infra/README.md`: replaced "not yet built and run" with the test results, plus how to seed users, back up,
  and why the AWS page errors locally (no credentials in local containers; the cloud uses the instance role)
- `docs/architecture/aws-integration.md`: corrected the "Free plan" explanation. The real cause of the EC2
  denial is that AWS Settings projects only allow EC2 in their home Region (us-east-2 for Console Dot Dream)
- Checked: `docker compose config --quiet`; `up --build` with both containers healthy; seeded and signed in on :8080
  with live backend data; users survive `down` / `up`; backup written and verified (3 users); `curl -I` shows the CSP
  and other security headers; no CSP errors in the browser console on any page
- For Tirth (backup tool): `verify` leaves `-shm` / `-wal` files next to the backup it checked. Harmless, just clutter
- Unblocks **C7** prep: the backup tool can now run inside the deployed container

### 2026-11-20 — Backend container fix (`fix/docker-sqlite-path`, PR #32) — Aaron

- Backend container crashed on startup (`sqlite3.OperationalError: unable to open database file`): it runs as
  `appuser`, but `/app` is owned by root
- `backend.Dockerfile`: writable `/app/data` owned by `appuser`, `AUTH_DB_PATH=/app/data/cloudopshub_auth.db`,
  and `seed.py` copied in so demo users can be created inside the container
- `docker-compose.yml`: `backend-data` volume at `/app/data` so users survive rebuilds
- Checked: container healthy, seed + login work, users persist after restart

### 2026-11-20 — Terraform foundation + dev deployment (`infra/terraform-foundation`) — Aaron

- Task **A2** from `docs/REMAINING_WORK.md` (done), plus the first part of **A3** (started)
- **Infrastructure decisions (task 0.2), proposed by Aaron. Object on this PR if you disagree:**
  AWS, account Console Dot Dream, region us-east-2 (the only region that account allows EC2 in);
  hosting phase 1 = one EC2 instance running Docker Compose (cheapest, reuses our compose file; Fargate later if time);
  database = SQLite on the instance until pshrestha49 decides B1 (RDS Postgres is a drop-in addition)
- `infra/terraform/bootstrap/`: S3 state bucket (versioned, encrypted, public access blocked); S3-native locking, no DynamoDB
- `modules/budget`: **$10/month budget, emails the team at $5, $10 and on a forecast overrun** (credits excluded, so it tracks real usage)
- `modules/network`: own VPC, public subnets in 2 AZs; no NAT gateway (saves ~$32/month); default security group locked down
- `modules/iam`: app instance role (the 5 read-only actions from the briefing + read the JWT secret; no access keys) and
  **GitHub OIDC deploy role** limited to this repo's `main` branch (permissions get added with CD, A4)
- `envs/dev`: EC2 (Ubuntu 24.04, t3.micro) running Docker Compose; port 80 only from approved IPs; no SSH (SSM Session Manager);
  JWT secret generated by Terraform in SSM Parameter Store; backend in `APP_ENV=production`; backend port not published;
  encrypted disk; IMDSv2; Elastic IP
- Checked: `terraform fmt -check`, `validate` and `plan` clean; deployed and verified login, `/api/aws/*` via the instance role,
  401 without login, backend port closed to the internet
- Left for A3: persistent storage for `/app/data` (users are lost if the server is replaced), ECR images, DB backups
- Teammates: budget emails come from AWS Budgets. To view the demo, send Aaron your public IP

### 2026-11-20 — Dependabot updates merged (PRs #18–#30) — Tirth

- First batch of Dependabot PRs merged: frontend minor/patch group, react-router 7 → 8, @types/node 26, fastapi, uvicorn,
  pyjwt, boto3, pytest 9, moto, and GitHub Actions checkout / setup-node / setup-python v7
- Merge conflicts in `backend/requirements-dev.txt` (#26) and `.github/workflows/security.yml` (#19) resolved by keeping both upgrades
- **Skipped TypeScript 7 (#27):** `typescript-eslint` 8.73 only supports TypeScript < 6.1, so the install fails.
  Closed with `@dependabot ignore this major version`; upgrade both together once typescript-eslint supports TS 7
- Checked `main` afterwards: lint, 58 frontend tests, build and 49 backend tests pass; clicked through every page in the
  browser (menu, device links, back button, direct URLs, phone menu) to confirm react-router 8 works
- Tip for future Dependabot PRs: merge one at a time; if one shows a conflict, comment `@dependabot rebase`

### 2026-11-20 — Backups, recovery drill and architecture guide (`ops/dr-and-docs`) — Tirth

- Track C tasks **C7** (local part) and **C8** from `docs/REMAINING_WORK.md`
- **Backup tool** `backend/scripts/backup_db.py`: `backup` (safe while the backend runs, integrity-checked,
  SHA-256 checksum, keeps the newest 14), `verify`, and `restore` (keeps the old database as `.before-restore`).
  6 tests in `tests/test_backup.py` (49 backend tests passing). `backend/backups/` is git-ignored
- **Recovery drill passed:** real backend, created a user, backed up, deleted the database file, restored,
  restarted: the user could sign in again. Restore 120 ms, **total recovery 1.6 s** (target: 30 min)
- **DR plan** `docs/operations/DISASTER_RECOVERY.md`: RPO/RTO targets, what holds data, backup schedule,
  restore steps, scenarios (lost server, leaked AWS key, leaked JWT secret), the cloud plan for after A3/B1,
  and a drill log to keep updating
- **Architecture guide** now in the repo: `docs/architecture/CloudOps_Hub_Architecture_Guide.pdf` (16 pages,
  diagrams) and its editable source `docs/architecture/guide/architecture-guide.html`. Updated to 20 Nov:
  device page, alert actions, roles, billing and metrics endpoints, proposed endpoints, security and tests,
  CI security workflow, current status, who did what. To update: edit the HTML, print it to PDF from Edge or Chrome
- Still to do for C7/C8: a cloud database restore drill and a deployment diagram, once Terraform (A3) and the database (B1) exist

### 2026-11-20 — Device screens, alert actions, sign-in screen, agent setup (`feature/frontend-devices-alerts`) — Tirth

- Track C tasks **C1–C4** from `docs/REMAINING_WORK.md`. All work fully in mock mode today; with the real
  backend they need pshrestha49's tasks B2–B5. **The API they expect is written down** in
  `docs/api/frontend-contract.md` → "Proposed endpoints", so the backend can be built to it directly
- **C1 Devices:** admins can add, edit and delete devices (hostname, type, IP, description; checked before
  sending; delete asks first). Hostnames link to a new **device page** (`/devices/:id`): status, type, IP,
  last report, current usage, CPU / memory / storage **history** (1h · 6h · 24h · 7d), and its alerts
- **C2 Alerts:** operators and admins can **Acknowledge** ("I'm on it") and **Resolve** alerts on the Alerts page;
  "Including resolved" shows history; each alert links to its device and shows how long ago it started
- **C3 Sign-in:** when the backend starts requiring login (B5), the app shows a sign-in screen instead of a page
  of errors; it switches on by itself. Who-can-do-what is in one place: `src/utils/permissions.ts`
- **C4 Agent setup:** a new device shows its **agent key once** with copy buttons and the exact install command;
  admins can generate a new key. Install guide for Linux, Windows and systemd: `docs/agent/INSTALL.md`
- Works with today's backend too: missing fields are hidden, missing history says so, alerts without a status count as open
- 16 new tests (58 frontend tests passing); checked in the browser at desktop and phone width
- Fixed while checking: the setup commands pushed the device page wider than a phone screen

### 2026-11-20 — Security checks and hardening (`security/hardening`) — Tirth

- Track C task **C6** from `docs/REMAINING_WORK.md`; full write-up in `docs/security/SECURITY_CHECKLIST.md`
  (OWASP Top 10 status, what's automated, what's still open)
- New **Security** CI workflow on every push, PR and weekly: `npm audit` (fails on high/critical),
  `pip-audit`, and a **gitleaks** secret scan of the whole Git history. **Dependabot** opens weekly update PRs
- Fixed dependency advisories: 1 high (`follow-redirects`, used by axios) and 9 moderate (`minimatch`, lint tools only); now 0.
  Backend: no known vulnerabilities. Manual history scan: no keys, tokens, `.env` files or databases ever committed
- **Login lockout:** 5 wrong passwords for one username from one address in 15 min → `429` with `Retry-After`;
  a correct login resets it (`app/auth/rate_limit.py`, settings `LOGIN_MAX_ATTEMPTS`, `LOGIN_WINDOW_SECONDS`).
  6 new backend tests; checked on a running server
- **Fixed a bug:** the sign-in form showed "Request failed with status code 401" instead of the backend's
  "Incorrect username or password". It now shows the real reason (also for the lockout). 2 new frontend tests
  that fail on the old form
- **Security headers:** API responses get `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and `no-store` on
  `/api/auth`. nginx (Docker) adds a Content Security Policy; the inline theme script moved to `public/theme-init.js` so the CSP can block inline scripts
- Tests: backend 43 passed, frontend 42 passed

### 2026-11-20 — Frontend tests (`test/frontend-tests`) — Tirth

- Track C task **C5** from `docs/REMAINING_WORK.md`
- Added Vitest + React Testing Library (happy-dom), `npm test` / `npm run test:watch`
- **40 tests** covering: usage colour thresholds (70% / 90%), error messages, "time ago" text, table sorting,
  device search + online/offline filter, alerts ordering + severity filter, account popup (mouse and keyboard),
  admin-only Users page and its form, sidebar showing Users only to admins, and the silent login refresh
  (expired token renewed once even when several requests fail, sign-out when the refresh token is bad)
- Frontend CI now runs the tests on every PR; CONTRIBUTING checklist and frontend README updated
- Checked that the tests catch real mistakes: changing the 90% critical threshold makes a test fail
- Note: `npm install` of `vitest` hits an npm 10 bug locally; `npx npm@11 install` works. `npm ci` (what CI uses) is fine

### 2026-11-15 — Remaining work plan (`feature/frontend-dashboard-polish`) — Tirth

- Added `docs/REMAINING_WORK.md`: everything left to finish the project, split into three tracks
  (Cloud & DevOps, Backend & data, Frontend/quality/docs) with suggested owners, sizes, dependencies
  and a "done when" for each task, plus the critical path to the final demo
- First step for everyone: merge the 5 open frontend PRs and hold one decisions meeting (cloud provider,
  AWS account, hosting, database, how real metrics are collected)

### 2026-11-15 — Synced frontend branches with latest `main` (`feature/frontend-dashboard-polish`) — Tirth

- Merged the latest `main` (PRs #12 and #13 below) into all five open frontend branches, in order, so their PRs merge cleanly
- `App.tsx` is now only the page routes, so the Cost Monitoring panel and the Memory / Storage
  charts moved into `pages/OverviewPage.tsx` (same order as before)
- Connected Accounts: kept the account detail popup from #13 **and** the sortable columns, loading
  skeleton and Retry from the polish branch. Rows can also be opened with the keyboard (Enter)
- Fixed: the Memory and Storage charts from #13 rendered empty (same stuck-animation issue the CPU chart had).
  `UtilizationChart` now uses the shared `MetricChart` and auto-refreshes like the other dashboard data
- The per-device "Memory & Storage by Device" chart now appears only on the Devices page,
  so Overview doesn't show two memory/storage charts
- Checked: 35 backend tests pass, frontend lint + build pass on every branch, Overview checked in the browser
- Also made a 15-page architecture guide (PDF with diagrams) explaining the whole project for the team;
  shared separately, not in the repo yet

### 2026-11-15 — Dashboard update (PR #13, `feature-dashboard-update`) — pshrestha49 *(logged by Tirth)*

- New `GET /api/metrics/memory` and `GET /api/metrics/storage` (sample data) with tests
- Memory and Storage Utilization charts (`ResourceCharts`, `UtilizationChart`)
- Click a Connected Accounts row to open an account detail popup (`AccountDetailModal`)

### 2026-11-12 — AWS cost monitoring (PR #12, `feature-cost`) — pshrestha49 *(logged by Tirth)*

- New `GET /api/billing/summary`: month-to-date spend, per-service breakdown and month-end forecast
  from AWS Cost Explorer; falls back to sample data when AWS isn't available (`BILLING_USE_MOCK`,
  `BILLING_STRICT_AWS` env vars) — tests in `tests/test_billing.py`
- Cost Monitoring panel on the dashboard (`CostMonitorPanel`)
- ⚠️ Cost Explorer charges about $0.01 per call and the endpoint doesn't require login yet.
  The panel is not auto-refreshed. Should be cached and put behind login (see Next Up)

### 2026-11-13 — Dashboard polish (`feature/frontend-dashboard-polish`) — Tirth

- **New chart: Memory & Storage by Device** (the memory / storage charts from `dashboard-design.md`).
  Shows current values per device with a 90% critical line and a hover tooltip; offline devices
  show "no data" for memory instead of a misleading 0%. Colours checked for colour-blind
  separation and contrast in light and dark mode. (No history yet: the backend only has CPU over time.)
- **Auto-refresh every 30s** on Overview, Devices, Alerts and Accounts, paused while the tab is hidden.
  Control at the top right: last update time, on/off toggle, refresh now
- **AWS data is never auto-refreshed** (quotas, and billing calls cost money once `feature-cost` lands);
  the EC2 panel has a manual refresh button instead
- Loading skeletons instead of "Loading..." text, and every panel shows a clear error with **Retry**
- Click column headers to **sort** devices, accounts and EC2 instances (accounts default to most severe first)
- Devices page: **search** by hostname and **filter** online / offline. Alerts page: **filter by severity**
  with counts; alerts are always listed most severe first
- Tested in the browser: sorting, search, filters, tooltip, light and dark mode, auto-refresh request count
  (devices re-fetched after 30s, AWS calls unchanged), and all panels with the backend stopped
- Known: in dev mode React StrictMode fetches each panel twice on load; production builds fetch once

### 2026-11-12 — Admin user management (`feature/frontend-admin-users`) — Tirth

- New **Users** page (`/admin/users`), visible to admins only: lists every account with role,
  status, created and last sign-in time
- **Add user** dialog: username, email, temporary password and role (with a short description of
  each role). Checks the same limits as the backend before sending; shows the backend's message
  for duplicates. Closes with Esc
- Non-admins don't see the menu link, and opening the URL directly shows "Admins only"
  (the backend also returns 403)
- `useApi` gained `reload()` and `refreshing`, so lists can update without flashing "Loading"
- Validation errors (`422`) now show which field is wrong
- Documented all auth endpoints in `docs/api/frontend-contract.md` (they were missing)
- Tested against a running backend: viewer blocked, admin created a user, the new user could sign in,
  duplicate rejected; dialog checked at phone width
- Not included (backend has no endpoints yet): editing users, changing roles, disabling accounts

### 2026-11-12 — AWS Cloud page (`feature/frontend-aws-page`) — Tirth

- New **AWS Cloud** page (`/cloud`) that finally puts Aaron's AWS endpoints on screen:
  connected account (ID, user, ARN), EC2 instance table (state, type, zone, IP, launched),
  and a CloudWatch CPU chart for the selected instance with 1h–24h ranges and average / peak / latest
- Click an instance to see its CPU. Stopped instances show "no data" instead of an empty chart
- Signed-out users see "Sign in to view AWS resources" (the backend requires login for `/aws/*`)
- AWS errors are explained in plain words (Free plan SCP block, missing IAM permission,
  no credentials) with AWS's raw message underneath
- Mock data for the whole page, so it works without AWS (`src/mock/aws.ts`)
- `useApi` now shows the backend's error message (`detail`) instead of "Request failed with status code 502"
- CPU chart drawing moved into a reusable `MetricChart` component
- Added `GET /aws/account` to `docs/api/frontend-contract.md` (it existed but wasn't documented)
- Tested in mock mode, live mode signed out, and live mode signed in with **no AWS credentials**
  (so no real AWS calls were made); phone width checked

### 2026-11-12 — Frontend app shell + pages (`feature/frontend-app-shell`) — Tirth

- Added routing (`react-router` 7) with real pages and URLs: Overview `/`, Devices `/devices`,
  Alerts `/alerts`, Accounts `/accounts`, plus a "Page not found" page
- New app shell: sidebar navigation, sticky top bar with page title, theme button and sign-in.
  On phones the sidebar becomes a slide-in menu (☰)
- Light / dark / system theme toggle, remembered per browser, no flash on reload
- Fixed: CPU chart was blank because its reveal animation got stuck; animation turned off
- Fixed: wide tables no longer push the page sideways on small screens
- Layout styles in new `src/styles/shell.css`; removed unused header CSS from `index.css`
- Checked with screenshots: desktop, phone width, light and dark mode
- ⚠️ **Merging with `feature-cost`:** `App.tsx` is now just routes. When merging, put
  `<CostMonitorPanel />` in `src/pages/OverviewPage.tsx` (or give it its own page) instead of `App.tsx`
- Builds on `fix/auth-and-docs-cleanup`; merge that PR first

### 2026-11-12 — Auth fixes + docs cleanup (`fix/auth-and-docs-cleanup`) — Tirth

- **Stay signed in:** the frontend now saves the refresh token and, when a request gets a 401
  (access token expired after 30 min), silently gets a new access token and retries. If the refresh
  token is also invalid, the user is signed out cleanly. Before, users were logged out every 30 minutes.
- **Demo passwords:** the quick-login buttons now only appear in `npm run dev` or mock mode.
  A production build against a real backend no longer contains the passwords at all (verified in the bundle).
- **JWT secret:** with `APP_ENV=production`, the backend refuses to start unless `JWT_SECRET`
  is set to a real value. Local dev and tests are unchanged. Documented in `backend/README.md`.
- 5 new tests in `tests/test_jwt_secret.py` (29 backend tests passing); refresh flow checked end to end
  against a running backend
- Docs: fixed outdated comment in `routers/auth.py`, removed duplicate roadmap items in `README.md`,
  ticked off completed roadmap items, updated the status table above
- No changes to files touched by the open `feature-cost` branch

### 2026-11-11 — AWS EC2 inventory + CloudWatch CPU (`feature/aws-ec2-cloudwatch`) — Aaron

- Cleaned up `backend/app/routers/aws.py`: removed duplicated `/aws/ec2` route
- All `/aws/*` routes now require login (previously public, exposing account ID and ARN)
- `GET /aws/ec2` now returns a typed `Ec2Instance` model (type, AZ, private IP, launch time) and paginates
- New `GET /aws/ec2/{instanceId}/cpu` pulls CloudWatch CPU in the same shape as `/metrics/cpu`
- AWS failures return a clean `502` with AWS's message instead of a 500 stack trace
- 5 new tests in `tests/test_aws.py` using `moto` (fake AWS), so CI needs no credentials (24 backend tests passing)
- Service account `cloudopshub-service` moved to a least-privilege inline policy (`CloudOpsHubReadOnly`); removed `ReadOnlyAccess`
- Fixed unclosed code block in README that broke the Roadmap section
- ⚠️ Found that AWS Free plan accounts block programmatic `ec2:DescribeInstances` via an AWS-managed SCP. See `docs/architecture/aws-integration.md`
- Added `*.db` to `.gitignore` so local auth databases (user accounts, password hashes) are never committed
### 2026-10-30 — Authentication & RBAC (`feature/auth-jwt-rbac`)

- Added backend JWT authentication system (`backend/app/auth/`):
  - SQLite database for user storage with automatic table creation & default role seeding (`admin`, `operator`, `viewer`)
  - Password hashing with bcrypt + salt; token generation and validation with PyJWT (access + refresh tokens)
  - Endpoints: `POST /api/auth/login`, `POST /api/auth/register` (admin-only), `POST /api/auth/refresh`, `GET /api/auth/me`, `GET /api/auth/users` (admin-only)
  - 12 comprehensive pytest unit and integration tests covering positive and negative scenarios (all 19 backend tests passing)
- Added frontend authentication layer (`frontend/src/`):
  - `LoginPage` component with custom design token styling, dark/light theme support, error handling, and 1-click Quick Demo logins for `Admin`, `Operator`, and `Viewer`
  - `AuthProvider` and `useAuth` hook managing user session, token storage in `localStorage`, and role-based permissions (`hasRole`)
  - Axios interceptor in `apiClient.ts` to automatically attach Bearer token to all outgoing requests
  - Header user greeting, role badge, and sign-out button (`UserNav.tsx`)
  - Informative `RoleBanner` component displaying active role permissions and scope
  - Both live backend and mock mode supported seamlessly (`USE_MOCK`)
- Updated API contract (`docs/api/frontend-contract.md`) with the new auth endpoints and JSON payload shapes


### 2026-10-22 — Docker setup (`infra/docker`) — Tirth

- Added `infra/docker/` with backend and frontend Dockerfiles, nginx config, per-Dockerfile ignore files
- Added `infra/docker-compose.yml`: run the whole stack with `docker compose up --build`
  (frontend http://localhost:8080, backend http://localhost:8000)
- nginx proxies `/api` to the backend, so the containerized frontend uses live data
- Added `infra/terraform/README.md` placeholder listing open cloud decisions
- ⚠️ Compose file validated, but images not yet built/run (Docker wasn't available on my machine). Needs a test run.

### 2026-10-22 — CI pipelines (`ci/github-actions`) — Tirth

- `.github/workflows/frontend.yml`: lint + type-check + build on PRs touching `frontend/`
- `.github/workflows/backend.yml`: pytest on PRs touching `backend/`
- Added `.gitattributes` to normalize line endings (stops CRLF/LF noise between Windows and Mac)
- Documented CI in `CONTRIBUTING.md`

### 2026-10-22 — Backend API (`feature/backend-api`) — Tirth

- Created `backend/` with Python + FastAPI, serving every endpoint in the API contract under `/api`
- Pydantic models in `app/schemas.py` output camelCase JSON to match frontend types
- `/health` endpoint for Docker / load balancer checks; CORS configurable via `CORS_ORIGINS`
- Mock data in `app/mock_data.py` matches `frontend/src/mock/`
- 7 pytest tests checking every endpoint's shape; see `backend/README.md` to run

### 2026-10-22 — Dashboard UI (`feature/dashboard-ui`) — Tirth

- Built the dashboard layout from `docs/architecture/dashboard-design.md`:
  summary stat cards, CPU utilization chart (Recharts), "Attention Required" alerts panel,
  device status table with CPU/memory/storage usage bars, connected accounts table
- New components: `StatCard`, `SummaryCards`, `CpuChart`, `AlertsPanel`, `DeviceTable`, `StatusBadge`
- `src/utils/status.ts` maps statuses to colours; usage thresholds are 70% (warning) and 90% (critical)
- Replaced Vite template styles with dashboard styles (light + dark mode); removed unused template assets

### 2026-10-22 — Frontend API service layer (`feature/api-service`) — Tirth

- Added `src/services/` (axios client + `dashboardService`) so components never import mock data directly
- Mock mode controlled by `VITE_USE_MOCK` (default on); see `frontend/.env.example`
- Added `useApi` hook for loading / error / data state
- Added types + mock data for devices, alerts, summary; CPU mock now matches the contract (`timestamp`, `value`)
- Updated API contract: added endpoint paths, base URL, and `GET /accounts`
- Replaced the Vite template `frontend/README.md` with project-specific instructions

### 2026-10-22 — Repository cleanup (`chore/repo-cleanup`) — Tirth

- Removed accidentally committed root `node_modules/`, `package.json`, `package-lock.json`
  (they came from running `npm install` in the repo root instead of `frontend/`)
- Added Node, Terraform, and OS entries to the root `.gitignore`
- Merged Aaron's architecture docs (`docs/architecture/`) from `feature/frontend-foundation`
- Added `CONTRIBUTING.md` (setup + branching workflow) and this progress log
- Updated `README.md` with repo structure and tech stack

### 2026-10-15 — Frontend foundation (`feature/frontend-foundation`) — Aaron

- Set up React + TypeScript + Vite app in `frontend/`
- Added `Account` type, mock accounts, mock CPU data, and `AccountList` prototype
- Added API contract (`docs/api/frontend-contract.md`)
- Added dashboard / frontend / account-model architecture docs

### 2026-09-17 — Project kickoff — Aaron

- Initial README, planning documents uploaded to `docs/planning/`
