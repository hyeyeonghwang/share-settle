# End-to-end tests

Playwright tests that drive the real stack from the repository's
`docker-compose.yml`: FastAPI serving the built SPA, backed by PostgreSQL.

## Run them

```bash
cd e2e
npm install
npx playwright install chromium
npm test
```

`npm test` starts the stack itself (`docker compose up -d --build` from the
repository root) and waits for <http://localhost:8001> before the first test.
A stack that is already running is reused, so the usual loop is fast; the first
run has to build the frontend and the Python image, which can take a few
minutes.

The stack is left running afterwards. Stop it with `docker compose down` from
the repository root, or `docker compose down -v` to also delete the database
volume.

Useful variations:

```bash
npm run test:headed          # watch it in a browser
npm test -- --debug          # step through with the inspector
npm run report               # open the HTML report of the last run
```

## Configuration

| Variable | Default | Effect |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:8001` | Where the application is served. Match `APP_PORT` if you changed it. |
| `E2E_NO_WEBSERVER` | unset | Set to `1` to stop Playwright managing Compose and point the tests at a stack you started yourself. |
| `CI` | unset | Enables one retry, the GitHub reporter, and disables reusing an existing server. |

## What `share-event.spec.ts` covers

One test walks the sharing loop across two browser contexts, which is what
keeps the two signed-in users apart — the auth token lives in `localStorage`.

1. An organiser registers and creates an event.
2. The event page's invitation link is read and checked to be usable elsewhere.
3. A second user registers in its own context and joins through that link.
4. The second user records an expense on the shared event.
5. The organiser reloads and sees the expense, its payer, its amount, and the
   participant count of two.

## Notes for adding tests

- Tests run serially (`workers: 1`). The stack has one shared database, so
  parallel tests would contend over it.
- The database volume survives `docker compose down`, so accounts must be
  unique per run. Build them with `runId()` and `makeUser()` from
  `tests/support.ts` rather than hard-coding an email.
- Locators use the `aria-label`s and button text the application already has.
  Prefer extending those over adding `data-testid` attributes to the app.
