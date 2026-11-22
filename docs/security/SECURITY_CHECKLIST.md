# Security Checklist

How CloudOps Hub handles the [OWASP Top 10 (2021)](https://owasp.org/Top10/), what is automated,
and what is still open. Update this file whenever a security-relevant change lands.

Last reviewed: 2026-11-22 · Status: ✅ done · 🟡 partly · ⬜ open

## Automated checks

| Check | Where | Runs | Fails the build when |
| --- | --- | --- | --- |
| Frontend dependency audit | `.github/workflows/security.yml` → `npm audit --audit-level=high` | every push, PR, weekly | a high or critical advisory exists |
| Backend dependency audit | `security.yml` → `pip-audit -r requirements.txt` | every push, PR, weekly | any known vulnerability exists |
| Secret scan (whole history) | `security.yml` → gitleaks v8.30.1, config in `.gitleaks.toml` | every push, PR, weekly | a key, token or private key is found |
| Dependency updates | `.github/dependabot.yml` | weekly (actions monthly) | opens PRs instead of failing |
| Backend tests (auth, roles, rate limit, headers) | `backend.yml` → `pytest` | PRs touching `backend/` | any test fails |
| Frontend tests (roles, login errors, token refresh) | `frontend.yml` → `npm test` | PRs touching `frontend/` | any test fails |

Run the same checks locally:

```bash
cd frontend && npm audit --audit-level=high
cd backend  && pip install pip-audit==2.9.0 && pip-audit -r requirements.txt
```

Results on 2026-11-20: `npm audit` found 1 high (`follow-redirects`, used by axios) and 9 moderate
(`minimatch`, lint tools only); fixed with `npm audit fix`, now 0. `pip-audit`: no known vulnerabilities.
Manual scan of the full Git history: no AWS keys, private keys, tokens, `.env` files or databases.

## OWASP Top 10 (2021)

| # | Risk | Status | What we do | Still open |
| --- | --- | --- | --- | --- |
| A01 | Broken access control | ✅ | **Every data endpoint requires a JWT** (B5; only `/health`, login, refresh and the agent's key-authenticated `/agent/metrics` are public, tested in `test_all_data_endpoints_require_login`); admin-only user and device management, operator+admin alert actions (403 otherwise); disabled users are rejected at once; frontend hides what a role can't use (`utils/permissions.ts`) | – |
| A02 | Cryptographic failures | 🟡 | Passwords hashed with bcrypt + salt; JWT signed HS256; backend refuses the dev JWT secret when `APP_ENV=production` | HTTPS not set up yet → task A5; tokens are in `localStorage` (see A03) |
| A03 | Injection | ✅ | All SQL uses parameter placeholders (`?`); Pydantic validates every request body; React escapes output; CSP blocks inline and third-party scripts (nginx) | – |
| A04 | Insecure design | 🟡 | Least-privilege IAM role (read-only AWS actions); AWS calls never auto-refresh; **Cost Explorer cached 6 h and behind login** (B6); login lockout after 5 failures / 15 min; agent keys stored only as SHA-256 hashes and shown once | Threat model not written |
| A05 | Security misconfiguration | 🟡 | Security headers on API (`nosniff`, `DENY` framing, `no-referrer`, `no-store` on auth) and on nginx (CSP, Permissions-Policy, `server_tokens off`, no CSP errors, checked by Aaron); CORS limited to configured origins; Docker backend runs as non-root; deployed backend port closed, no SSH | Production CORS / domain → A5 |
| A06 | Vulnerable and outdated components | ✅ | `npm audit` + `pip-audit` in CI (blocking), Dependabot weekly | – |
| A07 | Identification and authentication failures | 🟡 | Login lockout (`app/auth/rate_limit.py`); short access tokens (30 min) + refresh (7 days); generic "Incorrect username or password" (also for disabled accounts); **users can change their password** (needs the current one) and **admins can disable accounts** (B7 + screens); demo-login buttons excluded from production builds | No self-service password reset; no refresh-token revocation on sign-out; lockout is in memory (per process) |
| A08 | Software and data integrity failures | 🟡 | Exact-version lockfiles (`package-lock.json`); CI installs with `npm ci`; workflows have read-only `contents` permission | Backend Python deps use version ranges (consider a lock file); CD signing not set up (A4) |
| A09 | Security logging and monitoring failures | ⬜ | – | No audit log of logins / lockouts / user changes; no alerting → A6 |
| A10 | Server-side request forgery | ✅ | Backend only calls fixed AWS SDK endpoints; the alert webhook URL (B9) comes only from the `ALERT_WEBHOOK_URL` env var, never from a request, and must be `https://` | – |

## Known limitations (accepted for now)

- **Tokens in `localStorage`.** Any script running on the page could read them. The CSP (nginx) blocks inline
  and third-party scripts, which is the main protection. Moving to `HttpOnly` cookies would need CSRF protection
  and a backend change; revisit before a public launch.
- **Lockout is per username.** Someone who knows a username can lock that account for 15 minutes by guessing.
  This is the usual trade-off; a CAPTCHA or per-address limits behind the proxy would reduce it.
- **Lockout state is in memory.** It resets when the backend restarts, and several backend instances count
  separately. Use Redis (or the database) if we run more than one instance.

## Settings

| Env var | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `development` | `production` makes the backend refuse the dev JWT secret |
| `JWT_SECRET` | dev placeholder | Token signing key; required in production |
| `LOGIN_MAX_ATTEMPTS` | `5` | Failed logins allowed per username + address in the window |
| `LOGIN_WINDOW_SECONDS` | `900` | Lockout window (15 minutes) |
| `CORS_ORIGINS` | `http://localhost:5173` | Sites allowed to call the API |
