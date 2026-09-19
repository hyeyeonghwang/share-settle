"""Test wiring.

The suite calls ``store.reset()``, which drops every table. Pin the tests to a
throwaway SQLite file *before* importing the store so a DATABASE_URL pointing at
a real Postgres can never be wiped by running pytest.
"""

import atexit
import os
import tempfile

_tmp_db = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_tmp_db.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db.name}"
atexit.register(lambda: os.path.exists(_tmp_db.name) and os.unlink(_tmp_db.name))

import pytest  # noqa: E402

from backend.store import store  # noqa: E402


@pytest.fixture(autouse=True)
def reset_store():
    store.reset()
    yield
    store.reset()
