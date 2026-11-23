# Monitoring the app itself (task A6).
#
#   containers ──awslogs──▶ CloudWatch Logs (/cloudopshub/dev/backend, /frontend; 7 days)
#   server timer (every minute) ──▶ metric CloudOpsHub/AppHealthy (1 = backend healthy AND site serves 200)
#   nginx access log ──metric filter──▶ CloudOpsHub/Http5xx
#
#   Alarms → SNS topic → email to var.alert_emails (each person confirms the subscription email once)
#     • app unhealthy for 3 minutes, or no health reports at all (server down)
#     • 5+ server errors (HTTP 5xx) in 5 minutes
#     • EC2 status check failed
#   Plus the monthly budget alarm (modules/budget, A2).

locals {
  metrics_namespace = "CloudOpsHub"
  log_groups        = toset(["backend", "frontend"])
}

# ── Where alarms go ──

resource "aws_sns_topic" "alarms" {
  name = "${local.name}-alarms"
}

resource "aws_sns_topic_subscription" "alarm_emails" {
  for_each = toset(var.alert_emails)

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = each.value
}

# ── Container logs ──

resource "aws_cloudwatch_log_group" "app" {
  for_each = local.log_groups

  name              = "/cloudopshub/dev/${each.key}"
  retention_in_days = var.log_retention_days
}

# Count HTTP 5xx responses in nginx's access log (standard format: status is the 6th field)
resource "aws_cloudwatch_log_metric_filter" "http_5xx" {
  name           = "${local.name}-http-5xx"
  log_group_name = aws_cloudwatch_log_group.app["frontend"].name
  pattern        = "[ip, ident, user, time, request, status=5*, ...]"

  metric_transformation {
    name          = "Http5xx"
    namespace     = local.metrics_namespace
    value         = "1"
    default_value = "0"
  }
}

# ── What the server needs: write logs and the health metric ──

data "aws_iam_policy_document" "server_monitoring" {
  statement {
    sid       = "ShipContainerLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
    resources = flatten([for g in aws_cloudwatch_log_group.app : [g.arn, "${g.arn}:*"]])
  }

  statement {
    sid       = "ReportHealth"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"] # PutMetricData has no resource ARNs; limited to our namespace below
    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = [local.metrics_namespace]
    }
  }
}

resource "aws_iam_role_policy" "server_monitoring" {
  name   = "CloudOpsHubServerMonitoring"
  role   = module.iam.instance_role_name
  policy = data.aws_iam_policy_document.server_monitoring.json
}

# ── Alarms ──

resource "aws_cloudwatch_metric_alarm" "app_unhealthy" {
  alarm_name          = "${local.name}-app-unhealthy"
  alarm_description   = "CloudOps Hub is down: backend unhealthy or site not serving for 3 minutes, or the server stopped reporting. Runbook: infra/terraform/README.md → Monitoring."
  namespace           = local.metrics_namespace
  metric_name         = "AppHealthy"
  dimensions          = { Environment = "dev" }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  datapoints_to_alarm = 3 # 3 bad minutes in a row: a normal deploy restart (~30 s) won't page anyone
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  treat_missing_data  = "breaching" # no reports = server down
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "http_5xx" {
  alarm_name          = "${local.name}-http-5xx"
  alarm_description   = "5 or more HTTP 5xx errors in 5 minutes (nginx access log). Check /cloudopshub/dev/backend logs."
  namespace           = local.metrics_namespace
  metric_name         = "Http5xx"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "server_status" {
  alarm_name          = "${local.name}-server-status-check"
  alarm_description   = "EC2 status check failed for the CloudOps Hub server (hardware or OS problem)."
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  treat_missing_data  = "missing"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}
