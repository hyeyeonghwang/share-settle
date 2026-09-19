resource "random_password" "db" {
  length = 32
  # RDS rejects '/', '@', '"' and spaces in a master password, and the value
  # also ends up inside a URL, so keep it to characters that need no escaping.
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_db_subnet_group" "main" {
  name       = local.prefix
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier     = local.prefix
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  db_name  = "sharesettle"
  username = "sharesettle"
  password = random_password.db.result
  port     = 5432

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false

  backup_retention_period = var.db_backup_retention_days
  backup_window           = "17:00-18:00" # UTC; 02:00-03:00 KST
  maintenance_window      = "Mon:18:00-Mon:19:00"

  auto_minor_version_upgrade = true
  deletion_protection        = var.db_deletion_protection
  skip_final_snapshot        = false
  final_snapshot_identifier  = "${local.prefix}-final-${formatdate("YYYYMMDDhhmmss", timestamp())}"

  performance_insights_enabled = false

  lifecycle {
    # timestamp() changes on every plan; the snapshot name only matters on destroy.
    ignore_changes = [final_snapshot_identifier]
  }
}

locals {
  # The application reads one DATABASE_URL. psycopg3 needs the +psycopg scheme:
  # bare postgresql:// makes SQLAlchemy look for psycopg2, which is not installed.
  database_url = format(
    "postgresql+psycopg://%s:%s@%s:%d/%s",
    aws_db_instance.main.username,
    urlencode(random_password.db.result),
    aws_db_instance.main.address,
    aws_db_instance.main.port,
    aws_db_instance.main.db_name,
  )
}

# The URL carries the password, so it lives in Secrets Manager and App Runner
# injects it at runtime. It never appears in the service's plaintext env vars.
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${local.prefix}/database-url"
  description             = "SQLAlchemy connection string for ${local.prefix}"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = local.database_url
}
