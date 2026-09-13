from fastapi import APIRouter, Depends

from ..auth import require_user
from ..models import *  # noqa: F403
from ..store import now, store

router = APIRouter(prefix="/events", tags=["Events"])


@router.get("", response_model=list[EventSummary])
def list_events(user: User = Depends(require_user)) -> list[EventSummary]:  # noqa: F405
    event_ids = {m.eventId for m in store.members.values() if m.userId == user.id}
    events = sorted((e for e in store.events.values() if e.id in event_ids), key=lambda e: e.createdAt, reverse=True)
    return [EventSummary(event=e, memberCount=sum(m.eventId == e.id for m in store.members.values()), expenseCount=sum(x.eventId == e.id for x in store.expenses.values()), totalSpent=sum(x.totalAmount for x in store.expenses.values() if x.eventId == e.id), isCreator=e.createdBy == user.id) for e in events]


@router.post("", response_model=EventRecord, status_code=201)
def create_event(body: CreateEventInput, user: User = Depends(require_user)) -> EventRecord:  # noqa: F405
    event = EventRecord(id=store.key("e"), name=body.name, createdBy=user.id, currency=body.currency, status="ACTIVE", inviteCode=store.key("invite").upper()[-6:], createdAt=now())
    store.events[event.id] = event
    member = EventMember(id=store.key("m"), eventId=event.id, userId=user.id, status="ACTIVE", joinedAt=now())
    store.members[member.id] = member
    return event


@router.get("/{event_id}", response_model=EventDetail)
def get_event(event_id: str, user: User = Depends(require_user)) -> EventDetail:  # noqa: F405
    event = store.event(event_id)
    store.membership(event_id, user.id)
    members = [MemberView(**m.model_dump(), user=store.users[m.userId], isCreator=m.userId == event.createdBy) for m in sorted((m for m in store.members.values() if m.eventId == event_id), key=lambda m: (m.joinedAt, m.id))]
    expenses = [store.expense_view(x, user.id) for x in sorted((x for x in store.expenses.values() if x.eventId == event_id), key=lambda x: x.createdAt, reverse=True)]
    return EventDetail(event=event, members=members, expenses=expenses, totalSpent=sum(x.expense.totalAmount for x in expenses), isCreator=event.createdBy == user.id, currentUserId=user.id)


@router.patch("/{event_id}/status", response_model=EventRecord)
def set_status(event_id: str, body: EventStatusInput, user: User = Depends(require_user)) -> EventRecord:  # noqa: F405
    event = store.event(event_id)
    store.ensure_creator(event, user)
    event.status = body.status
    event.completedAt = now() if body.status == "COMPLETED" else None
    return event
