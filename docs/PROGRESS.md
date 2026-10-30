# Project Progress Log

A running log of what the team has done, what is in progress, and what is next.
**Add an entry whenever you open a Pull Request.** Newest entries go at the top.

---

## Current Status

| Area                | Status                                              |
| ------------------- | --------------------------------------------------- |
| Planning docs       | ✅ Done (risk register, SWOT, mind map, workflow)   |
| Architecture docs   | 🟡 Started (`docs/architecture/`)                   |
| API contract        | 🟡 Updated (`docs/api/frontend-contract.md`)        |
| Frontend            | 🟡 Dashboard UI on mock data                        |
| Backend             | 🟡 FastAPI serving mock data                        |
| Authentication/RBAC | ✅ Done (JWT + Login UI + Admin/Operator/Viewer)    |
| CI/CD               | 🟡 CI on PRs (lint, build, tests); no CD yet        |
| Docker / Infra      | 🟡 Dockerfiles + compose written, needs test run    |
| Terraform / Cloud   | ⬜ Not started                                      |

## Next Up

- Decide on target cloud provider (AWS vs Azure) for Terraform
- Requirements specification document
- Replace mock data with real metrics collection (agent or cloud APIs)

---

## Log

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
