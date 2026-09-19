"""Environment-driven settings.

APP_ENV decides whether the deployment is a throwaway development instance or a
real one. Development keeps the demo conveniences (seed data, credential-free
sign-in) that make local work and the e2e suite pleasant; production removes
them, because on a public URL they are unauthenticated access to other people's
accounts.
"""

import os

PRODUCTION = "production"

# Allows localhost/127.0.0.1/::1 on any port, over http or https.
LOCALHOST_ORIGIN_REGEX = r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$"


def app_env() -> str:
    return os.getenv("APP_ENV", "development").strip().lower()


def is_production() -> bool:
    return app_env() == PRODUCTION


def demo_auth_enabled() -> bool:
    """Whether the credential-free demo sign-in routes are mounted.

    Defaults off in production. DEMO_AUTH overrides either way, so a staging
    instance can opt back in deliberately.
    """
    override = os.getenv("DEMO_AUTH")
    if override is not None:
        return override.strip().lower() in {"1", "true", "yes", "on"}
    return not is_production()


def seed_demo_data() -> bool:
    """Whether an empty database is populated with the demo event and users.

    The seeded accounts share a well-known password, so production starts empty.
    """
    override = os.getenv("SEED_DEMO_DATA")
    if override is not None:
        return override.strip().lower() in {"1", "true", "yes", "on"}
    return not is_production()


def cors_allow_origins() -> list[str]:
    """Explicit origin allowlist from CORS_ALLOW_ORIGINS (comma separated)."""
    raw = os.getenv("CORS_ALLOW_ORIGINS", "")
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


def cors_allow_origin_regex() -> str | None:
    """Regex fallback for origins.

    Development trusts localhost so `npm run dev` on any port reaches the API.
    Production trusts nothing implicitly: the SPA is served from the same origin
    as the API, so cross-origin access is opt-in via CORS_ALLOW_ORIGINS.
    """
    explicit = os.getenv("CORS_ALLOW_ORIGIN_REGEX")
    if explicit is not None:
        return explicit or None
    return None if is_production() else LOCALHOST_ORIGIN_REGEX


def auto_create_tables() -> bool:
    """Whether startup creates missing tables with SQLAlchemy's create_all.

    Convenient for SQLite and tests, but it only ever adds tables: it cannot
    alter an existing one. Production uses Alembic instead so schema changes
    are versioned and reviewable.
    """
    override = os.getenv("AUTO_CREATE_TABLES")
    if override is not None:
        return override.strip().lower() in {"1", "true", "yes", "on"}
    return not is_production()
