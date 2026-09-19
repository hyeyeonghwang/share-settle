# A small VPC holding only the database and the App Runner egress interfaces.
#
# There is no NAT gateway on purpose. App Runner's VPC connector routes the
# service's *outbound* traffic through these subnets, and this application talks
# to nothing but its own database. Pulling the container image and serving
# inbound requests both happen on App Runner's side of the fence, not through
# the connector, so private subnets with no internet path are enough -- and they
# save the ~$32/month a NAT gateway costs. Add one only if the app later needs
# to reach an external API.

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  prefix = "${var.name}-${var.environment}"

  # RDS subnet groups need at least two AZs even for a single-AZ instance.
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = local.prefix }
}

resource "aws_subnet" "private" {
  count = length(local.azs)

  vpc_id            = aws_vpc.main.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)

  tags = { Name = "${local.prefix}-private-${local.azs[count.index]}" }
}

resource "aws_security_group" "app" {
  name        = "${local.prefix}-app"
  description = "App Runner VPC connector egress"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.prefix}-app" }
}

resource "aws_security_group" "db" {
  name        = "${local.prefix}-db"
  description = "PostgreSQL, reachable only from the application"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.prefix}-db" }
}

# Rules live outside the groups so the two can reference each other.
resource "aws_vpc_security_group_egress_rule" "app_to_db" {
  security_group_id            = aws_security_group.app.id
  description                  = "PostgreSQL"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.db.id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL from the application"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.app.id
}
