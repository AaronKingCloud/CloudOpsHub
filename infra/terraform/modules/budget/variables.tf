variable "name" {
  description = "Name prefix for the budget"
  type        = string
}

variable "monthly_limit_usd" {
  description = "Monthly budget in USD"
  type        = number
}

variable "alert_thresholds_percent" {
  description = "Email when actual spend passes these percentages of the limit"
  type        = list(number)
  default     = [50, 100]
}

variable "alert_emails" {
  description = "Who gets budget emails"
  type        = list(string)
}
