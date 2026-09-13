from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

CurrencyCode = Literal["KRW", "USD", "JPY", "EUR"]
EventStatus = Literal["ACTIVE", "COMPLETED"]
MemberStatus = Literal["ACTIVE", "INACTIVE"]
SplitType = Literal["EQUAL", "FIXED_PLUS_EQUAL"]
SplitMode = Literal["FIXED", "AUTO"]


class User(BaseModel):
    id: str
    displayName: str
    email: str
    authProvider: str
    createdAt: datetime


class EventRecord(BaseModel):
    id: str
    name: str
    createdBy: str
    currency: CurrencyCode
    status: EventStatus
    inviteCode: str
    createdAt: datetime
    completedAt: datetime | None = None


class EventMember(BaseModel):
    id: str
    eventId: str
    userId: str
    status: MemberStatus
    joinedAt: datetime
    deactivatedAt: datetime | None = None


class MemberView(EventMember):
    user: User
    isCreator: bool


class Expense(BaseModel):
    id: str
    eventId: str
    title: str
    totalAmount: int
    payerId: str
    createdBy: str
    splitType: SplitType
    createdAt: datetime
    updatedAt: datetime


class ExpenseItem(BaseModel):
    id: str
    expenseId: str
    name: str
    amount: int = Field(ge=0)
    sortOrder: int = Field(ge=0)


class ExpenseParticipant(BaseModel):
    id: str
    expenseId: str
    userId: str
    mode: SplitMode
    fixedAmount: int | None = Field(default=None, ge=0)


class ExpenseView(BaseModel):
    expense: Expense
    items: list[ExpenseItem]
    participants: list[ExpenseParticipant]
    payer: User
    creator: User
    shares: dict[str, int]
    canEdit: bool


class EventSummary(BaseModel):
    event: EventRecord
    memberCount: int
    expenseCount: int
    totalSpent: int
    isCreator: bool


class EventDetail(BaseModel):
    event: EventRecord
    members: list[MemberView]
    expenses: list[ExpenseView]
    totalSpent: int
    isCreator: bool
    currentUserId: str


class InvitePreview(BaseModel):
    event: EventRecord
    memberCount: int
    alreadyMember: bool


class CreateEventInput(BaseModel):
    name: str = Field(min_length=1)
    currency: CurrencyCode

    @field_validator("name")
    @classmethod
    def non_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Event name is required.")
        return value.strip()


class EventStatusInput(BaseModel):
    status: EventStatus


class MemberStatusInput(BaseModel):
    status: MemberStatus


class ExpenseItemInput(BaseModel):
    name: str
    amount: int = Field(ge=0)


class ExpenseParticipantInput(BaseModel):
    userId: str
    mode: SplitMode
    fixedAmount: int | None = Field(default=None, ge=0)


class ExpenseInput(BaseModel):
    title: str = Field(min_length=1)
    totalAmount: int = Field(ge=1)
    payerId: str
    splitType: SplitType
    items: list[ExpenseItemInput]
    participants: list[ExpenseParticipantInput] = Field(min_length=1)

    @field_validator("title")
    @classmethod
    def non_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Title is required.")
        return value.strip()


class Balance(BaseModel):
    user: User
    paid: int
    owed: int
    balance: int


class Transfer(BaseModel):
    from_: User = Field(alias="from")
    to: User
    amount: int = Field(ge=1)

    model_config = {"populate_by_name": True}


class Settlement(BaseModel):
    balances: list[Balance]
    transfers: list[Transfer]


class DemoSignIn(BaseModel):
    userId: str


class RegisterInput(BaseModel):
    displayName: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=8)

    @field_validator("displayName", "email")
    @classmethod
    def non_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required.")
        return value

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value: str) -> str:
        return value.lower()


class LoginInput(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value: str) -> str:
        return value.strip().lower()


class ErrorResponse(BaseModel):
    message: str
