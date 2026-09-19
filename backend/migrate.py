"""Bring the database schema up to date, then hand off to the server.

Run as `python -m backend.migrate`.

Plain `alembic upgrade head` is not enough on its own. Before Alembic existed
here the schema was created by SQLAlchemy's `create_all`, which leaves no
version table behind. Running the initial migration against such a database
would try to create tables that are already there and fail, so a pre-Alembic
database is stamped at the initial revision first and then upgraded normally.
"""

import sys

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import inspect

from .database import get_engine

INITIAL_REVISION = "dec7af75991c"


def _alembic_config() -> Config:
    config = Config("alembic.ini")
    # alembic.ini deliberately carries no URL; env.py reads DATABASE_URL.
    return config


def upgrade() -> None:
    engine = get_engine()
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    config = _alembic_config()

    if "alembic_version" not in tables and "users" in tables:
        print("Existing pre-Alembic schema found; stamping initial revision.")
        command.stamp(config, INITIAL_REVISION)
    elif not tables:
        print("Empty database; applying migrations from scratch.")

    with engine.connect() as connection:
        current = MigrationContext.configure(connection).get_current_revision()
    print(f"Current revision: {current or 'none'}")

    command.upgrade(config, "head")


if __name__ == "__main__":
    try:
        upgrade()
    except Exception as error:  # noqa: BLE001 - surface the reason and fail the deploy
        print(f"Migration failed: {error}", file=sys.stderr)
        raise SystemExit(1)
