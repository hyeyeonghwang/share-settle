import type {
  Balance,
  ExpenseInput,
  ExpenseParticipantInput,
  Transfer,
  User,
} from "./types";

/**
 * Deterministic integer equal split.
 * base = total // n, remainder distributed one unit at a time following the
 * given (stable) member ordering. Guarantees sum(result) === total.
 */
export function splitEqually(
  total: number,
  userIds: string[],
): Record<string, number> {
  const n = userIds.length;
  const out: Record<string, number> = {};
  if (n === 0) return out;
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  userIds.forEach((id, index) => {
    out[id] = base + (index < remainder ? 1 : 0);
  });
  return out;
}

/** Stable ordering: event member order first, then userId as a tie-break. */
export function orderUserIds(userIds: string[], memberOrder: string[]): string[] {
  const rank = new Map(memberOrder.map((id, i) => [id, i]));
  return [...userIds].sort((a, b) => {
    const ra = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * Final amount owed per participant.
 * EQUAL -> everyone shares equally.
 * FIXED_PLUS_EQUAL -> FIXED participants take their fixed amount, the
 * remainder is split equally among the AUTO participants.
 */
export function computeShares(
  totalAmount: number,
  participants: ExpenseParticipantInput[],
  memberOrder: string[] = [],
): Record<string, number> {
  const ordered = orderUserIds(
    participants.map((p) => p.userId),
    memberOrder,
  );
  const byUser = new Map(participants.map((p) => [p.userId, p]));

  const fixedIds = ordered.filter(
    (id) => byUser.get(id)?.mode === "FIXED" && byUser.get(id)?.fixedAmount != null,
  );
  const autoIds = ordered.filter((id) => !fixedIds.includes(id));

  if (fixedIds.length === 0) return splitEqually(totalAmount, ordered);

  const shares: Record<string, number> = {};
  let fixedTotal = 0;
  for (const id of fixedIds) {
    const amount = byUser.get(id)?.fixedAmount ?? 0;
    shares[id] = amount;
    fixedTotal += amount;
  }

  const remaining = totalAmount - fixedTotal;
  if (autoIds.length > 0) {
    Object.assign(shares, splitEqually(remaining, autoIds));
  }
  return shares;
}

export function sumShares(shares: Record<string, number>): number {
  return Object.values(shares).reduce((a, b) => a + b, 0);
}

/** Validation rules from the spec. Returns human readable messages. */
export function validateExpense(
  input: ExpenseInput,
  eventMemberIds: string[],
): string[] {
  const errors: string[] = [];

  if (!input.title.trim()) errors.push("Title is required.");
  if (!Number.isInteger(input.totalAmount) || input.totalAmount <= 0)
    errors.push("Total amount must be greater than zero.");
  if (!input.payerId) errors.push("A payer must be selected.");
  else if (!eventMemberIds.includes(input.payerId))
    errors.push("The payer must be a member of this event.");

  if (input.participants.length === 0)
    errors.push("At least one responsible participant must be selected.");
  if (input.participants.some((p) => !eventMemberIds.includes(p.userId)))
    errors.push("Every responsible participant must be a member of this event.");

  const itemsTotal = input.items.reduce((a, i) => a + i.amount, 0);
  if (itemsTotal > input.totalAmount)
    errors.push("Detail items add up to more than the total amount.");
  if (input.items.some((i) => i.amount < 0))
    errors.push("Detail item amounts cannot be negative.");

  if (input.splitType === "FIXED_PLUS_EQUAL") {
    const fixed = input.participants.filter(
      (p) => p.mode === "FIXED" && p.fixedAmount != null,
    );
    const fixedTotal = fixed.reduce((a, p) => a + (p.fixedAmount ?? 0), 0);
    if (fixed.some((p) => (p.fixedAmount ?? 0) < 0))
      errors.push("Fixed amounts cannot be negative.");
    if (fixedTotal > input.totalAmount)
      errors.push("Fixed amounts add up to more than the total amount.");
    const autoCount = input.participants.length - fixed.length;
    if (autoCount === 0 && fixedTotal !== input.totalAmount)
      errors.push(
        "Every participant has a fixed amount, so the fixed amounts must equal the total.",
      );
  }

  return errors;
}

/** Greedy transfer plan: largest creditor paired with largest debtor. */
export function computeTransfers(balances: Balance[]): Transfer[] {
  const byId = new Map<string, User>(balances.map((b) => [b.user.id, b.user]));
  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ id: b.user.id, amount: b.balance }));
  const debtors = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ id: b.user.id, amount: -b.balance }));

  const sortDesc = (a: { id: string; amount: number }, b: { id: string; amount: number }) =>
    b.amount - a.amount || (a.id < b.id ? -1 : 1);

  creditors.sort(sortDesc);
  debtors.sort(sortDesc);

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);
    if (amount > 0) {
      transfers.push({
        from: byId.get(debtor.id)!,
        to: byId.get(creditor.id)!,
        amount,
      });
    }
    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount === 0) ci += 1;
    if (debtor.amount === 0) di += 1;
  }
  return transfers;
}
