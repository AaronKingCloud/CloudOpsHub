# Dev environment: one EC2 instance running the app with Docker Compose.
#
#   browser --:80--> [security group: allowed_cidrs only] --> EC2 (Ubuntu 24.04, public subnet)
#                                                              ├─ nginx (frontend container) :80
#                                                              └─ FastAPI (backend container), internal only
#
# No SSH: shell access is through SSM Session Manager.
# No AWS keys on the instance: the backend uses the instance role (modules/iam).

locals {
  name = "cloudopshub-dev"
}

# ── Cost guardrail (created first so spending can't surprise anyone) ──

module "budget" {
  source = "../../modules/budget"

  name              = local.name
  monthly_limit_usd = var.monthly_budget_usd
  alert_emails      = var.alert_emails
}

# ── Network ──

module "network" {
  source = "../../modules/network"

  name = local.name
}

resource "aws_security_group" "app" {
  name        = "${local.name}-app"
  description = "CloudOps Hub web access"
  vpc_id      = module.network.vpc_id
}

# Since A5 the server only accepts traffic from CloudFront (https.tf); the IP allowlist runs at CloudFront.
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_vpc_security_group_ingress_rule" "from_cloudfront" {
  security_group_id = aws_security_group.app.id
  description       = "HTTP from CloudFront only"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.app.id
  description       = "Outbound for package installs, git, Docker Hub, AWS APIs"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ── Secrets: JWT signing key, generated once and stored encrypted in SSM ──

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "jwt_secret" {
  name        = "/cloudopshub/dev/jwt_secret"
  description = "JWT signing key for the CloudOps Hub backend"
  type        = "SecureString"
  value       = random_password.jwt_secret.result
}

# ── IAM: app role + GitHub Actions OIDC role ──

module "iam" {
  source = "../../modules/iam"

  name                  = local.name
  secret_parameter_arns = [aws_ssm_parameter.jwt_secret.arn]
  github_repo           = var.github_repo

  github_immutable_subject_prefix = var.github_immutable_subject_prefix
}

# IAM resources moved from this file into modules/iam: keep them, don't recreate
moved {
  from = aws_iam_role.instance
  to   = module.iam.aws_iam_role.instance
}

moved {
  from = aws_iam_role_policy_attachment.ssm_core
  to   = module.iam.aws_iam_role_policy_attachment.ssm_core
}

moved {
  from = aws_iam_role_policy.app
  to   = module.iam.aws_iam_role_policy.app
}

moved {
  from = aws_iam_instance_profile.instance
  to   = module.iam.aws_iam_instance_profile.instance
}

# ── Compute ──

data "aws_ssm_parameter" "ubuntu_ami" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.ubuntu_ami.value
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnet.app.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = module.iam.instance_profile_name

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    repo_url        = var.repo_url
    git_ref         = var.git_ref
    region          = var.region
    jwt_param       = aws_ssm_parameter.jwt_secret.name
    data_volume_id  = aws_ebs_volume.data.id
    tag_param       = aws_ssm_parameter.image_tag.name
    ecr_registry    = split("/", aws_ecr_repository.app["backend"].repository_url)[0]
    site_url        = local.site_url
    log_prefix      = "/cloudopshub/dev" # log groups in monitoring.tf
    account_name    = var.account_name
    accounts_param  = aws_ssm_parameter.monitored_accounts.name
    alert_topic_arn = aws_sns_topic.alarms.arn # backend sends critical device alerts here
  })
  # The boot script only runs on first boot, so a changed script means a fresh server.
  # Safe since A3: the data lives on the separate volume (storage.tf), not on this server.
  user_data_replace_on_change = true

  metadata_options {
    http_tokens                 = "required" # IMDSv2 only
    http_put_response_hop_limit = 2          # lets the backend container reach the instance role
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_size_gb
    encrypted   = true
  }

  tags = {
    Name = local.name
  }

  lifecycle {
    # A new Ubuntu AMI is published often; don't replace the server every time.
    ignore_changes = [ami]
  }

  # The containers log to these groups at startup (awslogs driver), so they and the permission must exist first
  depends_on = [aws_cloudwatch_log_group.app, aws_iam_role_policy.server_monitoring]
}

# The address exists on its own and is attached separately, so CloudFront (https.tf) can point at it
# while the server's boot script gets CloudFront's URL, without a dependency loop.
resource "aws_eip" "app" {
  domain = "vpc"

  tags = {
    Name = local.name
  }
}

resource "aws_eip_association" "app" {
  instance_id   = aws_instance.app.id
  allocation_id = aws_eip.app.id
}
