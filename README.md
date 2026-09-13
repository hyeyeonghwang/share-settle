# Share & Settle backend

The backend uses SQLAlchemy for persistence. Set `DATABASE_URL` to choose the database connection; it defaults to `sqlite:///./share_settle.db`.

Examples:

```bash
DATABASE_URL=sqlite:///./local.db uv run uvicorn backend.main:app
DATABASE_URL=postgresql+psycopg://user:password@localhost/share_settle uv run uvicorn backend.main:app
```

Install the SQLAlchemy dialect/driver required by the selected database separately (for example, `uv add psycopg[binary]` for Postgres).
