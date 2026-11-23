# Code Quality with SonarQube (SonarCloud)

Requirement **NFR-M5** (professor): code quality is scanned with SonarQube on every pull request.
We use **SonarCloud** (SonarQube Cloud), the hosted SonarQube that is free for public repositories,
so there is no server to run or pay for.

## What it does

On every push and every PR, `.github/workflows/sonarcloud.yml`:

1. runs the frontend tests with coverage (`npm run test:coverage` → `frontend/coverage/lcov.info`)
2. runs the backend tests with coverage (`pytest --cov` → `backend/coverage.xml`)
3. sends the code and both reports to SonarCloud, which checks for **bugs, vulnerabilities, security
   hotspots, code smells, duplication and coverage**, and posts a **Quality Gate** check on the PR

Settings: `sonar-project.properties` (what is analysed, where the coverage reports are, what is excluded).

Coverage on 2026-11-23: backend **96 %**, frontend **73 %** (lines).

## One-time setup (needs the repo owner, Aaron)

**Done by Aaron on 2026-11-22.** The steps are kept here in case it ever needs redoing.

The repo belongs to the `AaronKingCloud` account, so the SonarCloud import and the secret need that
account (collaborators can't add repository secrets).

1. Go to <https://sonarcloud.io> → **Log in with GitHub** (as AaronKingCloud).
2. **+ → Analyze new project** → choose the `AaronKingCloud` organization (create it when asked; the free plan
   is fine for a public repo) → select **CloudOpsHub** → **Set up**.
3. Check the keys SonarCloud shows match `sonar-project.properties`:
   `sonar.organization=aaronkingcloud` and `sonar.projectKey=AaronKingCloud_CloudOpsHub`. If they differ,
   change the file to what SonarCloud shows.
4. **Analysis method:** pick **With GitHub Actions**, and in **Administration → Analysis Method** turn
   **Automatic Analysis off** (it can't run together with CI analysis).
5. Copy the **SONAR_TOKEN** SonarCloud shows. In GitHub: **Settings → Secrets and variables → Actions →
   New repository secret**, name `SONAR_TOKEN`, paste the token. Never put the token in a file.
6. Re-run the **SonarCloud** workflow (Actions tab) or push to any PR. The PR now shows a
   **SonarCloud Code Analysis** check.
7. *(Optional)* **Settings → Branches → Branch protection** for `main`: require the SonarCloud check.

Without the token the workflow still runs the tests but **skips the scan with a notice**. Dependabot PRs can't
read secrets, so they skip the scan.

The job installs Python packages from `backend/requirements-ci.lock` (exact versions + hashes). After changing
`requirements.txt` or `requirements-dev.txt`, regenerate it with the command at the top of that file.

## Reading the results

- On a PR: the **SonarCloud Code Analysis** check is green when the Quality Gate passes. **Details**
  opens the issues found in that PR's new code.
- The default **Sonar way** Quality Gate checks *new code*: no new bugs or vulnerabilities, security
  hotspots reviewed, ≥ 80 % coverage on new code, ≤ 3 % duplication.
- Fix real issues in the same PR. If an issue is a false positive, mark it in SonarCloud with a short
  reason (don't silence it in code).

## Run the coverage reports locally

```bash
cd frontend && npm run test:coverage      # summary in the terminal, report in frontend/coverage/
cd backend  && pytest --cov=app --cov=scripts --cov-report=term
```

Both report folders/files are git-ignored.
