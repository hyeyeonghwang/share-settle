# Deploying Share & Settle to AWS

The application is one container: FastAPI serves the built SPA and the `/api`
routes together on port 8080. This directory deploys that container on **AWS App
Runner**, backed by a private **RDS PostgreSQL** instance.

```
      internet ──HTTPS──> App Runner ──VPC connector──> RDS PostgreSQL
                              │                            (private subnets)
                              └── image from ECR
                              └── DATABASE_URL from Secrets Manager
```

App Runner terminates TLS, gives the service a `*.awsapprunner.com` hostname,
and scales instances for you. The database is not reachable from the internet:
its security group accepts traffic only from the App Runner VPC connector.

There is deliberately **no NAT gateway**. The connector carries the service's
outbound traffic, and this application talks to nothing but its own database.
Image pulls and inbound requests happen on App Runner's side, not through the
connector, so the private subnets need no internet path — which saves about
$32/month. Add a NAT gateway only if the app later calls an external API.

## What it costs

Roughly **$35–45/month** in `ap-northeast-2` at idle:

| Resource | Monthly |
| --- | --- |
| App Runner, 0.5 vCPU / 1 GB, 1 instance always on | ~$20 |
| RDS `db.t4g.micro`, 20 GB gp3, 7-day backups | ~$15 |
| Secrets Manager, ECR storage, data transfer | ~$2 |

App Runner bills provisioned memory continuously and vCPU only while requests
are being served, so a quiet service costs much less than a busy one. Dropping
`min_instances` to 1 is already the floor — App Runner cannot scale to zero.

## Prerequisites

- Terraform >= 1.6, Docker, and the AWS CLI v2, all authenticated
  (`aws sts get-caller-identity` should succeed)
- An IAM principal that can create VPC, RDS, ECR, IAM, Secrets Manager and App
  Runner resources

## First deploy

The service cannot start without an image, and the image cannot be pushed
without a repository, so the first apply is two steps.

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # edit region and sizes
terraform init

# 1. Create the ECR repository on its own.
terraform apply -target=aws_ecr_repository.app

# 2. Build and push the image.
cd ../.. && ./infra/deploy.sh

# 3. Create everything else. RDS takes 5-10 minutes.
cd infra/terraform && terraform apply

terraform output service_url
```

Open the URL. The app starts with an empty database — no demo accounts — so
register an account through the sign-up form.

## Subsequent deploys

```bash
./infra/deploy.sh            # tags the image with the current git SHA
```

`auto_deployments_enabled` is on, so pushing to the `latest` tag is enough to
trigger a rollout; the script also calls `start-deployment` explicitly. Watch it
with:

```bash
aws apprunner describe-service \
  --service-arn "$(terraform -chdir=infra/terraform output -raw apprunner_service_arn)" \
  --query 'Service.Status'
```

To roll back, set `image_tag` in `terraform.tfvars` to an older git SHA and
apply. That is why `deploy.sh` pushes an immutable SHA tag alongside `latest`.

## Database migrations

The container runs `alembic upgrade head` before starting uvicorn, so a deploy
migrates its own schema. Alembic locks its version table, so instances starting
at the same time serialise rather than race.

Two consequences worth knowing:

- A migration that fails takes the deployment down with it. App Runner keeps the
  previous version serving, so a bad migration is a failed deploy, not an
  outage — but check the logs rather than assuming a rollout succeeded.
- Migrations and the new code ship together. For a change that would break the
  running version (dropping a column it still reads), do it in two deploys:
  one that stops using the column, then one that drops it.

Set `RUN_MIGRATIONS=0` to skip the step if you would rather run migrations by
hand.

To add a migration after changing a model:

```bash
uv run alembic revision --autogenerate -m "what changed"
uv run alembic check        # should report no new operations
```

## Configuration

App Runner sets these; see [backend/config.py](../backend/config.py).

| Variable | Value in production | Effect |
| --- | --- | --- |
| `APP_ENV` | `production` | Turns off every demo convenience below by default |
| `DEMO_AUTH` | `false` | `/api/auth/google`, `/api/auth/demo` and `/api/auth/demo/accounts` return 404. These hand out a session with no credential |
| `SEED_DEMO_DATA` | `false` | An empty database stays empty instead of gaining four accounts that share a published password |
| `AUTO_CREATE_TABLES` | `false` | Alembic owns the schema, not `create_all` |
| `CORS_ALLOW_ORIGINS` | empty | The SPA is same-origin, so no cross-origin caller is trusted |
| `DATABASE_URL` | from Secrets Manager | Injected at runtime; never in plaintext config |

## Custom domain

Set `custom_domain` in `terraform.tfvars`, apply, then create the DNS records
from `terraform output custom_domain_validation_records` plus a CNAME from your
domain to `terraform output service_url`. App Runner issues and renews the
certificate once validation passes.

## Operations

```bash
# Logs
aws logs tail /aws/apprunner/share-settle-prod/<service-id>/application --follow

# Connect to the database (it is private: go through a bastion or
# `aws ssm start-session` port forward in the same VPC)
terraform -chdir=infra/terraform output database_endpoint
```

Automated RDS backups are on with 7-day retention, and `terraform destroy` is
blocked on the database by `db_deletion_protection`. To tear the stack down,
set that to `false`, apply, then destroy — a final snapshot is taken.

## Known gaps

- **Auth tokens never expire.** `auth_tokens` rows live until sign-out. Worth a
  TTL and a cleanup job before this carries real accounts.
- **No WAF or rate limiting** in front of App Runner. `/api/auth/login` can be
  brute-forced. AWS WAF can attach to App Runner directly if that matters.
- **Single-AZ database.** `db.t4g.micro` with no standby: an AZ failure means
  restoring from a snapshot. Set `multi_az = true` on the instance to change
  that, roughly doubling its cost.
