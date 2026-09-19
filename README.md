# Share & Settle

Share & Settle is a shared-expense application for trips, events, and other
groups. Users can create an event, invite members, record expenses, split costs
equally or with fixed amounts, and receive a concise settlement plan showing who
owes whom.

The application has a React/TanStack frontend and a FastAPI backend backed by
SQLAlchemy. The backend provides authentication, event, member, expense, invite,
and settlement APIs. The Dockerfile builds the frontend with Node, copies the
generated static files into a Python image, and serves both the web application
and API from port `8080`.

## Build and run with Docker

From the repository root, run:

```bash
docker build -t share-settle:latest . && \
docker run --rm --name share-settle \
  -p 8001:8080 \
  -e DATABASE_URL=sqlite:////data/share_settle.db \
  -v share-settle-data:/data \
  share-settle:latest
```

The build requires Docker and internet access to download the Node and Python
dependencies.

Open <http://localhost:8001>. The host port is `8001`; the container listens on
`8080`. Browser API requests use `/api` on the same origin. No Node server runs
in the final image: FastAPI serves the Vite SPA and API together.

Docker creates `share-settle-data` automatically and reuses it on subsequent
runs, including with `--rm`. Do not delete the volume if you want to keep data.
Data from a previous container's unmounted database is not migrated automatically.

Before replacing an existing container, stop it with `docker stop share-settle`.
If it was created without `--rm`, remove the stopped container with
`docker rm share-settle` (after preserving any data not stored in the volume).
Then repeat the command above to build and run the new image. Add `-d` to
`docker run` for background execution.

Check the container logs or stop it with:

```bash
docker logs -f share-settle
docker stop share-settle
```

## Database

The backend talks to the database through SQLAlchemy and selects it with the
`DATABASE_URL` environment variable. SQLite and PostgreSQL drivers are both
installed.

| `DATABASE_URL` | Database |
| --- | --- |
| unset (default) | SQLite file at `./share_settle.db` |
| `sqlite:////data/share_settle.db` | SQLite file on a mounted volume |
| `postgresql+psycopg://sdip:sdip@localhost:5432/sdip` | PostgreSQL |

Use the `postgresql+psycopg://` scheme. Bare `postgresql://` makes SQLAlchemy
look for `psycopg2`, which is not installed.

The schema is created on startup with `create_all`, so a fresh, empty database
works without a migration step. There is no migration tooling yet: changing a
model does not alter an existing database's tables.

### Run PostgreSQL with Docker Compose

`docker-compose.yml` runs PostgreSQL and the application together. Copy
`.env.example` to `.env` to change credentials or ports, then:

```bash
docker compose up -d --build
```

The application is published on host port `8001` and PostgreSQL on `5432`;
`APP_PORT` and `POSTGRES_PORT` override them. The application reaches the
database over the Compose network at `db:5432`, so `DATABASE_URL` is set for it
automatically. Compose waits for the database's health check before starting the
application.

Data lives in the `share-settle-data` volume. `docker compose down` keeps it;
`docker compose down -v` deletes it permanently.

### Run PostgreSQL on its own

To run only the database and the application from your shell:

```bash
docker run -d --name share-settle-db \
  -e POSTGRES_USER=sdip \
  -e POSTGRES_PASSWORD=sdip \
  -e POSTGRES_DB=sdip \
  -p 5432:5432 \
  -v share-settle-data:/var/lib/postgresql/data \
  postgres:16-alpine

export DATABASE_URL=postgresql+psycopg://sdip:sdip@localhost:5432/sdip
uv run uvicorn backend.main:app --reload
```

Two details matter. PostgreSQL listens on `5432`, not `8080`, so the port
mapping must target `5432`. And `postgres:16-alpine` stores its data in
`/var/lib/postgresql/data`; a volume mounted anywhere else is ignored and the
data is lost when the container is removed.

Connect to the running database with:

```bash
docker exec -it share-settle-db psql -U sdip -d sdip
```

### Tests and the database

`pytest` pins itself to a temporary SQLite file regardless of `DATABASE_URL`.
The suite resets the store by dropping every table, so this keeps a PostgreSQL
database configured in your environment from being wiped by a test run.

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

Use `npm run dev` for the SPA development server; it proxies `/api` to the
backend on `127.0.0.1:8000`. `npm run preview` previews the static build;
for an integrated production check, use Docker.
