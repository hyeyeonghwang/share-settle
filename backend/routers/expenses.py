from fastapi import APIRouter, Depends, Response, status
from ..auth import require_user
from ..models import Expense, ExpenseInput, ExpenseView, ExpenseItem, ExpenseParticipant, User
from ..store import now, store

router = APIRouter(prefix="/events", tags=["Expenses"])


def get_expense(event_id: str, expense_id: str) -> Expense:
    expense = store.expenses.get(expense_id)
    if not expense or expense.eventId != event_id:
        from fastapi import HTTPException
        raise HTTPException(404, "Expense not found.")
    return expense


@router.get("/{event_id}/expenses/{expense_id}", response_model=ExpenseView)
def read(event_id: str, expense_id: str, user: User = Depends(require_user)) -> ExpenseView:
    store.membership(event_id, user.id)
    return store.expense_view(get_expense(event_id, expense_id), user.id)


def save(event_id: str, body: ExpenseInput, user: User, expense: Expense | None = None) -> ExpenseView:
    event = store.event(event_id)
    store.membership(event_id, user.id)
    store.ensure_open(event)
    store.validate_expense(event_id, body)
    if expense is None:
        expense = Expense(id=store.key("x"), eventId=event_id, title=body.title, totalAmount=body.totalAmount, payerId=body.payerId, createdBy=user.id, splitType=body.splitType, createdAt=now(), updatedAt=now())
        store.expenses[expense.id] = expense
    else:
        if expense.createdBy != user.id and event.createdBy != user.id:
            from fastapi import HTTPException
            raise HTTPException(403, "You can only edit expenses you added.")
        expense.title, expense.totalAmount, expense.payerId, expense.splitType, expense.updatedAt = body.title, body.totalAmount, body.payerId, body.splitType, now()
        for key in [k for k, x in store.items.items() if x.expenseId == expense.id]: del store.items[key]
        for key in [k for k, x in store.participants.items() if x.expenseId == expense.id]: del store.participants[key]
    for index, item in enumerate(body.items):
        obj = ExpenseItem(id=store.key("i"), expenseId=expense.id, name=item.name, amount=item.amount, sortOrder=index)
        store.items[obj.id] = obj
    for participant in body.participants:
        obj = ExpenseParticipant(id=store.key("p"), expenseId=expense.id, userId=participant.userId, mode="AUTO" if body.splitType == "EQUAL" else participant.mode, fixedAmount=None if body.splitType == "EQUAL" or participant.mode != "FIXED" else participant.fixedAmount)
        store.participants[obj.id] = obj
    return store.expense_view(expense, user.id)


@router.post("/{event_id}/expenses", response_model=ExpenseView, status_code=201)
def create(event_id: str, body: ExpenseInput, user: User = Depends(require_user)) -> ExpenseView:
    return save(event_id, body, user)


@router.put("/{event_id}/expenses/{expense_id}", response_model=ExpenseView)
def update(event_id: str, expense_id: str, body: ExpenseInput, user: User = Depends(require_user)) -> ExpenseView:
    return save(event_id, body, user, get_expense(event_id, expense_id))


@router.delete("/{event_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(event_id: str, expense_id: str, user: User = Depends(require_user)) -> Response:
    event = store.event(event_id)
    store.membership(event_id, user.id)
    store.ensure_open(event)
    expense = get_expense(event_id, expense_id)
    if expense.createdBy != user.id and event.createdBy != user.id:
        from fastapi import HTTPException
        raise HTTPException(403, "You can only delete expenses you added.")
    del store.expenses[expense.id]
    for key in [k for k, x in store.items.items() if x.expenseId == expense.id]: del store.items[key]
    for key in [k for k, x in store.participants.items() if x.expenseId == expense.id]: del store.participants[key]
    return Response(status_code=status.HTTP_204_NO_CONTENT)
