# Terraform

Infrastructure as Code for deploying CloudOps Hub to AWS. Owner: Aaron.

## Decisions

- [x] Cloud provider: **AWS**, region **us-east-2** (Console Dot Dream only allows EC2 there; see `docs/architecture/aws-integration.md`)
- [x] Hosting model (phase 1): **one EC2 instance running Docker Compose**. Cheapest path to a working deployment; ECS Fargate is a possible phase 2.
- [x] Remote state: **S3 with native locking** (`use_lockfile`, no DynamoDB)
- [ ] Database: SQLite on the instance's disk for now. Revisit if we move to RDS.

## Layout

```
terraform/
├── bootstrap/        One-time: S3 bucket for Terraform state
└── envs/
    └── dev/          EC2 + security group + IAM role + Elastic IP
```

## What `envs/dev` creates

| Resource | Why |
| --- | --- |
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
copy terraform.tfvars.example terraform.tfvars   # then set allowed_cidrs to your IP
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

- Uses the default VPC; a dedicated VPC module is a later improvement.
- SQLite lives on the instance's root disk: survives stop/start, **lost if the instance is replaced**.
- HTTP only (no domain/TLS yet).
- Deploys by building on the instance; CD (GitHub Actions + OIDC) is next.

Never commit `*.tfstate` or `terraform.tfvars`; they are in `.gitignore`.
