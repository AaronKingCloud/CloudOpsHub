variable "name" {
  description = "Name prefix for IAM resources"
  type        = string
}

variable "secret_parameter_arns" {
  description = "SSM parameters the app may read (e.g. JWT secret)"
  type        = list(string)
}

variable "github_repo" {
  description = "GitHub repository allowed to assume the deploy role, as owner/name"
  type        = string
}
