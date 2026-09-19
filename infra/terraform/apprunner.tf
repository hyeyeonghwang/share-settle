resource "aws_apprunner_vpc_connector" "main" {
  vpc_connector_name = local.prefix
  subnets            = aws_subnet.private[*].id
  security_groups    = [aws_security_group.app.id]
}

resource "aws_apprunner_auto_scaling_configuration_version" "main" {
  auto_scaling_configuration_name = replace(local.prefix, "-", "")

  min_size        = var.min_instances
  max_size        = var.max_instances
  max_concurrency = 100

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_apprunner_service" "main" {
  service_name = local.prefix

  source_configuration {
    # Roll out automatically whenever a new image lands on this tag. Set to
    # false to gate deploys behind an explicit `aws apprunner start-deployment`.
    auto_deployments_enabled = true

    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access.arn
    }

    image_repository {
      image_identifier      = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = "8080"

        runtime_environment_variables = {
          APP_ENV = "production"
          # Explicit belt and braces: production already defaults these off.
          DEMO_AUTH          = "false"
          SEED_DEMO_DATA     = "false"
          AUTO_CREATE_TABLES = "false"
          CORS_ALLOW_ORIGINS = join(",", var.cors_allow_origins)
        }

        runtime_environment_secrets = {
          DATABASE_URL = aws_secretsmanager_secret.database_url.arn
        }
      }
    }
  }

  instance_configuration {
    cpu               = var.app_cpu
    memory            = var.app_memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.main.arn
    }
  }

  health_check_configuration {
    protocol = "HTTP"
    path     = "/api/health"
    # The first start runs migrations before uvicorn binds, so allow a slow boot.
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.main.arn

  depends_on = [aws_secretsmanager_secret_version.database_url]
}

resource "aws_apprunner_custom_domain_association" "main" {
  count = var.custom_domain == "" ? 0 : 1

  domain_name          = var.custom_domain
  service_arn          = aws_apprunner_service.main.arn
  enable_www_subdomain = false
}
