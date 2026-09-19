terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.40, < 7.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state is worth setting up before more than one person runs apply.
  # backend "s3" {
  #   bucket       = "your-tf-state-bucket"
  #   key          = "share-settle/terraform.tfstate"
  #   region       = "ap-northeast-2"
  #   use_lockfile = true
  #   encrypt      = true
  # }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Application = var.name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
