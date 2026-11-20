variable "name" {
  description = "Name prefix for network resources"
  type        = string
}

variable "cidr_block" {
  description = "VPC address range"
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "Number of Availability Zones (one public subnet each)"
  type        = number
  default     = 2
}
