import { expect, test } from "@playwright/test";
import {
  addExpense,
  createEvent,
  makeUser,
  newUserPage,
  readInviteLink,
  register,
  runId,
} from "./support";

/**
 * The whole sharing loop across two real browser sessions against the
 * docker-compose stack: one user opens an event, shares its invitation link,
 * a second user joins through that link and records an expense, and the first
 * user sees it.
 */
test("an invited user's expense shows up for the event's creator", async ({ browser }) => {
  const run = runId();
  const organiser = makeUser("organiser", run);
  const participant = makeUser("participant", run);
  const eventName = `Jeju Trip ${run}`;
  const expense = { title: `Sunset Dinner ${run}`, amount: "90000" };

  const organiserPage = await newUserPage(browser);
  const participantPage = await newUserPage(browser);

  await test.step("the organiser signs in", async () => {
    await register(organiserPage, organiser);
  });

  const eventId = await test.step("and creates an event", async () => {
    return createEvent(organiserPage, eventName);
  });

  const inviteLink = await test.step("and shares its invitation link", async () => {
    const link = await readInviteLink(organiserPage);
    // The link has to be usable as-is by someone else, not just inside this tab.
    expect(new URL(link).origin).toBe(new URL(organiserPage.url()).origin);
    return link;
  });

  await test.step("a second user joins through that link", async () => {
    await register(participantPage, participant);
    await participantPage.goto(inviteLink);

    await expect(participantPage.getByRole("heading", { name: eventName })).toBeVisible();
    await participantPage.getByRole("button", { name: "Join event" }).click();

    await participantPage.waitForURL(`**/events/${eventId}`);
    await expect(participantPage.getByText("2 participants")).toBeVisible();
  });

  await test.step("and records an expense", async () => {
    await addExpense(participantPage, eventId, expense);
    await expect(participantPage.getByText(expense.title)).toBeVisible();
  });

  await test.step("which the organiser sees on the shared event", async () => {
    // The organiser's tab has been open since before the join, so this also
    // checks the change survived a round trip to the backend rather than
    // living in the other tab's cache.
    await organiserPage.reload();

    const row = organiserPage.getByRole("link", { name: new RegExp(expense.title) });
    await expect(row).toBeVisible();
    await expect(row).toContainText(`Paid by ${participant.displayName}`);
    await expect(row).toContainText("₩90,000");

    await expect(organiserPage.getByText("2 participants")).toBeVisible();
  });
});
