from datetime import datetime, timezone
import secrets
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import delete, func, select

from .auth import hash_password, verify_password
from .config import auto_create_tables, seed_demo_data
from .database import Base, EventRow, ExpenseRow, ItemRow, MemberRow, ParticipantRow, SessionLocal, TokenRow, UserRow, get_engine
from .models import *  # noqa: F403


def now() -> datetime:
    return datetime.now(timezone.utc)


class Store:
    """Database-backed repository. The API layer only deals in Pydantic models."""

    def __init__(self) -> None:
        if auto_create_tables():
            Base.metadata.create_all(get_engine())
        if not seed_demo_data():
            # The demo accounts share a published password; production starts empty.
            return
        with SessionLocal() as session:
            if session.scalar(select(func.count()).select_from(UserRow)) == 0:
                self._seed(session)

    def _seed(self, s) -> None:
        base = datetime(2026, 3, 1, 9, tzinfo=timezone.utc)
        names = [("u_younghee", "Younghee"), ("u_chulsoo", "Chulsoo"), ("u_jihoon", "Jihoon"), ("u_hana", "Hana")]
        for uid, name in names:
            s.add(UserRow(id=uid, display_name=name, email=f"{name.lower()}@example.com", auth_provider="google", password_hash=hash_password("password"), created_at=base))
        s.add(EventRow(id="e_jeju", name="Jeju Trip", created_by="u_younghee", currency="KRW", status="ACTIVE", invite_code="JEJU24", created_at=base))
        for mid, uid, status, deactivated in [("m1", "u_younghee", "ACTIVE", None), ("m2", "u_chulsoo", "ACTIVE", None), ("m3", "u_jihoon", "ACTIVE", None), ("m4", "u_hana", "INACTIVE", datetime(2026, 3, 5, 9, tzinfo=timezone.utc))]:
            s.add(MemberRow(id=mid, event_id="e_jeju", user_id=uid, status=status, joined_at=base, deactivated_at=deactivated))
        expenses = [("x_dinner", "Sunset Dinner", 90000, "u_younghee", "u_younghee", "EQUAL"), ("x_stay", "Sea View Stay", 300000, "u_chulsoo", "u_chulsoo", "EQUAL"), ("x_car", "Car Rental", 140000, "u_jihoon", "u_jihoon", "FIXED_PLUS_EQUAL")]
        for eid, title, amount, payer, creator, split in expenses:
            s.add(ExpenseRow(id=eid, event_id="e_jeju", title=title, total_amount=amount, payer_id=payer, created_by=creator, split_type=split, created_at=base, updated_at=base))
        s.add_all([ItemRow(id="i1", expense_id="x_dinner", name="Pork", amount=60000, sort_order=0), ItemRow(id="i2", expense_id="x_dinner", name="Alcohol", amount=20000, sort_order=1)])
        participants = [("p1", "x_dinner", "u_younghee", "AUTO", None), ("p2", "x_dinner", "u_chulsoo", "AUTO", None), ("p3", "x_dinner", "u_jihoon", "AUTO", None), ("p4", "x_stay", "u_younghee", "AUTO", None), ("p5", "x_stay", "u_chulsoo", "AUTO", None), ("p6", "x_stay", "u_jihoon", "AUTO", None), ("p7", "x_car", "u_younghee", "FIXED", 60000), ("p8", "x_car", "u_chulsoo", "AUTO", None), ("p9", "x_car", "u_jihoon", "AUTO", None)]
        s.add_all(ParticipantRow(id=i, expense_id=e, user_id=u, mode=m, fixed_amount=f) for i, e, u, m, f in participants)
        s.commit()

    def reset(self) -> None:
        Base.metadata.drop_all(get_engine())
        Base.metadata.create_all(get_engine())
        with SessionLocal() as s: self._seed(s)

    def key(self, prefix: str) -> str: return f"{prefix}_{uuid4().hex[:10]}"
    @staticmethod
    def _utc(value: datetime | None) -> datetime | None:
        return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value

    def _user(self, r) -> User: return User(id=r.id, displayName=r.display_name, email=r.email, authProvider=r.auth_provider, createdAt=self._utc(r.created_at))  # noqa: F405
    def _event(self, r) -> EventRecord: return EventRecord(id=r.id, name=r.name, createdBy=r.created_by, currency=r.currency, status=r.status, inviteCode=r.invite_code, createdAt=self._utc(r.created_at), completedAt=self._utc(r.completed_at))  # noqa: F405
    def _member(self, r) -> EventMember: return EventMember(id=r.id, eventId=r.event_id, userId=r.user_id, status=r.status, joinedAt=self._utc(r.joined_at), deactivatedAt=self._utc(r.deactivated_at))  # noqa: F405
    def _expense(self, r) -> Expense: return Expense(id=r.id, eventId=r.event_id, title=r.title, totalAmount=r.total_amount, payerId=r.payer_id, createdBy=r.created_by, splitType=r.split_type, createdAt=self._utc(r.created_at), updatedAt=self._utc(r.updated_at))  # noqa: F405

    @property
    def users(self) -> dict[str, User]:  # compatibility for callers/tests
        with SessionLocal() as s: return {r.id: self._user(r) for r in s.scalars(select(UserRow)).all()}
    def all_users(self) -> list[User]: return list(self.users.values())
    def user_for_token(self, token: str) -> User | None:
        with SessionLocal() as s:
            r = s.scalar(select(UserRow).join(TokenRow, UserRow.id == TokenRow.user_id).where(TokenRow.token == token))
            return self._user(r) if r else None
    def revoke_token(self, token: str) -> None:
        with SessionLocal() as s: s.execute(delete(TokenRow).where(TokenRow.token == token)); s.commit()
    def sign_in(self, user_id: str) -> tuple[User, str]:
        with SessionLocal() as s:
            r = s.get(UserRow, user_id)
            if not r: raise HTTPException(404, "Unknown account.")
            token = secrets.token_urlsafe(32); s.add(TokenRow(token=token, user_id=user_id)); s.commit(); return self._user(r), token

    def register(self, data: RegisterInput) -> tuple[User, str]:  # noqa: F405
        with SessionLocal() as s:
            if s.scalar(select(UserRow).where(UserRow.email == data.email)):
                raise HTTPException(409, "An account with this email already exists.")
            user = UserRow(id=self.key("u"), display_name=data.displayName, email=data.email, auth_provider="password", password_hash=hash_password(data.password), created_at=now())
            token = secrets.token_urlsafe(32)
            s.add_all([user, TokenRow(token=token, user_id=user.id)]); s.commit()
            return self._user(user), token

    def sign_in_with_password(self, data: LoginInput) -> tuple[User, str]:  # noqa: F405
        with SessionLocal() as s:
            user = s.scalar(select(UserRow).where(UserRow.email == data.email))
            if not user or not verify_password(data.password, user.password_hash):
                raise HTTPException(401, "Invalid email or password.")
            token = secrets.token_urlsafe(32); s.add(TokenRow(token=token, user_id=user.id)); s.commit()
            return self._user(user), token
    def event(self, event_id: str) -> EventRecord:
        with SessionLocal() as s: r = s.get(EventRow, event_id)
        if not r: raise HTTPException(404, "Event not found.")
        return self._event(r)
    def membership(self, event_id: str, user_id: str) -> EventMember:
        with SessionLocal() as s: r = s.scalar(select(MemberRow).where(MemberRow.event_id == event_id, MemberRow.user_id == user_id))
        if not r: raise HTTPException(403, "You are not a member of this event.")
        return self._member(r)
    def members_for_event(self, event_id: str) -> list[EventMember]:
        with SessionLocal() as s: rows = s.scalars(select(MemberRow).where(MemberRow.event_id == event_id).order_by(MemberRow.joined_at, MemberRow.id)).all()
        return [self._member(r) for r in rows]
    def member_order(self, event_id: str) -> list[str]: return [m.userId for m in self.members_for_event(event_id)]
    def ensure_creator(self, event: EventRecord, user: User) -> None:
        if event.createdBy != user.id: raise HTTPException(403, "Only the event creator can perform this operation.")
    def ensure_open(self, event: EventRecord) -> None:
        if event.status == "COMPLETED": raise HTTPException(403, "This event is completed and locked.")
    def validate_expense(self, event_id: str, data: ExpenseInput) -> None:  # noqa: F405
        order = self.member_order(event_id)
        if data.payerId not in order: raise HTTPException(422, "The payer must be a member of this event.")
        if any(p.userId not in order for p in data.participants): raise HTTPException(422, "Every responsible participant must be a member of this event.")
        if sum(i.amount for i in data.items) > data.totalAmount: raise HTTPException(422, "Detail items add up to more than the total amount.")
        fixed = [p.fixedAmount or 0 for p in data.participants if data.splitType == "FIXED_PLUS_EQUAL" and p.mode == "FIXED"]
        if sum(fixed) > data.totalAmount: raise HTTPException(422, "Fixed amounts add up to more than the total.")
        if data.splitType == "FIXED_PLUS_EQUAL" and len(fixed) == len(data.participants) and sum(fixed) != data.totalAmount: raise HTTPException(422, "Every participant has a fixed amount, so fixed amounts must equal the total.")
    def expense(self, event_id: str, expense_id: str) -> Expense:
        with SessionLocal() as s: r = s.scalar(select(ExpenseRow).where(ExpenseRow.id == expense_id, ExpenseRow.event_id == event_id))
        if not r: raise HTTPException(404, "Expense not found.")
        return self._expense(r)
    def expenses_for_event(self, event_id: str) -> list[Expense]:
        with SessionLocal() as s: rows = s.scalars(select(ExpenseRow).where(ExpenseRow.event_id == event_id).order_by(ExpenseRow.created_at.desc())).all()
        return [self._expense(r) for r in rows]
    def shares(self, expense: Expense) -> dict[str, int]:
        with SessionLocal() as s: rows = s.scalars(select(ParticipantRow).where(ParticipantRow.expense_id == expense.id)).all()
        order = self.member_order(expense.eventId); rows.sort(key=lambda p: order.index(p.user_id)); fixed = {p.user_id: p.fixed_amount for p in rows if expense.splitType == "FIXED_PLUS_EQUAL" and p.mode == "FIXED" and p.fixed_amount is not None}; auto = [p.user_id for p in rows if p.user_id not in fixed]; remaining = expense.totalAmount - sum(fixed.values()); base, rem = divmod(remaining, len(auto)) if auto else (0, 0); return fixed | {uid: base + (i < rem) for i, uid in enumerate(auto)}
    def expense_view(self, expense: Expense, viewer_id: str) -> ExpenseView:  # noqa: F405
        with SessionLocal() as s:
            items = s.scalars(select(ItemRow).where(ItemRow.expense_id == expense.id).order_by(ItemRow.sort_order)).all(); participants = s.scalars(select(ParticipantRow).where(ParticipantRow.expense_id == expense.id)).all(); payer = s.get(UserRow, expense.payerId); creator = s.get(UserRow, expense.createdBy)
        event = self.event(expense.eventId)
        return ExpenseView(expense=expense, items=[ExpenseItem(id=i.id, expenseId=i.expense_id, name=i.name, amount=i.amount, sortOrder=i.sort_order) for i in items], participants=[ExpenseParticipant(id=p.id, expenseId=p.expense_id, userId=p.user_id, mode=p.mode, fixedAmount=p.fixed_amount) for p in participants], payer=self._user(payer), creator=self._user(creator), shares=self.shares(expense), canEdit=event.status == "ACTIVE" and (expense.createdBy == viewer_id or event.createdBy == viewer_id))

    def save_expense(self, event_id: str, body: ExpenseInput, user: User, existing: Expense | None = None) -> ExpenseView:  # noqa: F405
        event = self.event(event_id); self.membership(event_id, user.id); self.ensure_open(event); self.validate_expense(event_id, body); timestamp = now()
        with SessionLocal() as s:
            if existing is None:
                existing = Expense(id=self.key("x"), eventId=event_id, title=body.title, totalAmount=body.totalAmount, payerId=body.payerId, createdBy=user.id, splitType=body.splitType, createdAt=timestamp, updatedAt=timestamp)
                s.add(ExpenseRow(id=existing.id, event_id=event_id, title=body.title, total_amount=body.totalAmount, payer_id=body.payerId, created_by=user.id, split_type=body.splitType, created_at=timestamp, updated_at=timestamp))
            else:
                if existing.createdBy != user.id and event.createdBy != user.id: raise HTTPException(403, "You can only edit expenses you added.")
                row = s.get(ExpenseRow, existing.id); row.title, row.total_amount, row.payer_id, row.split_type, row.updated_at = body.title, body.totalAmount, body.payerId, body.splitType, timestamp; existing = self._expense(row)
                s.execute(delete(ItemRow).where(ItemRow.expense_id == existing.id)); s.execute(delete(ParticipantRow).where(ParticipantRow.expense_id == existing.id))
            s.add_all(ItemRow(id=self.key("i"), expense_id=existing.id, name=i.name, amount=i.amount, sort_order=index) for index, i in enumerate(body.items))
            s.add_all(ParticipantRow(id=self.key("p"), expense_id=existing.id, user_id=p.userId, mode="AUTO" if body.splitType == "EQUAL" else p.mode, fixed_amount=None if body.splitType == "EQUAL" or p.mode != "FIXED" else p.fixedAmount) for p in body.participants)
            s.commit()
        return self.expense_view(existing, user.id)

    def delete_expense(self, expense: Expense) -> None:
        with SessionLocal() as s:
            s.execute(delete(ItemRow).where(ItemRow.expense_id == expense.id)); s.execute(delete(ParticipantRow).where(ParticipantRow.expense_id == expense.id)); s.execute(delete(ExpenseRow).where(ExpenseRow.id == expense.id)); s.commit()


store = Store()
