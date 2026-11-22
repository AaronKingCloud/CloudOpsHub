output "instance_profile_name" {
  value = aws_iam_instance_profile.instance.name
}

output "instance_role_arn" {
  value = aws_iam_role.instance.arn
}

output "instance_role_name" {
  value = aws_iam_role.instance.name
}

output "github_deploy_role_name" {
  value = aws_iam_role.github_deploy.name
}

output "github_deploy_role_arn" {
  description = "Use as role-to-assume in aws-actions/configure-aws-credentials (A4)"
  value       = aws_iam_role.github_deploy.arn
}
