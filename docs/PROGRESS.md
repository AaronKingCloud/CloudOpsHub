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
| Frontend            | 🟡 Prototype                                        |
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
