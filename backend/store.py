from collections.abc import Iterable
from datetime import datetime, timezone
import secrets
from uuid import uuid4

from fastapi import HTTPException

from .auth import hash_password
from .models import *  # noqa: F403


def now() -> datetime:
    return datetime.now(timezone.utc)


class Store:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        base = datetime(2026, 3, 1, 9, tzinfo=timezone.utc)
        self.users: dict[str, User] = {  # noqa: F405
            uid: User(id=uid, displayName=name, email=f"{name.lower()}@example.com", authProvider="google", createdAt=base)
            for uid, name in [("u_younghee", "Younghee"), ("u_chulsoo", "Chulsoo"), ("u_jihoon", "Jihoon"), ("u_hana", "Hana")]
        }
        self.passwords = {uid: hash_password("password") for uid in self.users}
        self.tokens: dict[str, str] = {}
        self.events = {"e_jeju": EventRecord(id="e_jeju", name="Jeju Trip", createdBy="u_younghee", currency="KRW", status="ACTIVE", inviteCode="JEJU24", createdAt=base)}
        self.members = {
            "m1": EventMember(id="m1", eventId="e_jeju", userId="u_younghee", status="ACTIVE", joinedAt=base),
            "m2": EventMember(id="m2", eventId="e_jeju", userId="u_chulsoo", status="ACTIVE", joinedAt=base),
            "m3": EventMember(id="m3", eventId="e_jeju", userId="u_jihoon", status="ACTIVE", joinedAt=base),
            "m4": EventMember(id="m4", eventId="e_jeju", userId="u_hana", status="INACTIVE", joinedAt=base, deactivatedAt=datetime(2026, 3, 5, 9, tzinfo=timezone.utc)),
        }
        self.expenses = {
            "x_dinner": Expense(id="x_dinner", eventId="e_jeju", title="Sunset Dinner", totalAmount=90000, payerId="u_younghee", createdBy="u_younghee", splitType="EQUAL", createdAt=base, updatedAt=base),
            "x_stay": Expense(id="x_stay", eventId="e_jeju", title="Sea View Stay", totalAmount=300000, payerId="u_chulsoo", createdBy="u_chulsoo", splitType="EQUAL", createdAt=base, updatedAt=base),
            "x_car": Expense(id="x_car", eventId="e_jeju", title="Car Rental", totalAmount=140000, payerId="u_jihoon", createdBy="u_jihoon", splitType="FIXED_PLUS_EQUAL", createdAt=base, updatedAt=base),
        }
        self.items = {"i1": ExpenseItem(id="i1", expenseId="x_dinner", name="Pork", amount=60000, sortOrder=0), "i2": ExpenseItem(id="i2", expenseId="x_dinner", name="Alcohol", amount=20000, sortOrder=1)}
        self.participants = {
            **{f"p{i}": ExpenseParticipant(id=f"p{i}", expenseId="x_dinner", userId=uid, mode="AUTO") for i, uid in enumerate(["u_younghee", "u_chulsoo", "u_jihoon"], 1)},
            **{f"p{i}": ExpenseParticipant(id=f"p{i}", expenseId="x_stay", userId=uid, mode="AUTO") for i, uid in enumerate(["u_younghee", "u_chulsoo", "u_jihoon"], 4)},
            "p7": ExpenseParticipant(id="p7", expenseId="x_car", userId="u_younghee", mode="FIXED", fixedAmount=60000),
            "p8": ExpenseParticipant(id="p8", expenseId="x_car", userId="u_chulsoo", mode="AUTO"),
            "p9": ExpenseParticipant(id="p9", expenseId="x_car", userId="u_jihoon", mode="AUTO"),
        }

    def key(self, prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:10]}"

    def user_for_token(self, token: str) -> User | None:
        uid = self.tokens.get(token)
        return self.users.get(uid) if uid else None

    def revoke_token(self, token: str) -> None:
        self.tokens.pop(token, None)

    def sign_in(self, user_id: str) -> tuple[User, str]:
        if user_id not in self.users:
            raise HTTPException(404, "Unknown account.")
        token = secrets.token_urlsafe(32)
        self.tokens[token] = user_id
        return self.users[user_id], token

    def event(self, event_id: str) -> EventRecord:
        event = self.events.get(event_id)
        if not event:
            raise HTTPException(404, "Event not found.")
        return event

    def membership(self, event_id: str, user_id: str) -> EventMember:
        for member in self.members.values():
            if member.eventId == event_id and member.userId == user_id:
                return member
        raise HTTPException(403, "You are not a member of this event.")

    def member_order(self, event_id: str) -> list[str]:
        return [m.userId for m in sorted(self.members.values(), key=lambda x: (x.joinedAt, x.id)) if m.eventId == event_id]

    def ensure_creator(self, event: EventRecord, user: User) -> None:
        if event.createdBy != user.id:
            raise HTTPException(403, "Only the event creator can perform this operation.")

    def ensure_open(self, event: EventRecord) -> None:
        if event.status == "COMPLETED":
            raise HTTPException(403, "This event is completed and locked.")

    def validate_expense(self, event_id: str, data: ExpenseInput) -> None:  # noqa: F405
        order = self.member_order(event_id)
        if data.payerId not in order:
            raise HTTPException(422, "The payer must be a member of this event.")
        if any(p.userId not in order for p in data.participants):
            raise HTTPException(422, "Every responsible participant must be a member of this event.")
        if sum(item.amount for item in data.items) > data.totalAmount:
            raise HTTPException(422, "Detail items add up to more than the total amount.")
        fixed = [p.fixedAmount or 0 for p in data.participants if data.splitType == "FIXED_PLUS_EQUAL" and p.mode == "FIXED"]
        if sum(fixed) > data.totalAmount:
            raise HTTPException(422, "Fixed amounts add up to more than the total amount.")
        if data.splitType == "FIXED_PLUS_EQUAL" and len(fixed) == len(data.participants) and sum(fixed) != data.totalAmount:
            raise HTTPException(422, "Every participant has a fixed amount, so the fixed amounts must equal the total.")

    def shares(self, expense: Expense) -> dict[str, int]:
        ps = [p for p in self.participants.values() if p.expenseId == expense.id]
        order = [p.userId for p in sorted(ps, key=lambda p: self.member_order(expense.eventId).index(p.userId))]
        fixed = {p.userId: p.fixedAmount for p in ps if expense.splitType == "FIXED_PLUS_EQUAL" and p.mode == "FIXED" and p.fixedAmount is not None}
        auto = [uid for uid in order if uid not in fixed]
        remaining = expense.totalAmount - sum(fixed.values())
        result = dict(fixed)
        if auto:
            base, rem = divmod(remaining, len(auto))
            result.update({uid: base + (i < rem) for i, uid in enumerate(auto)})
        return result

    def expense_view(self, expense: Expense, viewer_id: str) -> ExpenseView:  # noqa: F405
        event = self.event(expense.eventId)
        return ExpenseView(expense=expense, items=sorted([i for i in self.items.values() if i.expenseId == expense.id], key=lambda x: x.sortOrder), participants=[p for p in self.participants.values() if p.expenseId == expense.id], payer=self.users[expense.payerId], creator=self.users[expense.createdBy], shares=self.shares(expense), canEdit=event.status == "ACTIVE" and (expense.createdBy == viewer_id or event.createdBy == viewer_id))


store = Store()
