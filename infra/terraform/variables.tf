variable "name" {
  description = "Name prefix for every resource."
  type        = string
  default     = "share-settle"
}

variable "environment" {
  description = "Environment name, used in tags and resource names."
  type        = string
  default     = "prod"
}

variable "region" {
  description = "AWS region. App Runner is not available in every region."
  type        = string
  default     = "ap-northeast-2"
}

variable "image_tag" {
  description = "Tag of the image in ECR to deploy. Push it before the first apply."
  type        = string
  default     = "latest"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "app_cpu" {
  description = "App Runner vCPU, e.g. 0.25 vCPU, 0.5 vCPU, 1 vCPU, 2 vCPU."
  type        = string
  default     = "0.5 vCPU"
}

variable "app_memory" {
  description = "App Runner memory, e.g. 0.5 GB, 1 GB, 2 GB, 3 GB, 4 GB."
  type        = string
  default     = "1 GB"
}

variable "min_instances" {
  description = "Instances kept warm. 1 is the minimum App Runner allows."
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Upper bound on scaled-out instances."
  type        = number
  default     = 4
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS storage in GB. Storage autoscaling raises it up to db_max_allocated_storage."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Ceiling for RDS storage autoscaling."
  type        = number
  default     = 100
}

variable "db_engine_version" {
  description = "PostgreSQL major version."
  type        = string
  default     = "16"
}

variable "db_backup_retention_days" {
  description = "Days of automated RDS backups. 0 disables them."
  type        = number
  default     = 7
}

variable "db_deletion_protection" {
  description = "Block `terraform destroy` from deleting the database."
  type        = bool
  default     = true
}

variable "cors_allow_origins" {
  description = "Extra origins allowed to call the API. The SPA is same-origin, so this is usually empty."
  type        = list(string)
  default     = []
}

variable "custom_domain" {
  description = "Optional custom domain to associate with the service, e.g. app.example.com. Empty means use the *.awsapprunner.com URL."
  type        = string
  default     = ""
}
