import os
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    display_name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, unique=True)
    auth_provider: Mapped[str] = mapped_column(String)
    password_hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TokenRow(Base):
    __tablename__ = "auth_tokens"
    token: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String)


class EventRow(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    created_by: Mapped[str] = mapped_column(String)
    currency: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    invite_code: Mapped[str] = mapped_column(String, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MemberRow(Base):
    __tablename__ = "event_members"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    event_id: Mapped[str] = mapped_column(String)
    user_id: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ExpenseRow(Base):
    __tablename__ = "expenses"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    event_id: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    total_amount: Mapped[int] = mapped_column(Integer)
    payer_id: Mapped[str] = mapped_column(String)
    created_by: Mapped[str] = mapped_column(String)
    split_type: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ItemRow(Base):
    __tablename__ = "expense_items"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    expense_id: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    amount: Mapped[int] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer)


class ParticipantRow(Base):
    __tablename__ = "expense_participants"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    expense_id: Mapped[str] = mapped_column(String)
    user_id: Mapped[str] = mapped_column(String)
    mode: Mapped[str] = mapped_column(String)
    fixed_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)


DEFAULT_DATABASE_URL = "sqlite:///./share_settle.db"


def database_url() -> str:
    """Connection string for the app database.

    Defaults to a local SQLite file. Point DATABASE_URL at Postgres to use it, e.g.
    postgresql+psycopg://sdip:sdip@localhost:8001/sdip
    """
    return os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)


def make_engine(url: str | None = None):
    url = url or database_url()
    if url.startswith("sqlite"):
        kwargs = {"connect_args": {"check_same_thread": False}}
    else:
        # Server-side databases drop idle connections; pre-ping so a stale pooled
        # connection is recycled instead of surfacing as a request failure.
        kwargs = {"pool_pre_ping": True}
    return create_engine(url, **kwargs)


_engine = make_engine()
SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)


def get_engine():
    """The engine currently bound to SessionLocal."""
    return _engine


def configure_engine(url: str | None = None):
    """Rebind the app to a different database. Used by tests and startup wiring.

    SessionLocal is reconfigured in place so modules that imported it by name
    keep pointing at the live engine.
    """
    global _engine
    _engine.dispose()
    _engine = make_engine(url)
    SessionLocal.configure(bind=_engine)
    return _engine
