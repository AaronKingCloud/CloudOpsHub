# Continuous deployment (task A4).
#
#   merge to main → GitHub Actions (OIDC role, no keys) → build images → push to ECR (tag = commit SHA)
#                 → SSM Run Command on the server: pull, restart, health-check, roll back on failure
#                 → on success, record the tag in SSM so a rebuilt server starts on the same version
#
# Workflow: .github/workflows/deploy.yml · Server script: infra/scripts/deploy.sh

locals {
  repositories = toset(["backend", "frontend"])
}

# ── Container registry ──

resource "aws_ecr_repository" "app" {
  for_each = local.repositories

  name                 = "cloudopshub/${each.key}"
  image_tag_mutability = "IMMUTABLE" # a commit SHA always means the same image
  force_delete         = true        # images are rebuildable from Git

  image_scanning_configuration {
    scan_on_push = true # free basic vulnerability scan
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  for_each   = aws_ecr_repository.app
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last ${var.images_to_keep} images (rollback room, minimal storage cost)"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = var.images_to_keep
      }
      action = { type = "expire" }
    }]
  })
}

# ── Which version is live ──
# "none" = never deployed through CD; the server then builds the images itself.

resource "aws_ssm_parameter" "image_tag" {
  name        = "/cloudopshub/dev/image_tag"
  description = "Image tag (commit SHA) currently deployed; written by the deploy workflow"
  type        = "String"
  value       = "none"

  lifecycle {
    ignore_changes = [value] # owned by CD after creation
  }
}

# ── What the GitHub Actions deploy role may do ──
# Defined here (not in modules/iam) because it names this environment's server and repositories.

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPushPull"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [for r in aws_ecr_repository.app : r.arn]
  }

  statement {
    sid       = "FindServer"
    actions   = ["ec2:DescribeInstances"]
    resources = ["*"]
  }

  statement {
    sid     = "RunDeployOnThisServerOnly"
    actions = ["ssm:SendCommand"]
    resources = [
      aws_instance.app.arn,
      "arn:aws:ssm:${var.region}::document/AWS-RunShellScript",
    ]
  }

  statement {
    sid       = "ReadDeployResult"
    actions   = ["ssm:GetCommandInvocation"]
    resources = ["*"]
  }

  statement {
    sid       = "RecordLiveVersion"
    actions   = ["ssm:GetParameter", "ssm:PutParameter"]
    resources = [aws_ssm_parameter.image_tag.arn]
  }
}

# The server itself pulls images and reads which tag is live (separate from the app's own permissions)
data "aws_iam_policy_document" "server_pull" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid       = "EcrPull"
    actions   = ["ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"]
    resources = [for r in aws_ecr_repository.app : r.arn]
  }

  statement {
    sid       = "ReadLiveVersion"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.image_tag.arn]
  }
}

resource "aws_iam_role_policy" "server_pull" {
  name   = "CloudOpsHubServerPull"
  role   = module.iam.instance_role_name
  policy = data.aws_iam_policy_document.server_pull.json
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "CloudOpsHubDeploy"
  role   = module.iam.github_deploy_role_name
  policy = data.aws_iam_policy_document.github_deploy.json
}
