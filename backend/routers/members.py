from fastapi import APIRouter, Depends
from ..auth import require_user
from ..models import EventMember, MemberStatusInput, MemberView, User
from ..store import now, store

router = APIRouter(prefix="/events", tags=["Members"])


@router.patch("/{event_id}/members/{user_id}/status", response_model=MemberView)
def set_status(event_id: str, user_id: str, body: MemberStatusInput, user: User = Depends(require_user)) -> MemberView:
    event = store.event(event_id)
    store.ensure_creator(event, user)
    store.ensure_open(event)
    member = store.membership(event_id, user_id)
    member.status = body.status
    member.deactivatedAt = now() if body.status == "INACTIVE" else None
    return MemberView(**member.model_dump(), user=store.users[user_id], isCreator=user_id == event.createdBy)
