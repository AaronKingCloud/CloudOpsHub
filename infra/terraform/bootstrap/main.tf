# One-time setup: the S3 bucket that stores Terraform state for every environment.
#
# Run once per AWS account (state for this folder stays local and is gitignored):
#   cd infra/terraform/bootstrap
#   terraform init
#   terraform apply

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "CloudOpsHub"
      ManagedBy = "Terraform"
    }
  }
}

variable "region" {
  description = "AWS region for the state bucket (Console Dot Dream only allows us-east-2)"
  type        = string
  default     = "us-east-2"
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "tfstate" {
  # Account ID keeps the name globally unique
  bucket = "cloudopshub-tfstate-${data.aws_caller_identity.current.account_id}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "state_bucket" {
  value = aws_s3_bucket.tfstate.bucket
}
