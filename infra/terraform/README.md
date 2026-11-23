# Terraform

Infrastructure as Code for deploying CloudOps Hub to AWS. Owner: Aaron.

## Decisions (task 0.2)

Proposed by Aaron on 2026-11-20 (see `docs/PROGRESS.md`). Raise objections on the PR or in the team chat.

| Decision | Choice | Why |
| --- | --- | --- |
| Cloud provider | **AWS** | Everything built so far is AWS-based |
| Account / region | **Console Dot Dream, us-east-2** | That account only allows EC2 in us-east-2 (`docs/architecture/aws-integration.md`) |
| Hosting (phase 1) | **One EC2 instance running Docker Compose** | Cheapest working deployment, reuses `infra/docker-compose.yml`; ECS Fargate is a possible phase 2 |
| Database | **SQLite on a separate, persistent EBS disk** | Both databases (users; devices/metrics/alerts) survive server rebuilds; daily snapshots. RDS Postgres can be added later via `DATABASE_URL` |
| Remote state | **S3 with native locking** | `use_lockfile`, no DynamoDB table |
| Cost control | **$10/month budget** | Emails the team at $5, $10 and on a forecast overrun |

## Layout

```
terraform/
├── bootstrap/        One-time: S3 bucket for Terraform state
├── modules/
│   ├── budget/       Monthly cost budget + email alerts
│   ├── network/      VPC, public subnets in 2 AZs, internet gateway
│   └── iam/          App instance role + GitHub Actions OIDC deploy role
└── envs/
    └── dev/          Wires the modules together + EC2, security group, secret, Elastic IP
                      https.tf: CloudFront (HTTPS) + IP allowlist function
                      storage.tf: persistent data disk + daily snapshots
                      cd.tf: ECR repositories, deploy role permissions, live-version parameter
                      monitoring.tf: logs, health metric, alarms → email (SNS)
```

## What `envs/dev` creates

| Resource | Why |
| --- | --- |
| Budget (`modules/budget`) | Created first so costs can't surprise anyone. Credits excluded so it tracks real usage |
| VPC + 2 public subnets (`modules/network`) | Own network across 2 AZs; no NAT gateway (saves ~$32/month) |
| GitHub OIDC deploy role (`modules/iam`) | For CD (A4): only `main` of this repo can assume it; no AWS keys in GitHub |
| EC2 (Ubuntu 24.04, t3.micro) | Runs `infra/docker-compose.yml` plus production overrides |
| CloudFront (`https.tf`) | **HTTPS** at `https://<id>.cloudfront.net` (free AWS certificate); `http://` redirects to `https://`; a viewer-request function lets only `allowed_cidrs` in (403 for everyone else) |
| Security group | Port 80 **only from CloudFront** (AWS-managed prefix list); the server's IP can't be used directly; no SSH |
| IAM instance role | SSM Session Manager + the app's read-only AWS permissions (no access keys on the server) |
| SSM SecureString | Randomly generated `JWT_SECRET` |
| Elastic IP | Stable server address across rebuilds (CloudFront's origin) |
| Data disk (`storage.tf`) | 5 GB encrypted EBS volume mounted at `/srv/cloudopshub-data` = the backend's `/app/data` (both SQLite databases). Separate from the server, so it survives rebuilds; `prevent_destroy` guards it |
| Daily snapshots (`storage.tf`) | Data Lifecycle Manager snapshots the data disk every day at 07:00 UTC, keeps 7 |

On first boot, `user_data.sh.tftpl` installs Docker, waits for the data disk, formats it **only if it is
brand new**, mounts it, clones the repo, builds and starts the containers with `APP_ENV=production`, and seeds
the demo users (skipped if they already exist). The backend port is not published; nginx proxies `/api`.

### Continuous deployment (A4)

**Merging to `main` deploys automatically** (`.github/workflows/deploy.yml`, infrastructure in `envs/dev/cd.tf`):

1. GitHub Actions signs in with the **OIDC deploy role** (no AWS keys in GitHub; only `main` of this repo may assume it)
2. Builds the backend and frontend images and pushes them to **ECR**, tagged with the commit SHA (immutable; last 10 kept)
3. Runs `infra/scripts/deploy.sh` on the server through **SSM Run Command**: pull, restart, wait until healthy
4. **If the new version isn't healthy within 2 minutes, it rolls back** to the previous version and the workflow fails,
   so a bad merge never leaves the site down
5. Records the SHA in SSM (`/cloudopshub/dev/image_tag`), so a rebuilt server starts on the same version

The role trusts this repo's `main` branch in both GitHub token formats, including the repo's
**immutable subject** (`repo:AaronKingCloud@179765889/CloudOpsHub@1375278413:…`, set in `envs/dev/variables.tf`).
If the repo is ever transferred or recreated, update that value from
`GET /repos/{owner}/{repo}/actions/oidc/customization/sub`.

Redeploy by hand: **Actions → Deploy → Run workflow** (on `main`). The server must be running (not stopped).
The deploy role's permissions: ECR push to the two repositories, `ssm:SendCommand` on this one server, and
writing the live-version parameter. Nothing else.

### Rebuilding the server

The boot script runs once per server, so **any change to it replaces the server** (`user_data_replace_on_change`).
That is safe: the new server re-attaches the same data disk and starts on the last deployed version. To rebuild by hand:

```bash
terraform apply -replace=aws_instance.app
```

Downtime is ~2–5 minutes. Data, the IP and the JWT secret are kept.

### Rotating the JWT secret

```bash
terraform apply -replace=random_password.jwt_secret -replace=aws_instance.app
```

Generates a new secret, stores it in SSM and rebuilds the server so it loads it. Everyone has to sign in again.

> Never commit `tfplan` files: they contain the state, **including secrets**. `infra/terraform/.gitignore` blocks them.

### Monitoring (A6)

| What | Where |
| --- | --- |
| Container logs (7 days) | CloudWatch → Log groups → `/cloudopshub/dev/backend`, `/cloudopshub/dev/frontend` |
| Health metric | `CloudOpsHub/AppHealthy` (1 = backend healthy **and** site serves 200), sent every minute by a systemd timer on the server (`cloudopshub-health.timer`) |
| Server errors | `CloudOpsHub/Http5xx`, counted from nginx's access log by a metric filter |

**Alarms** (each emails `alert_emails` through the SNS topic `cloudopshub-dev-alarms`, and again when it recovers):

| Alarm | Fires when |
| --- | --- |
| `cloudopshub-dev-app-unhealthy` | 3 bad minutes in a row, **or no reports** (server down). A normal deploy (~30 s) doesn't trigger it; a server rebuild does |
| `cloudopshub-dev-http-5xx` | 5+ HTTP 5xx responses within 5 minutes |
| `cloudopshub-dev-server-status-check` | EC2 status check fails for 3 minutes |
| Budget (A2) | $5, $10, or a forecast overrun this month |

**Device alerts (B9):** the backend's alert engine publishes every **critical** device alert (device offline, or CPU,
memory or disk at 90% or more) to the same topic, so the team gets an email titled `[CloudOps Hub] Critical: <hostname>`.
The server gets the topic as `ALERT_SNS_TOPIC_ARN` and may publish only to that topic (`SendDeviceAlerts` in `monitoring.tf`).

New subscribers must click **Confirm subscription** in the first email from AWS Notifications, or they get nothing.

**When an alarm fires:**

1. Open the site. If it loads, check the newest entries in the `/cloudopshub/dev/backend` log group.
2. Shell on the server (`ssm_shell` output), then `cd /opt/cloudopshub/infra && docker compose ps` and `docker logs --tail 50 cloudops-backend`.
3. A container down: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build`.
4. A bad deploy: re-run the last good **Deploy** workflow, or roll forward with a fix. Server gone: `terraform apply -replace=aws_instance.app`.

### Restoring from a snapshot (for the DR drill, C7)

EC2 console → **Snapshots** → pick a `cloudopshub-dev-data` snapshot → **Create volume** (same AZ as the
server), or test it on a separate instance. To make a restored volume the live one, import it into the
Terraform state in place of `aws_ebs_volume.data`. Full procedure: `docs/operations/DISASTER_RECOVERY.md`.

## Usage

Prerequisites: Terraform >= 1.10, an AWS CLI profile with permission to create these resources
(e.g. `aws login --profile cloudopshub-admin`), region us-east-2.

```powershell
$env:AWS_PROFILE = "cloudopshub-admin"
```

**1. State bucket (once per account):**

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply
```

**2. Dev environment:**

```bash
cd ../envs/dev
copy terraform.tfvars.example terraform.tfvars   # then set allowed_cidrs (your IP) and alert_emails
terraform init
terraform plan
terraform apply
```

First boot takes ~10 minutes (Docker install + image builds). Then open the `app_url` output (the HTTPS address).

**Who can open the site:** the IPs in `allowed_cidrs`, checked by CloudFront. To add a teammate, add their
`x.x.x.x/32` and run `terraform apply` (updates the function in ~1 minute, no rebuild).

**Shell access / logs:** use the `ssm_shell` output (needs the
[Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)),
then `sudo tail -f /var/log/cloudopshub-setup.log`.

**Save credits:** stop the instance when not in use (`aws ec2 stop-instances --instance-ids <id>`),
or `terraform destroy` to remove everything except the state bucket and the data disk
(`prevent_destroy` blocks deleting the disk; remove that line first if you really mean it).

## Known limitations (phase 1)

- One server: no high availability (see NFR-A6 in `docs/requirements/REQUIREMENTS.md`).
- Snapshots stay in us-east-2; a copy in another Region would need the account's Region guardrail lifted.
- HTTPS ends at CloudFront; CloudFront → server is HTTP inside AWS's network (the server only accepts CloudFront).
- No custom domain (would need DNS + an ACM certificate in us-east-1); the `cloudfront.net` address is used instead.
- The backend sees CloudFront's address as the client IP, so the login lockout's "per address" part is per CloudFront edge.
- A deploy restarts the containers: ~10–30 s of downtime (one server, no load balancer).

Never commit `*.tfstate` or `terraform.tfvars`; they are in `.gitignore`.
