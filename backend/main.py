from fastapi import FastAPI
from .routers import auth, events, expenses, invites, members, settlement

app = FastAPI(title="Share & Settle API", version="1.0.0")
app.include_router(auth.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(invites.router, prefix="/api")
app.include_router(members.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(settlement.router, prefix="/api")
