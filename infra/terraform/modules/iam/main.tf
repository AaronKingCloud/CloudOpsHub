# IAM for CloudOps Hub:
#  1. App role: used by the server running the backend. Replaces long-lived access keys.
#  2. GitHub OIDC role: assumed by GitHub Actions for CD (A4). No AWS keys stored in GitHub.

# ── 1. App role ──

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
  name               = "${var.name}-instance"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

# Shell access through SSM Session Manager (no SSH)
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "app" {
  # Exactly the actions the backend calls (docs/architecture/aws-integration.md)
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
    sid       = "ReadAppSecrets"
    actions   = ["ssm:GetParameter"]
    resources = var.secret_parameter_arns
  }
}

resource "aws_iam_role_policy" "app" {
  name   = "CloudOpsHubApp"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_iam_instance_profile" "instance" {
  name = "${var.name}-instance"
  role = aws_iam_role.instance.name
}

# ── 2. GitHub Actions OIDC role ──
# Only workflows running on this repo's main branch can assume it.
# Permissions are added with the CD pipeline (A4); for now it can only prove its identity.

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name                 = "${var.name}-github-deploy"
  description          = "Assumed by GitHub Actions (main branch of ${var.github_repo}) for CD"
  assume_role_policy   = data.aws_iam_policy_document.github_assume.json
  max_session_duration = 3600
}
