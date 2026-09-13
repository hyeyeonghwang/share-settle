from fastapi import APIRouter, Depends

from ..auth import require_user
from ..models import EventRecord, InvitePreview, User
from ..store import now, store

router = APIRouter(prefix="/invites", tags=["Invitations"])


def find(code: str) -> EventRecord:
    for event in store.events.values():
        if event.inviteCode == code.strip().upper():
            return event
    from fastapi import HTTPException
    raise HTTPException(404, "That invite code doesn't match any event.")


@router.get("/{code}", response_model=InvitePreview)
def preview(code: str, user: User = Depends(require_user)) -> InvitePreview:
    event = find(code)
    return InvitePreview(event=event, memberCount=sum(m.eventId == event.id for m in store.members.values()), alreadyMember=any(m.eventId == event.id and m.userId == user.id for m in store.members.values()))


@router.post("/{code}", response_model=EventRecord)
def join(code: str, user: User = Depends(require_user)) -> EventRecord:
    event = find(code)
    existing = next((m for m in store.members.values() if m.eventId == event.id and m.userId == user.id), None)
    if existing:
        existing.status = "ACTIVE"
        existing.deactivatedAt = None
    else:
        member = __import__("backend.models", fromlist=["EventMember"]).EventMember(id=store.key("m"), eventId=event.id, userId=user.id, status="ACTIVE", joinedAt=now())
        store.members[member.id] = member
    return event
