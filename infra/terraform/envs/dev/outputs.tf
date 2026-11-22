output "app_url" {
  description = "Open this in a browser (only from an IP in allowed_cidrs)"
  value       = "http://${aws_eip.app.public_ip}"
}

output "instance_id" {
  value = aws_instance.app.id
}

output "ssm_shell" {
  description = "Open a shell on the server (no SSH needed). Needs the Session Manager plugin installed."
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.region}"
}

output "github_deploy_role_arn" {
  description = "Role for GitHub Actions CD (A4)"
  value       = module.iam.github_deploy_role_arn
}

output "ecr_registry" {
  description = "Registry host for the deploy workflow"
  value       = split("/", aws_ecr_repository.app["backend"].repository_url)[0]
}

output "setup_log" {
  description = "Run inside the SSM shell to watch first-boot setup"
  value       = "sudo tail -f /var/log/cloudopshub-setup.log"
}
