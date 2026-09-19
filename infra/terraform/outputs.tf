output "service_url" {
  description = "Public HTTPS URL of the application."
  value       = "https://${aws_apprunner_service.main.service_url}"
}

output "ecr_repository_url" {
  description = "Push target for the container image."
  value       = aws_ecr_repository.app.repository_url
}

output "apprunner_service_arn" {
  description = "Used by the deploy script to trigger a rollout."
  value       = aws_apprunner_service.main.arn
}

output "database_endpoint" {
  description = "RDS endpoint. Private to the VPC; reachable only from the app."
  value       = aws_db_instance.main.address
}

output "database_secret_arn" {
  description = "Secrets Manager entry holding the connection string."
  value       = aws_secretsmanager_secret.database_url.arn
}

output "custom_domain_validation_records" {
  description = "DNS records to create for the custom domain, if one is set."
  value       = var.custom_domain == "" ? [] : tolist(aws_apprunner_custom_domain_association.main[0].certificate_validation_records)
}

output "region" {
  description = "Region the stack is deployed in, for the deploy script."
  value       = var.region
}
