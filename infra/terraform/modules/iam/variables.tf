variable "name" {
  description = "Name prefix for IAM resources"
  type        = string
}

variable "secret_parameter_arns" {
  description = "SSM parameters the app may read (e.g. JWT secret)"
  type        = list(string)
}

variable "github_immutable_subject_prefix" {
  description = "OIDC subject prefix when the repo uses immutable subjects, e.g. repo:Owner@123/Repo@456 (see GET /repos/{owner}/{repo}/actions/oidc/customization/sub). Empty to skip."
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "GitHub repository allowed to assume the deploy role, as owner/name"
  type        = string
}
