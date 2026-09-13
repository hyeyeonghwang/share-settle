from fastapi import APIRouter, Depends

from ..auth import require_user
from ..models import EventRecord, InvitePreview, User
from ..store import now, store

router = APIRouter(prefix="/invites", tags=["Invitations"])


def find(code: str) -> EventRecord:
    from sqlalchemy import select
    from ..database import EventRow, SessionLocal
    with SessionLocal() as session:
        row = session.scalar(select(EventRow).where(EventRow.invite_code == code.strip().upper()))
    if row:
        return store._event(row)
    from fastapi import HTTPException
    raise HTTPException(404, "That invite code doesn't match any event.")


@router.get("/{code}", response_model=InvitePreview)
def preview(code: str, user: User = Depends(require_user)) -> InvitePreview:
    event = find(code)
    members = store.members_for_event(event.id)
    return InvitePreview(event=event, memberCount=len(members), alreadyMember=any(m.userId == user.id for m in members))


@router.post("/{code}", response_model=EventRecord)
def join(code: str, user: User = Depends(require_user)) -> EventRecord:
    event = find(code)
    existing = next((m for m in store.members_for_event(event.id) if m.userId == user.id), None)
    from ..database import MemberRow, SessionLocal
    if existing:
        with SessionLocal() as session:
            row = session.get(MemberRow, existing.id); row.status = "ACTIVE"; row.deactivated_at = None; session.commit()
    else:
        with SessionLocal() as session:
            session.add(MemberRow(id=store.key("m"), event_id=event.id, user_id=user.id, status="ACTIVE", joined_at=now())); session.commit()
    return event
