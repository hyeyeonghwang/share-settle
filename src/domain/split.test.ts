import { describe, expect, it } from "vitest";
import { computeShares, computeTransfers, splitEqually, validateExpense } from "./split";
import type { Balance, ExpenseInput, User } from "./types";

const [ua, ub, uc] = [
  { id: "a", displayName: "A", email: "a@example.com", authProvider: "test", createdAt: "2026-01-01" },
  { id: "b", displayName: "B", email: "b@example.com", authProvider: "test", createdAt: "2026-01-01" },
  { id: "c", displayName: "C", email: "c@example.com", authProvider: "test", createdAt: "2026-01-01" },
  { id: "d", displayName: "D", email: "d@example.com", authProvider: "test", createdAt: "2026-01-01" },
] as const satisfies readonly User[];

describe("expense splitting", () => {
  it("distributes an integer remainder using stable participant order", () => {
    expect(splitEqually(10_000, ["a", "b", "c"])).toEqual({
      a: 3334,
      b: 3333,
      c: 3333,
    });
  });

  it("splits the remainder after fixed amounts", () => {
    const shares = computeShares(
      120_000,
      [
        { userId: "a", mode: "FIXED", fixedAmount: 50_000 },
        { userId: "b", mode: "FIXED", fixedAmount: 20_000 },
        { userId: "c", mode: "AUTO", fixedAmount: null },
        { userId: "d", mode: "AUTO", fixedAmount: null },
      ],
      ["a", "b", "c", "d"],
    );

    expect(shares).toEqual({ a: 50_000, b: 20_000, c: 25_000, d: 25_000 });
    expect(Object.values(shares).reduce((sum, amount) => sum + amount, 0)).toBe(120_000);
  });

  it("rejects invalid fixed splits and oversized detail items", () => {
    const input: ExpenseInput = {
      title: "Dinner",
      totalAmount: 100,
      payerId: "a",
      splitType: "FIXED_PLUS_EQUAL",
      items: [{ name: "Food", amount: 101 }],
      participants: [
        { userId: "a", mode: "FIXED", fixedAmount: 60 },
        { userId: "b", mode: "FIXED", fixedAmount: 30 },
      ],
    };

    expect(validateExpense(input, ["a", "b"])).toEqual([
      "Detail items add up to more than the total amount.",
      "Every participant has a fixed amount, so the fixed amounts must equal the total.",
    ]);
  });
});

describe("settlement transfers", () => {
  it("creates deterministic transfers that settle every balance", () => {
    const balances: Balance[] = [
      { user: ua, paid: 180_000, owed: 110_000, balance: 70_000 },
      { user: ub, paid: 50_000, owed: 100_000, balance: -50_000 },
      { user: uc, paid: 70_000, owed: 90_000, balance: -20_000 },
    ];

    expect(computeTransfers(balances)).toEqual([
      { from: ub, to: ua, amount: 50_000 },
      { from: uc, to: ua, amount: 20_000 },
    ]);
  });
});