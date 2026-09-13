import pytest
from backend.store import store


@pytest.fixture(autouse=True)
def reset_store():
    store.reset()
    yield
    store.reset()

