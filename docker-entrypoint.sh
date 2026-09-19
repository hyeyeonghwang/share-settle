#!/bin/sh
# Bring the database schema up to date, then serve.
#
# App Runner has no separate migration task, so the container migrates itself on
# start. Alembic takes a lock on its version table, so concurrent instances
# starting together serialise rather than racing.
set -e

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "Running database migrations..."
  alembic upgrade head
fi

exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8080}"
