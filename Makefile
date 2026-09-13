.PHONY: install dev run test check clean

install:
	uv sync

dev:
	uv run uvicorn backend.main:app --reload

run:
	uv run uvicorn backend.main:app

test:
	uv run pytest

check:
	uv run python -m compileall -q backend
	uv run pytest -q

clean:
	find backend -type d -name __pycache__ -prune -exec rm -rf {} +
