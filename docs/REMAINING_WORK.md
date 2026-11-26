# Remaining Work

Everything left to finish CloudOps Hub, split into three tracks so the team can work in parallel.
Owners are a **suggestion** based on what each person has built so far. Swap freely, then put your
name next to the task in your PR and log it in `docs/PROGRESS.md`.

Last updated: 2026-11-23

**Size:** S = about a day · M = 2–4 days · L = a week or more (rough estimates)

---

## Where we are

| Area | Status |
| --- | --- |
| Planning docs, requirements spec | ✅ Done |
| Frontend: 7 pages + device page, charts, roles, user management, themes, mobile | ✅ Done |
| Backend: database, device API, agent, alert engine, notifications, login everywhere | ✅ Done (90 tests) |
| Live AWS: account, EC2, CloudWatch CPU, cost | ✅ Done |
| CI, security scans, SonarCloud, frontend tests (70) | ✅ Done |
| Docker, Terraform, deployment, CD, HTTPS, monitoring | ✅ Done, live on AWS |
| Disaster recovery | ✅ Local and cloud drills passed (C7) |
| End-to-end demo, final report, slides, video | ⬜ Not started (F1, F2) |

---

## Step 0: Unblock (this week, everyone)

These block almost everything else. Do them first.

| # | Task | Owner | Size |
| --- | --- | --- | --- |
| 0.1 | ✅ **Done 2026-11-20.** Merge the 5 open frontend PRs, in order: `fix/auth-and-docs-cleanup` → `feature/frontend-app-shell` → `feature/frontend-aws-page` → `feature/frontend-admin-users` → `feature/frontend-dashboard-polish` ("Create a merge commit") | Tirth | S |
| 0.2 | ✅ **Decided 2026-11-20** (proposed by Aaron, no objections; recorded at the top of `infra/terraform/README.md`): AWS, account Console Dot Dream in us-east-2, one EC2 instance with Docker Compose, SQLite on a persistent disk (B1 kept SQLite). **Team decisions** (one meeting): cloud provider (AWS or Azure); which AWS account (Free plan blocks listing EC2 from code); hosting (ECS Fargate, App Runner or EC2); database (RDS Postgres or DynamoDB); how real metrics are collected (agent on devices, cloud APIs, or both); MVP scope | All | S |
| 0.3 | ✅ **Done 2026-11-22** (`docs/requirements-spec`, #35): `docs/requirements/REQUIREMENTS.md` (status column kept current). Requirements specification: functional + non-functional requirements and MVP scope, based on 0.2 | Aaron (all review) | M |

---

## Track A: Cloud & DevOps (suggested: Aaron)

| # | Task | Size | Depends on | Done when |
| --- | --- | --- | --- | --- |
| A1 | ✅ **Done 2026-11-20** (`fix/docker-sqlite-path` #32, `infra/docker-followups`). Run `docker compose up --build` in `infra/`, fix whatever breaks | S | – | Frontend on :8080 shows live backend data |
| A2 | ✅ **Done 2026-11-20** (`infra/terraform-foundation`). Terraform foundation: remote state, network (VPC/subnets), IAM roles | M | 0.2 | `terraform apply` creates the base, state stored remotely |
| A3 | ✅ **Done 2026-11-22** (`infra/terraform-foundation`, `infra/terraform-app`): EC2 + Docker Compose, JWT secret in SSM, app IAM role, both SQLite databases on a persistent EBS disk with daily snapshots; data survives a redeploy. Container registry (ECR) moved to A4, where CD builds the images. Terraform app stack: container registry, backend compute, frontend hosting, database, secrets (`JWT_SECRET`) | L | A2, B1 | App reachable on a cloud URL |
| A4 | ✅ **Done 2026-11-22** (`ci/deploy` #49, `fix/deploy-oidc-subject`): merging to `main` builds, pushes to ECR and deploys via GitHub OIDC; first real run deployed `732be5e`; automatic rollback tested. CD pipeline: on merge to `main`, build images, push, deploy. GitHub OIDC, no long-lived AWS keys in GitHub | M | A3 | Merging a PR updates the live site |
| A5 | ✅ **Done 2026-11-22** (`infra/https`): HTTPS via CloudFront at https://drk4col17f8z3.cloudfront.net, HTTP → HTTPS redirect, IP allowlist at the edge, server reachable only from CloudFront, `CORS_ORIGINS` = the site only; backend refuses a missing or dev `JWT_SECRET` (tested). HTTPS, production CORS, `APP_ENV=production`, real `JWT_SECRET` | S | A3 | Site loads over HTTPS; backend refuses the dev secret |
| A6 | ✅ **Done 2026-11-22** (`infra/monitoring`): container logs in CloudWatch (7 days), per-minute health metric, alarms for app down / 5xx errors / server status + budget (A2), all emailed via SNS; stopping the backend emailed an alarm after 4 min. Monitoring the app itself: logs, health-check alarm, error alarm, **budget alarm** | M | A3 | Alarm fires when `/health` fails; billing alert set |
| A7 | 🟡 **Partly done 2026-11-24** (#58, #59): the Accounts list reads the team's account and a member's account through a read-only role. Choosing an account on the AWS Cloud page and billing per account stay future work. Was: **Deferred to future work 2026-11-23**: needs new backend and frontend code plus a second AWS account, and the course code freeze is Nov 23. Design kept in `docs/architecture/aws-integration.md`. *(Stretch)* Monitor several AWS accounts with `sts:AssumeRole` (see `docs/architecture/aws-integration.md`) | M | A3 | Second account's EC2 shows on the dashboard |

## Track B: Backend & data (suggested: pshrestha49)

**The screens for B2–B5 are already built.** Build the endpoints to the shapes in
`docs/api/frontend-contract.md` → "Proposed endpoints" and they work with no frontend changes.

| # | Task | Size | Depends on | Done when |
| --- | --- | --- | --- | --- |
| B1 | ✅ **Done 2026-11-21** (`feature/database`). Real database for devices, metric history and alerts; replace `mock_data.py` | L | 0.2 | Dashboard data survives a restart; sample data only in tests |
| B2 | ✅ **Done 2026-11-21** (`feature/device-api`). Device / asset API: add, edit, delete devices (servers, VMs, containers, NAS, services) | M | B1 | Devices can be managed through the API |
| B3 | ✅ **Done 2026-11-21** (`feature/metrics-agent`). Metrics agent: small Python script (psutil) on a device that sends CPU, memory, disk and uptime every minute with a per-device key | L | B1, B2 | A homelab VM shows real numbers on the dashboard |
| B4 | ✅ **Done 2026-11-21** (`feature/alert-engine`). Alert engine: offline after X minutes, storage > 90%, CPU/memory thresholds; alerts open and resolve automatically; operator can acknowledge | M | B3 | Stopping the agent raises "device offline" |
| B5 | ✅ **Done 2026-11-21** (`feature/login-everywhere`). Require login on all dashboard endpoints; viewer read-only, operator acknowledges alerts, admin manages | M | – | Signed-out calls get 401; roles enforced |
| B6 | ✅ **Done 2026-11-21** (`feature/billing-cache`). Cache `/api/billing/summary` for 6–12 h and require login (Cost Explorer costs ~$0.01 per call) | S | – | Reloading the page doesn't call AWS again |
| B7 | ✅ **Done 2026-11-21** (`feature/user-management`). User management extras: change role, disable user, change own password | S | – | Admin can disable a user; user can change password |
| B8 | ✅ **Done 2026-11-20** (`fix/seed-windows-output`). Fix `seed.py` crashing on Windows when output is redirected (emoji in `print`) | XS | – | `python -m seed > out.txt` works on Windows |
| B9 | ✅ **Done 2026-11-21** (`feature/alert-notifications`). *(Stretch)* Notifications for critical alerts (email, SNS or Discord webhook) | M | B4 | Critical alert sends a message |

## Track C: Frontend, quality & docs (suggested: Tirth)

| # | Task | Size | Depends on | Done when |
| --- | --- | --- | --- | --- |
| C1 | ✅ **Done 2026-11-22**: checked against the real backend (B2). Device screens: add/edit device form, device detail page with history charts | M | B2 | Devices managed from the UI |
| C2 | ✅ **Done 2026-11-22**: checked against the real backend (B4). Alerts screen: acknowledge / resolve (operator), alert history | S | B4 | Operator can acknowledge from the UI |
| C3 | ✅ **Done 2026-11-22**: sign-in screen appears on 401 with the real backend (B5). Sign-in-required experience once B5 lands: redirect to sign in, hide actions a role can't use | S | B5 | Viewer never sees buttons they can't use |
| C4 | ✅ **Done 2026-11-22**: real agent reported using the key and command from the device page (B3). Agent setup page in the UI + install guide (copy device key, run command) | S | B3 | A teammate adds a device by following it |
| C5 | ✅ **Done 2026-11-20** (`test/frontend-tests`). Frontend tests: Vitest + React Testing Library for key screens; run in CI | M | – | CI fails when a tested screen breaks |
| C6 | ✅ **Done 2026-11-20** (`security/hardening`), see `docs/security/SECURITY_CHECKLIST.md`. Security validation: Dependabot, `npm audit` + `pip-audit` in CI, login rate limiting (with B), secrets scan, OWASP checklist written up | M | – | Checklist in `docs/`, scans green in CI |
| C7 | ✅ **Done 2026-11-24**: cloud drill passed (RTO 55 s, RPO 17 h 55 min, `docs/operations/DISASTER_RECOVERY.md`). **Local part done 2026-11-22**: backup/restore tool covers both databases + passed drill with both lost (`docs/operations/DISASTER_RECOVERY.md`); A3 is done, so the **cloud drill is ready to run** (steps in the same doc, with Aaron). Disaster recovery: database backup, restore drill, RTO/RPO written down (with Aaron) | M | A3, B1 | Data restored from backup in a timed test |
| C8 | ✅ **Done 2026-11-22**: guide updated to real data + AWS deployment diagram (Figure 11, redrawn 2026-11-23 for A3–A6). Final architecture docs: add the architecture guide to `docs/`, deployment diagram after A3 | S | A3 | Docs match what is deployed |
| C9 | ✅ **Done 2026-11-22**: workflow, config and coverage (`ci/sonarcloud`); Aaron imported the repo in SonarCloud and added the `SONAR_TOKEN` secret. The 39 issues from the first run on `main` go to each file's owner. SonarQube / SonarCloud code-quality scan on every PR (NFR-M5, professor requirement): scanner config + CI job + coverage; needs a SonarCloud project and `SONAR_TOKEN` secret | S | – | Every PR shows a SonarCloud quality-gate check |

---

## Finish line (everyone)

| # | Task | Size | Depends on |
| --- | --- | --- | --- |
| F1 | End-to-end MVP demo: agent on a homelab VM → live cloud dashboard → alert when it goes offline | M | A4, B4, C2 |
| F2 | Final report, presentation, demo video | M | F1 |
| F3 | Update README roadmap and `docs/PROGRESS.md` | S | – |

## Critical path

`0.2 decisions` → **B1 database** + **A2 Terraform** (in parallel) → **B3 agent** + **A3 app stack** → **B4 alerts** + **A4 CD** → **F1 demo** → **F2 report**

B1 and A2 are the two tasks that unlock the most, so start them first.
Tasks with no dependency (A1, B5, B6, B7, B8, C5, C6) can start any time.
