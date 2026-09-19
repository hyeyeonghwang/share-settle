import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import text

from .config import cors_allow_origin_regex, cors_allow_origins
from .database import get_engine
from .routers import auth, events, expenses, invites, members, settlement

app = FastAPI(title="Share & Settle API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins(),
    allow_origin_regex=cors_allow_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Auth-Token"],
)
app.include_router(auth.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(invites.router, prefix="/api")
app.include_router(members.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(settlement.router, prefix="/api")


@app.get("/api/health", include_in_schema=False)
def health() -> dict[str, str]:
    """Readiness probe for the load balancer.

    Touches the database, because an instance that cannot reach Postgres cannot
    serve a single request and should not be sent traffic.
    """
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 - any failure to reach the database is unhealthy
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok"}


frontend_dir = Path(os.getenv("FRONTEND_DIR", "/app/frontend")).resolve()
frontend_index = frontend_dir / "index.html"


if frontend_index.is_file():

    @app.get("/{path:path}", include_in_schema=False)
    def serve_frontend(path: str) -> FileResponse:
        """Serve built assets and fall back to the SPA entrypoint for deep links."""
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        requested = (frontend_dir / path).resolve()
        if requested != frontend_dir and frontend_dir not in requested.parents:
            raise HTTPException(status_code=404, detail="Not found")
        if requested.is_file():
            return FileResponse(requested)
        if path == "assets" or path.startswith("assets/") or requested.suffix:
            raise HTTPException(status_code=404, detail="Not found")
        return FileResponse(frontend_index, headers={"Cache-Control": "no-cache"})
