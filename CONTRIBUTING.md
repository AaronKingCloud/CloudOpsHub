# Contributing to CloudOps Hub

This guide explains how to get the project running on your machine
and how we work together with Git so nobody overwrites anyone else's work.

## 1. Prerequisites

| Tool    | Version | Needed for            |
| ------- | ------- | --------------------- |
| Git     | any     | everything            |
| Node.js | 22+     | `frontend/`           |
| Python  | 3.12+   | `backend/`            |
| Docker  | any     | `infra/` (optional)   |

## 2. Getting the code

```bash
git clone https://github.com/AaronKingCloud/CloudOpsHub.git
cd CloudOpsHub
```

Already cloned? Update before starting any work:

```bash
git checkout main
git pull origin main
```

## 3. Running the project

### Frontend

```bash
cd frontend
npm install        # only needed the first time or after package.json changes
npm run dev        # http://localhost:5173
```

> ⚠️ Always run `npm install` **inside `frontend/`**, never in the repo root.
> Running it in the root creates a stray `node_modules/` and `package.json`.

### Backend

See [`backend/README.md`](backend/README.md).

### Everything with Docker

See [`infra/README.md`](infra/README.md).

## 4. Branching workflow

`main` is always the stable version. **Never commit directly to `main`.**

1. Update main: `git checkout main && git pull`
2. Create a branch: `git checkout -b <type>/<short-description>`
3. Commit small, focused changes
4. Push: `git push -u origin <branch-name>`
5. Open a Pull Request on GitHub into `main`
6. Another team member reviews and merges

### Branch naming

| Prefix      | Use for                              | Example                    |
| ----------- | ------------------------------------ | -------------------------- |
| `feature/`  | New functionality                    | `feature/dashboard-ui`     |
| `fix/`      | Bug fixes                            | `fix/chart-not-rendering`  |
| `chore/`    | Cleanup, config, dependencies        | `chore/repo-cleanup`       |
| `docs/`     | Documentation only                   | `docs/architecture-update` |
| `ci/`       | GitHub Actions / pipelines           | `ci/github-actions`        |
| `infra/`    | Docker, Terraform, deployment        | `infra/docker`             |

### Commit messages

Short, lowercase, present tense, describing *what* changed:

```
add stat card component
fix cpu chart axis labels
update api contract for alerts endpoint
```

## 5. Before opening a Pull Request

- [ ] Frontend: `npm run lint` and `npm run build` pass in `frontend/`
- [ ] Backend: `pytest` passes in `backend/`
- [ ] You updated [`docs/PROGRESS.md`](docs/PROGRESS.md) with what you did
- [ ] If you changed an API response shape, you updated
      [`docs/api/frontend-contract.md`](docs/api/frontend-contract.md)

## 6. Where things live

| I want to...                         | Go to                         |
| ------------------------------------ | ----------------------------- |
| Add a UI component                   | `frontend/src/components/`    |
| Change mock data                     | `frontend/src/mock/`          |
| Change how the frontend fetches data | `frontend/src/services/`      |
| Add or change an API endpoint        | `backend/app/routers/`        |
| Change Docker setup                  | `infra/`                      |
| Change CI                            | `.github/workflows/`          |
| Read design decisions                | `docs/architecture/`          |
