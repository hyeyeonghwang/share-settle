from fastapi import APIRouter, Depends
from ..auth import require_user
from ..models import Balance, Settlement, Transfer, User
from ..store import store

router = APIRouter(prefix="/events", tags=["Settlement"])


@router.get("/{event_id}/settlement", response_model=Settlement)
def settlement(event_id: str, user: User = Depends(require_user)) -> Settlement:
    store.event(event_id)
    store.membership(event_id, user.id)
    order = store.member_order(event_id)
    paid = {uid: 0 for uid in order}
    owed = {uid: 0 for uid in order}
    for expense in store.expenses_for_event(event_id):
        paid[expense.payerId] += expense.totalAmount
        for uid, amount in store.shares(expense).items(): owed[uid] += amount
    balances = [Balance(user=store.users[uid], paid=paid[uid], owed=owed[uid], balance=paid[uid] - owed[uid]) for uid in order]
    creditors = [[b.user, b.balance] for b in balances if b.balance > 0]
    debtors = [[b.user, -b.balance] for b in balances if b.balance < 0]
    creditors.sort(key=lambda x: (-x[1], x[0].id)); debtors.sort(key=lambda x: (-x[1], x[0].id))
    transfers = []
    ci = di = 0
    while ci < len(creditors) and di < len(debtors):
        amount = min(creditors[ci][1], debtors[di][1])
        transfers.append(Transfer(**{"from": debtors[di][0], "to": creditors[ci][0], "amount": amount}))
        creditors[ci][1] -= amount; debtors[di][1] -= amount
        if creditors[ci][1] == 0: ci += 1
        if debtors[di][1] == 0: di += 1
    return Settlement(balances=balances, transfers=transfers)
