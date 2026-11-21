# CloudOps Hub — Requirements Specification

Task **0.3** · Draft by Aaron, 2026-11-20 · **Status: in team review** (comment on the PR)

What CloudOps Hub must do for the capstone MVP, how well it must do it, and what we are deliberately
not building. Every requirement maps to an existing feature or a task in
[`docs/REMAINING_WORK.md`](../REMAINING_WORK.md), so nothing here is "nobody's job".

**Sources:** `README.md`, `docs/planning/` (SWOT, risk register, mind map), `docs/REMAINING_WORK.md`,
`docs/api/frontend-contract.md`, `docs/operations/DISASTER_RECOVERY.md`, `docs/security/SECURITY_CHECKLIST.md`,
infrastructure decisions (task 0.2) in `infra/terraform/README.md`.

**Status legend:** ✅ works today (✅ *PR #33* = deployed, Terraform PR awaiting merge) · 🟡 partly (e.g. screen built, backend pending; or runs on sample data) · ⬜ not started
**Priority:** **MVP** = needed for the final demo · **Should** = expected, cut only if time runs out · **Stretch** = only if ahead

---

## 1. MVP scope

The MVP proves one end-to-end story (task **F1**):

> A small agent on a **Linux homelab VM** reports CPU, memory, disk and uptime to **CloudOps Hub running in AWS**.
> A signed-in user sees the device on the dashboard with live numbers and history. When the VM stops reporting,
> an **"offline" alert** opens automatically, an operator acknowledges it, and it resolves when the VM comes back.
> The same dashboard shows the connected **AWS account**: EC2 instances, their CPU, and this month's cost.

Per risk **R001 (scope creep)**, anything not needed for that story is *Should*, *Stretch* or out of scope (section 5).

### Users and roles

| Role | Who | Can |
| --- | --- | --- |
| **Viewer** | Family member, client, manager | See everything, change nothing |
| **Operator** | Homelab owner, IT staff | Viewer + acknowledge / resolve alerts, manage devices |
| **Admin** | Project owner | Operator + manage users |

---

## 2. Functional requirements

### Accounts and access

| ID | Requirement | Priority | Status | Maps to |
| --- | --- | --- | --- | --- |
| FR-1 | Users sign in with username and password and receive a session token (JWT) | MVP | ✅ | Auth (done) |
| FR-2 | Every user has exactly one role: admin, operator or viewer | MVP | ✅ | Auth (done) |
| FR-3 | Admins can create users and list all users | MVP | ✅ | Auth, Users page (done) |
| FR-4 | Every dashboard, device, alert, metric, account and billing endpoint requires sign-in; signed-out requests get 401 | MVP | 🟡 only `/aws/*` today | B5, C3 |
| FR-5 | Each role only sees the actions it may use, and the API enforces the same rules (403 otherwise) | MVP | 🟡 | B5, C3 |
| FR-6 | After 5 failed sign-ins in 15 minutes, that username + address is locked out for the rest of the window | MVP | ✅ | C6 (done) |
| FR-7 | Admins can change a user's role and disable a user; users can change their own password | Should | ⬜ | B7 |

### Devices (asset inventory)

| ID | Requirement | Priority | Status | Maps to |
| --- | --- | --- | --- | --- |
| FR-8 | Operators can add, edit and delete devices of type server, VM, container, NAS or service | MVP | 🟡 screens built | B2, C1 |
| FR-9 | Each device shows status (online / offline), CPU %, memory %, storage % and last-seen time | MVP | 🟡 sample data | B1, B3 |
| FR-10 | A device detail page shows that device's metric history as charts | MVP | 🟡 screen built | B1, C1 |

### Monitoring

| ID | Requirement | Priority | Status | Maps to |
| --- | --- | --- | --- | --- |
| FR-11 | An agent installed on a Linux device sends CPU, memory, disk and uptime **every 60 seconds**, authenticated with a per-device key | MVP | ⬜ (install guide written) | B3, C4 |
| FR-12 | Metric history and device data are stored in a database and survive a backend restart or redeploy | MVP | ⬜ sample data in code | B1, A3 |
| FR-13 | The overview shows online, offline and total devices, active alerts, and CPU / memory / storage charts | MVP | 🟡 sample data | B1 (screen done) |
| FR-14 | The dashboard refreshes automatically (default every 30 s) and can be refreshed manually | Should | ✅ | Frontend (done) |

### Alerting

| ID | Requirement | Priority | Status | Maps to |
| --- | --- | --- | --- | --- |
| FR-15 | A device that misses **3 reports in a row** (3 min at the 60 s interval, as in the API contract) is marked offline and raises a **critical "device offline"** alert | MVP | ⬜ | B3, B4 |
| FR-16 | Threshold alerts: storage > 90 % critical; CPU or memory > 90 % critical, > 70 % warning (same thresholds as the UI) | MVP | ⬜ | B4 |
| FR-17 | Alerts open and resolve automatically when the condition starts and ends | MVP | ⬜ | B4 |
| FR-18 | Operators can acknowledge and resolve alerts; past alerts remain in an alert history | MVP | 🟡 screen built | B4, C2 |
| FR-19 | Critical alerts are sent as a notification (email, SNS or Discord webhook) | Stretch | ⬜ | B9 |

### Cloud accounts

| ID | Requirement | Priority | Status | Maps to |
| --- | --- | --- | --- | --- |
| FR-20 | Show the connected AWS account (account ID, identity) | MVP | ✅ | AWS integration (done) |
| FR-21 | List the account's EC2 instances (name, state, type, AZ, IP, launch time) | MVP | ✅ | AWS integration (done) |
| FR-22 | Show an EC2 instance's CPU from CloudWatch (last 1–24 h, 5-minute points) | MVP | ✅ | AWS integration (done) |
| FR-23 | Show month-to-date AWS cost and the month-end forecast | Should | ✅ uncached | Billing (done), B6 |
| FR-24 | Monitor **several** AWS accounts, each with its own read-only role and home Region | Stretch | ⬜ | A7 (+ backend) |

---

## 3. Non-functional requirements

Numbers marked *(target)* are new proposals; they get measured during the final demo prep (F1).

### Security

| ID | Requirement | Status | Maps to |
| --- | --- | --- | --- |
| NFR-S1 | All traffic to the deployed site uses **HTTPS**; HTTP redirects to HTTPS | ⬜ | A5 |
| NFR-S2 | Passwords are stored only as bcrypt hashes | ✅ | Auth (done) |
| NFR-S3 | Access tokens expire after **30 min**, refresh tokens after **7 days**; the deployed backend refuses to start with the development signing key | ✅ | Auth, A2/A3 (`APP_ENV=production`) |
| NFR-S4 | **No secrets in Git**: every push is scanned (gitleaks) and fails on a finding; deployed secrets live in SSM Parameter Store / Secrets Manager | ✅ | C6, A2 |
| NFR-S5 | **No long-lived AWS keys** in the cloud or in GitHub: the server uses an IAM role, CD uses GitHub OIDC; every AWS permission is read-only and listed in `docs/architecture/aws-integration.md` | 🟡 role done (PR #33), CD pending | A2, A4 |
| NFR-S6 | Dependency audits block the build on any **high or critical** vulnerability (npm) / any known vulnerability (pip) | ✅ | C6 |
| NFR-S7 | Only the web port is reachable from the internet; the API container, database and SSH are not exposed (admin access via SSM Session Manager) | ✅ *PR #33* | A2 |
| NFR-S8 | Browser security headers on every page (CSP without inline scripts, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`) | ✅ | C6, A1 |
| NFR-S9 | The OWASP Top 10 checklist is kept current with every security-relevant change | ✅ | C6 |

### Availability and recovery

| ID | Requirement | Status | Maps to |
| --- | --- | --- | --- |
| NFR-A1 | **RTO ≤ 30 min**: the service can be fully restored within 30 minutes of a failure | 🟡 local drill passed | C7, A3 |
| NFR-A2 | **RPO ≤ 24 h** now (daily backups); **≤ 5 min** once the managed cloud database exists | 🟡 | C7, B1, A3 |
| NFR-A3 | Containers restart automatically after a crash or server reboot; each exposes a health check (`GET /health`) | ✅ | A1 |
| NFR-A4 | If `/health` fails, the team gets an email alarm **within 5 minutes** | ⬜ | A6 |
| NFR-A5 | A failed deployment leaves the previous version running | ⬜ | A4 |
| NFR-A6 | MVP runs as a **single instance** (no high-availability guarantee); recovery is covered by NFR-A1 | ✅ by design | 0.2 decision |

### Cost

| ID | Requirement | Status | Maps to |
| --- | --- | --- | --- |
| NFR-C1 | AWS spend stays **≤ $10 / month**; the team is emailed at **$5**, **$10** and on a forecast overrun | ✅ *PR #33* | A2 |
| NFR-C2 | Use free-tier-eligible resources where possible; no NAT gateway or other always-on paid extras without team agreement | ✅ *PR #33* | A2 |
| NFR-C3 | Cost Explorer (≈ $0.01 per call) is called **at most once per 6 h** per account, never on a timer | ⬜ | B6 |

### Performance *(targets)*

| ID | Requirement | Status | Maps to |
| --- | --- | --- | --- |
| NFR-P1 | Dashboard pages load in **≤ 3 s** on a normal home connection | ⬜ measure | F1 |
| NFR-P2 | Dashboard API endpoints (not AWS calls) respond in **≤ 500 ms** (95th percentile) | ⬜ measure | B1, F1 |
| NFR-P3 | The deployed t3.micro handles **≥ 20 devices** reporting every 60 s | ⬜ measure | B3, F1 |
| NFR-P4 | A new agent reading appears on the dashboard within **one refresh cycle (≤ 90 s)** | ⬜ | B3, F1 |

### Maintainability and delivery

| ID | Requirement | Status | Maps to |
| --- | --- | --- | --- |
| NFR-M1 | Every pull request runs lint, type-check, tests and security scans; nothing merges with a failing check | ✅ | CI, C5, C6 |
| NFR-M2 | Every PR is approved by one other team member before merge, and adds a `docs/PROGRESS.md` entry | 🟡 rule agreed, not enforced in GitHub | Team process |
| NFR-M3 | **All** cloud resources are created by Terraform with remote state; no hand-made resources | 🟡 | A2, A3 |
| NFR-M4 | Merging to `main` deploys automatically | ⬜ | A4 |
| NFR-M5 | Code quality scanned with **SonarQube** on every PR | ⬜ | Professor requirement; Tirth (CI owner) |

### Usability and compatibility

| ID | Requirement | Status | Maps to |
| --- | --- | --- | --- |
| NFR-U1 | Usable on phone and desktop screens (responsive layout, phone menu) | ✅ | Frontend (done) |
| NFR-U1b | Works in current Chrome, Edge and Firefox *(target: check all three before the demo)* | 🟡 Chrome/Edge used so far | F1 |
| NFR-U2 | Light, dark and system themes | ✅ | Frontend (done) |
| NFR-U3 | The agent supports **Linux** (x86-64) first; a teammate can install it by following `docs/agent/INSTALL.md` | ⬜ | B3, C4 (per risk R002) |

---

## 4. Constraints

- **AWS only**, account *Console Dot Dream*, region **us-east-2** (the account only allows EC2 there; see `docs/architecture/aws-integration.md`).
- Hosting phase 1: **one EC2 instance running Docker Compose** (task 0.2 decision, `infra/terraform/README.md`).
- Budget: AWS credits plus at most $10/month real spend (NFR-C1).
- Team of three, fixed semester deadline; ownership per `docs/REMAINING_WORK.md` tracks A / B / C.

## 5. Out of scope (MVP)

From the mind map's *Premium* and *Business* features and the SWOT "large scope" weakness. These go to a
Future Enhancements backlog and need team approval to pull in (risk R001).

- Integrations with Proxmox, TrueNAS, Unraid, Docker APIs or Home Assistant (risk R003: generic Linux first)
- **Azure** subscriptions (the account model allows them; MVP is AWS only)
- Windows and macOS agents
- Service health checks (HTTP/port probes), certificate expiry, backup monitoring, port exposure analysis
- Multi-tenancy, teams, product tiers (Homelab / Pro / Business), compliance reporting
- Password reset by email, single sign-on, mobile app
- High availability (multiple instances, load balancer, multi-AZ database)

## 6. Gaps found while writing this

Things the planning docs or security checklist expect, but **no task covers yet**. Team to decide: add a task or move to section 5.

| Gap | Source | Suggestion |
| --- | --- | --- |
| Audit log of sign-ins, lockouts and user changes | OWASP A09, mind map "Audit Logs" | Out of scope for MVP, *or* small add-on to B7 |
| Refresh tokens are not revoked on sign-out | Security checklist A07 | Out of scope; document as accepted risk |
| "Uptime" and "service health" metrics | README "Planned capabilities", mind map | Uptime is in B3; service health → out of scope (section 5) |
| SonarQube | Professor, added late | Needs an owner and a task row (suggest Tirth, track C) |

## 7. Review

Each teammate: check the requirements in your track, then approve the PR or comment.

- [ ] Aaron (track A)
- [ ] pshrestha49 (track B)
- [ ] Tirth (track C)
