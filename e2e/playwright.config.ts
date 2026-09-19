import { defineConfig, devices } from "@playwright/test";

/**
 * The suite drives the real stack from docker-compose.yml: FastAPI serving the
 * built SPA on APP_PORT (8001 by default), backed by PostgreSQL.
 *
 * Set BASE_URL to point at a stack running somewhere else. Set
 * E2E_NO_WEBSERVER=1 to stop Playwright managing Compose at all.
 */
const baseURL = process.env.BASE_URL ?? "http://localhost:8001";
const manageCompose = process.env.E2E_NO_WEBSERVER !== "1";

export default defineConfig({
  testDir: "./tests",
  // The stack has one shared database, so the specs share state. Run them serially.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: manageCompose
    ? {
        // Run from the repository root so docker-compose.yml and its build
        // context resolve, whatever directory the tests were started from.
        command: "docker compose up -d --build",
        cwd: "..",
        url: baseURL,
        // Cold runs build the Node frontend and the Python image.
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe",
        stderr: "pipe",
      }
    : undefined,
});
