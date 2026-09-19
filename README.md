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

Use `npm run dev` for the SPA development server; it proxies `/api` to the
backend on `127.0.0.1:8000`. `npm run preview` previews the static build;
for an integrated production check, use Docker.
