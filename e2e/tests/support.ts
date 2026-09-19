import { expect, type Browser, type Page } from "@playwright/test";

/**
 * The compose stack keeps its PostgreSQL volume between runs, so every account
 * an e2e run creates has to be new. One id per run, reused across its users.
 */
export function runId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export interface TestUser {
  displayName: string;
  email: string;
  password: string;
}

export function makeUser(role: string, run: string): TestUser {
  return {
    displayName: `${role} ${run}`,
    email: `${role}-${run}@example.test`,
    password: "settle-me-please",
  };
}

/**
 * A browser context of its own per user: the auth token lives in localStorage,
 * so this is what keeps two signed-in users apart inside one test.
 */
export async function newUserPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

/** Register through the sign-in screen and wait for the events page. */
export async function register(page: Page, user: TestUser): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a new account" }).click();

  await page.getByLabel("Display name").fill(user.displayName);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL("**/events");
  await expect(page.getByText(`Signed in as ${user.displayName}`)).toBeVisible();
}

/** Create an event from the events page and return the id it navigates to. */
export async function createEvent(page: Page, name: string, currency = "KRW"): Promise<string> {
  await page.getByLabel("Event name").fill(name);
  await page.getByLabel("Currency").selectOption(currency);
  await page.getByRole("button", { name: "Create event" }).click();

  await page.waitForURL(/\/events\/[^/]+$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();

  const eventId = new URL(page.url()).pathname.split("/").pop();
  expect(eventId, "event id in the URL").toBeTruthy();
  return eventId as string;
}

/**
 * Read the invitation link the event page offers for sharing. Reading the
 * rendered link rather than clicking "Copy invitation link" keeps the test off
 * headless clipboard permissions, which are a common source of flake.
 */
export async function readInviteLink(page: Page): Promise<string> {
  const link = page.locator("p", { hasText: /\/join\// }).first();
  await expect(link).toBeVisible();
  const text = (await link.innerText()).trim();
  expect(text, "invitation link").toMatch(/^https?:\/\/.+\/join\/.+$/);
  return text;
}

/** Add an expense to the event that `page` is currently showing. */
export async function addExpense(
  page: Page,
  eventId: string,
  expense: { title: string; amount: string },
): Promise<void> {
  await page.getByRole("link", { name: "+ Add expense" }).click();
  await page.waitForURL(`**/events/${eventId}/expenses/new`);

  await page.getByLabel("Expense title").fill(expense.title);
  await page.getByLabel("Total amount").fill(expense.amount);

  const save = page.getByRole("button", { name: "Save expense" });
  await expect(save).toBeEnabled();
  await save.click();

  await page.waitForURL(`**/events/${eventId}`);
}
