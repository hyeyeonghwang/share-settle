# Share & Settle

Share & Settle is a shared-expense application for trips, events, and other
groups. Users can create an event, invite members, record expenses, split costs
equally or with fixed amounts, and receive a concise settlement plan showing who
owes whom.

The application has a React/TanStack frontend and a FastAPI backend backed by
SQLAlchemy. The backend provides authentication, event, member, expense, invite,
and settlement APIs. The Dockerfile builds the frontend with Node, copies the
generated static files into a Python image, and serves both the web application
and API from port `8000`.

## Build the Docker image

From the repository root, run:

```bash
docker build -t share-settle:latest .
```

The build requires Docker and internet access to download the Node and Python
dependencies.

## Run the container

For a quick local run using the container filesystem for SQLite data:

```bash
docker run --rm \
  --name share-settle \
  -p 8000:8000 \
  share-settle:latest
```

Open <http://localhost:8000> in a browser. The API is available under
`http://localhost:8000/api`.

## Run with persistent SQLite data

Use a named Docker volume so database data survives container recreation:

```bash
docker volume create share-settle-data

docker run -d \
  --name share-settle \
  -p 8000:8000 \
  -e DATABASE_URL=sqlite:////data/share_settle.db \
  -v share-settle-data:/data \
  share-settle:latest
```

Check the container logs or stop it with:

```bash
docker logs -f share-settle
docker stop share-settle
```

The backend defaults to `sqlite:///./share_settle.db` when `DATABASE_URL` is
not provided. A different SQLAlchemy database URL can be supplied with
`-e DATABASE_URL=...`; the corresponding database driver must be included in
the Python dependencies.

## Local development without Docker

Backend dependencies are managed with `uv`:

```bash
uv sync
uv run uvicorn backend.main:app --reload
```

To build the frontend locally:

```bash
cd frontend
npm ci
npm run build
```
