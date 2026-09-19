#!/usr/bin/env bash
# Build the image, push it to ECR, and roll out App Runner.
#
# Run `terraform apply` at least once first: this script needs the ECR
# repository to exist. On a first-ever apply that is a chicken-and-egg problem,
# so see infra/README.md for the two-step bootstrap.
set -euo pipefail

cd "$(dirname "$0")/.."
TF_DIR=infra/terraform

tf() { terraform -chdir="$TF_DIR" output -raw "$1"; }

REPO_URL="$(tf ecr_repository_url)"
SERVICE_ARN="$(tf apprunner_service_arn 2>/dev/null || true)"
REGION="$(terraform -chdir="$TF_DIR" output -raw region 2>/dev/null || aws configure get region)"
TAG="${1:-$(git rev-parse --short HEAD)}"

echo "Building ${REPO_URL}:${TAG}"
# App Runner runs on x86_64; build for it explicitly so an arm64 laptop does not
# produce an image the service cannot start.
docker build --platform linux/amd64 -t "${REPO_URL}:${TAG}" -t "${REPO_URL}:latest" .

echo "Logging in to ECR"
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "${REPO_URL%%/*}"

echo "Pushing"
docker push "${REPO_URL}:${TAG}"
docker push "${REPO_URL}:latest"

if [ -n "$SERVICE_ARN" ]; then
  echo "Starting deployment"
  aws apprunner start-deployment --service-arn "$SERVICE_ARN" --region "$REGION" >/dev/null
  echo "Rolling out. Watch with:"
  echo "  aws apprunner describe-service --service-arn $SERVICE_ARN --region $REGION --query 'Service.Status'"
fi
