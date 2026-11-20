terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State lives in the bucket created by ../../bootstrap.
  # use_lockfile = S3-native state locking (no DynamoDB table needed).
  backend "s3" {
    bucket       = "cloudopshub-tfstate-451513982298"
    key          = "envs/dev/terraform.tfstate"
    region       = "us-east-2"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "CloudOpsHub"
      Environment = "dev"
      ManagedBy   = "Terraform"
    }
  }
}
