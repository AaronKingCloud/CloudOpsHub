# Dev environment: one EC2 instance running the app with Docker Compose.
#
#   browser --:80--> [security group: allowed_cidrs only] --> EC2 (Ubuntu 24.04)
#                                                              ├─ nginx (frontend container) :80
#                                                              └─ FastAPI (backend container), internal only
#
# No SSH: shell access is through SSM Session Manager.
# No AWS keys on the instance: the backend uses the instance role.

locals {
  name = "cloudopshub-dev"
}

# ── Network: default VPC for now (a dedicated VPC module can replace this later) ──

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

resource "aws_security_group" "app" {
  name        = "${local.name}-app"
  description = "CloudOps Hub web access"
  vpc_id      = data.aws_vpc.default.id
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  for_each = toset(var.allowed_cidrs)

  security_group_id = aws_security_group.app.id
  description       = "HTTP from allowed IP"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = each.value
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

# ── IAM: instance role (SSM access + the app's read-only AWS permissions) ──

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = "${local.name}-instance"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "app" {
  # Same actions as the cloudopshub-service user (docs/architecture/aws-integration.md)
  statement {
    sid = "AppReadOnly"
    actions = [
      "sts:GetCallerIdentity",
      "ec2:DescribeInstances",
      "cloudwatch:GetMetricStatistics",
      "ce:GetCostAndUsage",
      "ce:GetCostForecast",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "ReadJwtSecret"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.jwt_secret.arn]
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "CloudOpsHubApp"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_iam_instance_profile" "instance" {
  name = "${local.name}-instance"
  role = aws_iam_role.instance.name
}

# ── Compute ──

data "aws_ssm_parameter" "ubuntu_ami" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.ubuntu_ami.value
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.instance.name

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    repo_url  = var.repo_url
    git_ref   = var.git_ref
    region    = var.region
    jwt_param = aws_ssm_parameter.jwt_secret.name
  })

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
}

resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = local.name
  }
}
