# Project Progress Log

A running log of what the team has done, what is in progress, and what is next.
**Add an entry whenever you open a Pull Request.** Newest entries go at the top.

---

## Current Status

| Area                | Status                                              |
| ------------------- | --------------------------------------------------- |
| Planning docs       | ✅ Done (risk register, SWOT, mind map, workflow)   |
| Architecture docs   | 🟡 Started (`docs/architecture/`)                   |
| API contract        | 🟡 Draft (`docs/api/frontend-contract.md`)          |
| Frontend            | 🟡 Dashboard UI on mock data                        |
| Backend             | ⬜ Not started                                      |
| CI/CD               | ⬜ Not started                                      |
| Docker / Infra      | ⬜ Not started                                      |
| Terraform / Cloud   | ⬜ Not started                                      |

## Next Up

- Decide on target cloud provider (AWS vs Azure) for Terraform
- Requirements specification document
- Replace mock data with real metrics collection (agent or cloud APIs)

---

## Log

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
