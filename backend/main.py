import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from .routers import auth, events, expenses, invites, members, settlement

app = FastAPI(title="Share & Settle API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$",
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
