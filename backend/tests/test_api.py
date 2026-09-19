import pytest
from fastapi import HTTPException

from backend.auth import hash_password, verify_password
from backend.main import app
from backend.models import CreateEventInput, EventStatusInput, ExpenseInput, LoginInput, MemberStatusInput, RegisterInput
from backend.routers.events import create_event, get_event, list_events, set_status
from backend.routers.expenses import create, delete, update
from backend.routers.invites import join, preview
from backend.routers.members import set_status as set_member_status
from backend.routers.settlement import settlement
from backend.store import store


def user(user_id="u_younghee"):
    return store.users[user_id]


def expense_body(title="Lunch"):
    return ExpenseInput(title=title, totalAmount=1000, payerId="u_younghee", splitType="EQUAL", items=[], participants=[{"userId": "u_younghee", "mode": "AUTO", "fixedAmount": None}])


def test_password_hashing_and_bearer_token_store():
    encoded = hash_password("secret")
    assert encoded != "secret"
    assert verify_password("secret", encoded)
    assert not verify_password("wrong", encoded)
    account, token = store.sign_in("u_younghee")
    assert store.user_for_token(token) == account


def test_register_and_password_login_use_database_user():
    account, token = store.register(RegisterInput(displayName="New User", email="new@example.com", password="a-secure-password"))
    assert account.displayName == "New User"
    assert store.user_for_token(token) == account
    logged_in, login_token = store.sign_in_with_password(LoginInput(email="NEW@example.com", password="a-secure-password"))
    assert logged_in.id == account.id
    assert store.user_for_token(login_token) == account
    assert account.id not in {member.userId for member in store.members_for_event("e_jeju")}


def test_seeded_event_and_settlement():
    assert list_events(user())[-1].event.id == "e_jeju"
    detail = get_event("e_jeju", user())
    assert detail.event.name == "Jeju Trip"
    result = settlement("e_jeju", user())
    assert len(result.balances) == 4
    assert sum(b.paid for b in result.balances) == 530000


def test_create_join_and_permissions():
    event = create_event(CreateEventInput(name="Lab Dinner", currency="KRW"), user("u_chulsoo"))
    assert preview(event.inviteCode.lower(), user("u_jihoon")).alreadyMember is False
    assert join(event.inviteCode, user("u_jihoon")).id == event.id
    with pytest.raises(HTTPException) as error:
        set_status(event.id, EventStatusInput(status="COMPLETED"), user("u_jihoon"))
    assert error.value.status_code == 403


def test_expense_crud_and_completed_lock():
    created = create("e_jeju", expense_body(), user())
    assert created.expense.title == "Lunch"
    updated = update("e_jeju", created.expense.id, expense_body("Edited"), user())
    assert updated.expense.title == "Edited"
    delete("e_jeju", created.expense.id, user())
    set_status("e_jeju", EventStatusInput(status="COMPLETED"), user())
    with pytest.raises(HTTPException) as error:
        create("e_jeju", expense_body(), user())
    assert error.value.status_code == 403


def test_permissions_and_member_status():
    created = create("e_jeju", expense_body(), user("u_chulsoo"))
    with pytest.raises(HTTPException) as error:
        update("e_jeju", created.expense.id, expense_body("Nope"), user("u_jihoon"))
    assert error.value.status_code == 403
    member = set_member_status("e_jeju", "u_hana", MemberStatusInput(status="ACTIVE"), user())
    assert member.status == "ACTIVE"


def test_expense_validation_and_openapi_routes():
    invalid = ExpenseInput(title="Bad", totalAmount=100, payerId="u_younghee", splitType="FIXED_PLUS_EQUAL", items=[{"name": "too much", "amount": 101}], participants=[{"userId": "u_younghee", "mode": "FIXED", "fixedAmount": 50}])
    with pytest.raises(HTTPException) as error:
        create("e_jeju", invalid, user())
    assert error.value.status_code == 422
    paths = app.openapi()["paths"]
    assert "/api/events/{event_id}/expenses" in paths
    assert "/api/events/{event_id}/settlement" in paths


def test_demo_routes_are_absent_in_production(monkeypatch):
    from fastapi.testclient import TestClient

    from backend.main import app

    monkeypatch.setenv("APP_ENV", "production")
    with TestClient(app) as client:
        assert client.post("/api/auth/google").status_code == 404
        assert client.post("/api/auth/demo", json={"userId": "u_younghee"}).status_code == 404
        assert client.get("/api/auth/demo/accounts").status_code == 404


def test_demo_routes_are_available_by_default():
    from fastapi.testclient import TestClient

    from backend.main import app

    with TestClient(app) as client:
        response = client.post("/api/auth/google")
        assert response.status_code == 200
        assert response.headers["X-Auth-Token"]


def test_demo_auth_override_re_enables_routes_in_production(monkeypatch):
    from fastapi.testclient import TestClient

    from backend.main import app

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DEMO_AUTH", "true")
    with TestClient(app) as client:
        assert client.post("/api/auth/google").status_code == 200


def test_production_seeding_and_cors_defaults(monkeypatch):
    from backend.config import cors_allow_origin_regex, cors_allow_origins, seed_demo_data

    monkeypatch.setenv("APP_ENV", "production")
    assert seed_demo_data() is False
    assert cors_allow_origin_regex() is None
    assert cors_allow_origins() == []

    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "https://app.example.com, https://www.example.com/")
    assert cors_allow_origins() == ["https://app.example.com", "https://www.example.com"]

    monkeypatch.delenv("APP_ENV")
    assert seed_demo_data() is True
    assert "localhost" in cors_allow_origin_regex()
