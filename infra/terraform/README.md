# Terraform

Infrastructure as Code for deploying CloudOps Hub to AWS. Owner: Aaron.

## Decisions (task 0.2)

Proposed by Aaron on 2026-11-20 (see `docs/PROGRESS.md`). Raise objections on the PR or in the team chat.

| Decision | Choice | Why |
| --- | --- | --- |
| Cloud provider | **AWS** | Everything built so far is AWS-based |
| Account / region | **Console Dot Dream, us-east-2** | That account only allows EC2 in us-east-2 (`docs/architecture/aws-integration.md`) |
| Hosting (phase 1) | **One EC2 instance running Docker Compose** | Cheapest working deployment, reuses `infra/docker-compose.yml`; ECS Fargate is a possible phase 2 |
| Database | **SQLite on the instance for now** | Pending pshrestha49's B1 decision; RDS Postgres can be added without redoing this |
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
| Elastic IP | Stable address across stop/start |

On first boot, `user_data.sh.tftpl` installs Docker, clones the repo, builds and starts the containers
with `APP_ENV=production`, and seeds the demo users. The backend port is not published; nginx proxies `/api`.

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
or `terraform destroy` to remove everything except the state bucket.

## Known limitations (phase 1)

- SQLite lives on the instance's root disk: survives stop/start, **lost if the instance is replaced**.
- HTTP only (no domain/TLS yet).
- Deploys by building on the instance; CD (GitHub Actions + OIDC) is next.

Never commit `*.tfstate` or `terraform.tfvars`; they are in `.gitignore`.
