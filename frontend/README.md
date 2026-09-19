# Share & Settle

Create a system design expense splitter application.

The product specification is maintained in [`docs/spec.md`](../docs/spec.md).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/72fff616-b436-466f-a58e-2ec6f961031f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
cd frontend
npm i
npm run dev
```

Run the backend in another terminal from the repository root:

```sh
uv sync
uv run uvicorn backend.main:app --reload
```

Open the URL printed by `npm run dev`. The SPA server uses
`vite.spa.config.ts` and proxies `/api` to `http://127.0.0.1:8000`.
Restart an existing dev server after changing npm scripts; a running process
keeps the command it originally started with.

### Repeated page reloads

The Lovable/TanStack Start config (`vite.config.ts`, used by bare `vite dev`)
generates `src/routeTree.gen.ts` with extra Start type declarations. The SPA
config generates `src/routeTree.spa.gen.ts` and aliases the router's route-tree
import to that file. Keep these outputs separate: if both generators write
the same file, they repeatedly overwrite each other's output and Vite sends
full-page reloads even when no source code is edited.

If you see repeated `page reload src/routeTree.gen.ts` messages, stop outdated
dev servers with Ctrl+C and restart using `npm run dev`. Use the printed URL
to avoid opening a different dev server that is still running on another port.
