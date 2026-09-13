from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, events, expenses, invites, members, settlement

app = FastAPI(title="Share & Settle API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
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
