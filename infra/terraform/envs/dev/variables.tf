variable "region" {
  description = "AWS region. Console Dot Dream only allows EC2 in us-east-2."
  type        = string
  default     = "us-east-2"
}

variable "instance_type" {
  description = "EC2 size. t3.micro is free tier eligible; user data adds swap so the images can build."
  type        = string
  default     = "t3.micro"
}

variable "allowed_cidrs" {
  description = "Who may open the app on port 80, e.g. [\"203.0.113.10/32\"] (your public IP). Keeps the demo logins off the open internet."
  type        = list(string)

  validation {
    condition     = length(var.allowed_cidrs) > 0 && !contains(var.allowed_cidrs, "0.0.0.0/0")
    error_message = "Set allowed_cidrs to specific IPs; 0.0.0.0/0 would expose the default demo logins to everyone."
  }
}

variable "repo_url" {
  description = "Git repository the instance clones and builds"
  type        = string
  default     = "https://github.com/AaronKingCloud/CloudOpsHub.git"
}

variable "git_ref" {
  description = "Branch or tag to deploy"
  type        = string
  default     = "main"
}

variable "alert_emails" {
  description = "Team emails for budget alerts. Set in terraform.tfvars (gitignored), not here."
  type        = list(string)

  validation {
    condition     = length(var.alert_emails) > 0
    error_message = "Add at least one email so budget alerts reach someone."
  }
}

variable "monthly_budget_usd" {
  description = "Monthly budget; emails go out at 50% and 100% (default: $5 and $10) and on a forecast overrun"
  type        = number
  default     = 10
}

variable "github_repo" {
  description = "Repository whose main branch may assume the CD deploy role"
  type        = string
  default     = "AaronKingCloud/CloudOpsHub"
}

variable "data_volume_size_gb" {
  description = "Size of the separate disk holding both databases (/app/data)"
  type        = number
  default     = 5
}

variable "snapshot_retention_days" {
  description = "How many daily snapshots of the data disk to keep"
  type        = number
  default     = 7
}

variable "root_volume_size_gb" {
  description = "Root disk size. Also holds the SQLite database volume while we're on SQLite."
  type        = number
  default     = 20
}
