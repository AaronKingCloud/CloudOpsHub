# AWS accounts shown on the dashboard.
#
#   backend --sts:AssumeRole + external ID--> CloudOpsHubReadOnly role in each account (short-lived credentials)
#
# The account owner creates that role (docs/architecture/aws-integration.md). Adding an account to
# monitored_accounts updates the parameter and the policy only; the server isn't replaced.

locals {
  monitored_role_arns = [for a in var.monitored_accounts : "arn:aws:iam::${a.account_id}:role/CloudOpsHubReadOnly"]
}

resource "aws_ssm_parameter" "monitored_accounts" {
  name        = "/cloudopshub/dev/monitored_accounts"
  description = "Other AWS accounts shown on the CloudOps Hub dashboard"
  type        = "SecureString"
  value = jsonencode([for i, a in var.monitored_accounts : {
    name        = a.name
    role_arn    = local.monitored_role_arns[i]
    external_id = a.external_id
    region      = a.region
  }])
}

data "aws_iam_policy_document" "server_accounts" {
  statement {
    sid       = "ReadAccountList"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.monitored_accounts.arn]
  }

  statement {
    sid       = "ReadOwnAlarms"
    actions   = ["cloudwatch:DescribeAlarms"]
    resources = ["*"]
  }

  dynamic "statement" {
    for_each = length(local.monitored_role_arns) > 0 ? [1] : []
    content {
      sid       = "ReadOtherAccounts"
      actions   = ["sts:AssumeRole"]
      resources = local.monitored_role_arns
    }
  }
}

resource "aws_iam_role_policy" "server_accounts" {
  name   = "CloudOpsHubServerAccounts"
  role   = module.iam.instance_role_name
  policy = data.aws_iam_policy_document.server_accounts.json
}
