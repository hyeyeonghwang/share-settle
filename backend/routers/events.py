from fastapi import APIRouter, Depends

from ..auth import require_user
from ..models import *  # noqa: F403
from ..store import now, store

router = APIRouter(prefix="/events", tags=["Events"])


@router.get("", response_model=list[EventSummary])
def list_events(user: User = Depends(require_user)) -> list[EventSummary]:  # noqa: F405
    events = []
    # A repository query keeps this route independent of the database implementation.
    from sqlalchemy import select
    from ..database import EventRow, MemberRow, ExpenseRow, SessionLocal
    with SessionLocal() as session:
        rows = session.scalars(select(EventRow).join(MemberRow, EventRow.id == MemberRow.event_id).where(MemberRow.user_id == user.id).order_by(EventRow.created_at.desc())).all()
        for row in rows:
            event = store._event(row)
            members = session.scalars(select(MemberRow).where(MemberRow.event_id == event.id)).all()
            expenses = session.scalars(select(ExpenseRow).where(ExpenseRow.event_id == event.id)).all()
            events.append(EventSummary(event=event, memberCount=len(members), expenseCount=len(expenses), totalSpent=sum(x.total_amount for x in expenses), isCreator=event.createdBy == user.id))
    return events


@router.post("", response_model=EventRecord, status_code=201)
def create_event(body: CreateEventInput, user: User = Depends(require_user)) -> EventRecord:  # noqa: F405
    event = EventRecord(id=store.key("e"), name=body.name, createdBy=user.id, currency=body.currency, status="ACTIVE", inviteCode=store.key("invite").upper()[-6:], createdAt=now())
    from ..database import EventRow, MemberRow, SessionLocal
    with SessionLocal() as session:
        session.add(EventRow(id=event.id, name=event.name, created_by=event.createdBy, currency=event.currency, status=event.status, invite_code=event.inviteCode, created_at=event.createdAt))
        session.add(MemberRow(id=store.key("m"), event_id=event.id, user_id=user.id, status="ACTIVE", joined_at=now()))
        session.commit()
    return event


@router.get("/{event_id}", response_model=EventDetail)
def get_event(event_id: str, user: User = Depends(require_user)) -> EventDetail:  # noqa: F405
    event = store.event(event_id)
    store.membership(event_id, user.id)
    members = [MemberView(**m.model_dump(), user=store.users[m.userId], isCreator=m.userId == event.createdBy) for m in store.members_for_event(event_id)]
    expenses = [store.expense_view(x, user.id) for x in store.expenses_for_event(event_id)]
    return EventDetail(event=event, members=members, expenses=expenses, totalSpent=sum(x.expense.totalAmount for x in expenses), isCreator=event.createdBy == user.id, currentUserId=user.id)


@router.patch("/{event_id}/status", response_model=EventRecord)
def set_status(event_id: str, body: EventStatusInput, user: User = Depends(require_user)) -> EventRecord:  # noqa: F405
    event = store.event(event_id)
    store.ensure_creator(event, user)
    from ..database import EventRow, SessionLocal
    with SessionLocal() as session:
        row = session.get(EventRow, event_id); row.status = body.status; row.completed_at = now() if body.status == "COMPLETED" else None; session.commit(); session.refresh(row)
        return store._event(row)
