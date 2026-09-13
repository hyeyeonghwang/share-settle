from fastapi import APIRouter, Depends, Response, status
from ..auth import require_user
from ..models import Expense, ExpenseInput, ExpenseView, ExpenseItem, ExpenseParticipant, User
from ..store import now, store

router = APIRouter(prefix="/events", tags=["Expenses"])


def get_expense(event_id: str, expense_id: str) -> Expense:
    return store.expense(event_id, expense_id)


@router.get("/{event_id}/expenses/{expense_id}", response_model=ExpenseView)
def read(event_id: str, expense_id: str, user: User = Depends(require_user)) -> ExpenseView:
    store.membership(event_id, user.id)
    return store.expense_view(get_expense(event_id, expense_id), user.id)


def save(event_id: str, body: ExpenseInput, user: User, expense: Expense | None = None) -> ExpenseView:
    return store.save_expense(event_id, body, user, expense)


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
    store.delete_expense(expense)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
