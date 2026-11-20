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

variable "root_volume_size_gb" {
  description = "Root disk size. Also holds the SQLite database volume while we're on SQLite."
  type        = number
  default     = 20
}
