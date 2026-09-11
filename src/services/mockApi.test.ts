import { beforeEach, describe, expect, it } from "vitest";
import { MockExpenseSplitterApi } from "./mockApi";

describe("MockExpenseSplitterApi flows", () => {
  let api: MockExpenseSplitterApi;

  beforeEach(() => {
    api = new MockExpenseSplitterApi({ persist: false });
  });

  it("supports sign in, event creation, and idempotent joining", async () => {
    await api.signInAs("u_chulsoo");
    const created = await api.createEvent({ name: "Lab Dinner", currency: "KRW" });
    expect((await api.getEvent(created.id)).members).toHaveLength(1);

    await api.signOut();
    await api.signInAs("u_jihoon");
    expect((await api.previewInvite(created.inviteCode)).alreadyMember).toBe(false);
    await api.joinEvent(created.inviteCode);
    await api.joinEvent(created.inviteCode);
    expect((await api.getEvent(created.id)).members).toHaveLength(2);
  });

  it("allows an expense creator and event creator to edit, but not another member", async () => {
    await api.signInAs("u_chulsoo");
    const input = {
      title: "Lunch",
      totalAmount: 90_000,
      payerId: "u_younghee",
      splitType: "EQUAL" as const,
      items: [],
      participants: ["u_younghee", "u_chulsoo", "u_jihoon"].map((userId) => ({
        userId,
        mode: "AUTO" as const,
        fixedAmount: null,
      })),
    };
    const expense = await api.createExpense("e_jeju", input);
    await expect(api.updateExpense("e_jeju", expense.expense.id, { ...input, title: "Lunch edited" })).resolves.toMatchObject({ expense: { title: "Lunch edited" } });

    await api.signOut();
    await api.signInAs("u_jihoon");
    await expect(api.updateExpense("e_jeju", expense.expense.id, input)).rejects.toThrow("You can only edit expenses you added.");

    await api.signOut();
    await api.signInAs("u_younghee");
    await expect(api.updateExpense("e_jeju", expense.expense.id, { ...input, title: "Creator edit" })).resolves.toMatchObject({ expense: { title: "Creator edit" } });
  });

  it("locks completed events and lets only the creator reopen them", async () => {
    await api.signInAs("u_younghee");
    await api.setEventStatus("e_jeju", "COMPLETED");
    await expect(
      api.createExpense("e_jeju", {
        title: "Locked",
        totalAmount: 100,
        payerId: "u_younghee",
        splitType: "EQUAL",
        items: [],
        participants: [{ userId: "u_younghee", mode: "AUTO", fixedAmount: null }],
      }),
    ).rejects.toThrow("completed and locked");

    await api.signOut();
    await api.signInAs("u_chulsoo");
    await expect(api.setEventStatus("e_jeju", "ACTIVE")).rejects.toThrow("Only the event creator");

    await api.signOut();
    await api.signInAs("u_younghee");
    await expect(api.setEventStatus("e_jeju", "ACTIVE")).resolves.toMatchObject({ status: "ACTIVE" });
  });

  it("preserves historical settlement when a participant is deactivated", async () => {
    await api.signInAs("u_younghee");
    const before = await api.getSettlement("e_jeju");
    await api.setMemberStatus("e_jeju", "u_chulsoo", "INACTIVE");
    const after = await api.getSettlement("e_jeju");

    expect(after).toEqual(before);
    expect((await api.getEvent("e_jeju")).members.find((member) => member.userId === "u_chulsoo")?.status).toBe("INACTIVE");
  });

  it("calculates exact balances and balanced transfers", async () => {
    await api.signInAs("u_younghee");
    const settlement = await api.getSettlement("e_jeju");

    expect(settlement.balances.reduce((sum, row) => sum + row.balance, 0)).toBe(0);
    expect(settlement.transfers.reduce((sum, transfer) => sum + transfer.amount, 0)).toBe(
      settlement.balances.filter((row) => row.balance > 0).reduce((sum, row) => sum + row.balance, 0),
    );
  });
});