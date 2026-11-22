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
                      storage.tf: persistent data disk + daily snapshots
```

## What `envs/dev` creates

| Resource | Why |
| --- | --- |
| Budget (`modules/budget`) | Created first so costs can't surprise anyone. Credits excluded so it tracks real usage |
| VPC + 2 public subnets (`modules/network`) | Own network across 2 AZs; no NAT gateway (saves ~$32/month) |
| GitHub OIDC deploy role (`modules/iam`) | For CD (A4): only `main` of this repo can assume it; no AWS keys in GitHub |
| EC2 (Ubuntu 24.04, t3.micro) | Runs `infra/docker-compose.yml` plus production overrides |
| Security group | Port 80 **only from `allowed_cidrs`**; no SSH |
| IAM instance role | SSM Session Manager + the app's read-only AWS permissions (no access keys on the server) |
| SSM SecureString | Randomly generated `JWT_SECRET` |
| Elastic IP | Stable address across stop/start and rebuilds |
| Data disk (`storage.tf`) | 5 GB encrypted EBS volume mounted at `/srv/cloudopshub-data` = the backend's `/app/data` (both SQLite databases). Separate from the server, so it survives rebuilds; `prevent_destroy` guards it |
| Daily snapshots (`storage.tf`) | Data Lifecycle Manager snapshots the data disk every day at 07:00 UTC, keeps 7 |

On first boot, `user_data.sh.tftpl` installs Docker, waits for the data disk, formats it **only if it is
brand new**, mounts it, clones the repo, builds and starts the containers with `APP_ENV=production`, and seeds
the demo users (skipped if they already exist). The backend port is not published; nginx proxies `/api`.

### Redeploying (until CD, A4)

The boot script runs once per server, so **any change to it replaces the server** (`user_data_replace_on_change`).
That is safe: the new server re-attaches the same data disk. To redeploy the latest `main` without changes:

```bash
terraform apply -replace=aws_instance.app
```

Downtime is ~5–10 minutes while the new server builds. Data, the IP and the JWT secret are kept.

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

First boot takes ~10 minutes (Docker install + image builds). Then open the `app_url` output.

**Shell access / logs:** use the `ssm_shell` output (needs the
[Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)),
then `sudo tail -f /var/log/cloudopshub-setup.log`.

**Save credits:** stop the instance when not in use (`aws ec2 stop-instances --instance-ids <id>`),
or `terraform destroy` to remove everything except the state bucket and the data disk
(`prevent_destroy` blocks deleting the disk; remove that line first if you really mean it).

## Known limitations (phase 1)

- One server: no high availability (see NFR-A6 in `docs/requirements/REQUIREMENTS.md`).
- Snapshots stay in us-east-2; a copy in another Region would need the account's Region guardrail lifted.
- HTTP only (no domain/TLS yet).
- Deploys by building on the instance; CD (GitHub Actions + OIDC) is next.

Never commit `*.tfstate` or `terraform.tfvars`; they are in `.gitignore`.
