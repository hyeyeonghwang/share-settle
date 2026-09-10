import { useMemo, useState } from "react";
import { Eyebrow } from "@/components/ui-bits";
import { formatMoney, parseMoney, toInputValue } from "@/domain/money";
import { computeShares, validateExpense } from "@/domain/split";
import type {
  EventRecord,
  ExpenseInput,
  ExpenseView,
  MemberView,
  SplitType,
} from "@/domain/types";
import { cn } from "@/lib/utils";

interface ItemDraft {
  name: string;
  amountText: string;
}

export function ExpenseForm({
  event,
  members,
  currentUserId,
  initial,
  submitting,
  onSubmit,
  onDelete,
}: {
  event: EventRecord;
  members: MemberView[];
  currentUserId: string;
  initial?: ExpenseView;
  submitting: boolean;
  onSubmit: (input: ExpenseInput) => void;
  onDelete?: () => void;
}) {
  const currency = event.currency;
  const activeMembers = members.filter((m) => m.status === "ACTIVE");

  const [title, setTitle] = useState(initial?.expense.title ?? "");
  const [amountText, setAmountText] = useState(
    initial ? toInputValue(initial.expense.totalAmount, currency) : "",
  );
  const [payerId, setPayerId] = useState(
    initial?.expense.payerId ??
      (activeMembers.some((m) => m.userId === currentUserId)
        ? currentUserId
        : (activeMembers[0]?.userId ?? "")),
  );
  const [splitType, setSplitType] = useState<SplitType>(
    initial?.expense.splitType ?? "EQUAL",
  );
  const [selected, setSelected] = useState<string[]>(
    initial
      ? initial.participants.map((p) => p.userId)
      : activeMembers.map((m) => m.userId),
  );
  const [fixedText, setFixedText] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    initial?.participants.forEach((p) => {
      if (p.mode === "FIXED" && p.fixedAmount != null)
        out[p.userId] = toInputValue(p.fixedAmount, currency);
    });
    return out;
  });
  const [items, setItems] = useState<ItemDraft[]>(
    initial && initial.items.length > 0
      ? initial.items.map((i) => ({
          name: i.name,
          amountText: toInputValue(i.amount, currency),
        }))
      : [{ name: "", amountText: "" }],
  );

  const totalAmount = parseMoney(amountText, currency) ?? 0;
  const memberOrder = members.map((m) => m.userId);

  const draft: ExpenseInput = useMemo(
    () => ({
      title,
      totalAmount,
      payerId,
      splitType,
      items: items
        .filter((i) => i.name.trim() !== "" || i.amountText.trim() !== "")
        .map((i) => ({
          name: i.name.trim() || "Item",
          amount: parseMoney(i.amountText, currency) ?? 0,
        })),
      participants: selected.map((userId) => {
        const fixed =
          splitType === "FIXED_PLUS_EQUAL"
            ? parseMoney(fixedText[userId] ?? "", currency)
            : null;
        return {
          userId,
          mode: fixed != null ? ("FIXED" as const) : ("AUTO" as const),
          fixedAmount: fixed,
        };
      }),
    }),
    [title, totalAmount, payerId, splitType, items, selected, fixedText, currency],
  );

  const errors = validateExpense(draft, memberOrder);
  const shares = computeShares(totalAmount, draft.participants, memberOrder);
  const itemsTotal = draft.items.reduce((a, i) => a + i.amount, 0);
  const uncategorised = totalAmount - itemsTotal;
  const fixedTotal = draft.participants
    .filter((p) => p.mode === "FIXED")
    .reduce((a, p) => a + (p.fixedAmount ?? 0), 0);
  const autoParticipants = draft.participants.filter((p) => p.mode === "AUTO");
  const remaining = totalAmount - fixedTotal;

  const toggle = (userId: string) =>
    setSelected((current) =>
      current.includes(userId)
        ? current.filter((x) => x !== userId)
        : [...current, userId],
    );

  return (
    <form
      className="grid gap-12 lg:grid-cols-12"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
    >
      <div className="space-y-8 lg:col-span-7">
        <div className="space-y-3">
          <Eyebrow>Expense title</Eyebrow>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sunset Dinner"
            aria-label="Expense title"
            className="h-14 w-full rounded-xl border border-line bg-paper px-4 text-lg font-semibold outline-none focus:border-ink"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Eyebrow>Total amount ({currency})</Eyebrow>
            <input
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              inputMode="decimal"
              placeholder="90000"
              aria-label="Total amount"
              className="num h-14 w-full rounded-xl border border-line bg-paper px-4 text-lg outline-none focus:border-ink"
            />
          </div>
          <div className="space-y-3">
            <Eyebrow>Paid by</Eyebrow>
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              aria-label="Paid by"
              className="h-14 w-full rounded-xl border border-line bg-paper px-4 text-sm outline-none focus:border-ink"
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.displayName}
                  {m.status === "INACTIVE" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <Eyebrow>Detail items (optional)</Eyebrow>
            <button
              type="button"
              onClick={() => setItems((c) => [...c, { name: "", amountText: "" }])}
              className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-ink"
            >
              + Add item
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={item.name}
                  onChange={(e) =>
                    setItems((c) =>
                      c.map((it, i) => (i === index ? { ...it, name: e.target.value } : it)),
                    )
                  }
                  placeholder="Pork"
                  aria-label={`Item ${index + 1} name`}
                  className="h-11 flex-1 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-ink"
                />
                <input
                  value={item.amountText}
                  onChange={(e) =>
                    setItems((c) =>
                      c.map((it, i) =>
                        i === index ? { ...it, amountText: e.target.value } : it,
                      ),
                    )
                  }
                  inputMode="decimal"
                  placeholder="60000"
                  aria-label={`Item ${index + 1} amount`}
                  className="num h-11 w-36 rounded-lg border border-line bg-paper px-3 text-right text-sm outline-none focus:border-ink"
                />
                <button
                  type="button"
                  onClick={() => setItems((c) => c.filter((_, i) => i !== index))}
                  aria-label={`Remove item ${index + 1}`}
                  className="h-11 w-11 rounded-lg border border-line font-mono text-xs text-muted-foreground transition-colors hover:bg-fill"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {draft.items.length > 0 ? (
            <p className="num text-xs text-muted-foreground">
              Items {formatMoney(itemsTotal, currency)} • Uncategorised{" "}
              {formatMoney(uncategorised, currency)}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="border-b border-line pb-3">
            <Eyebrow>Responsible participants</Eyebrow>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {members.map((m) => (
              <label
                key={m.userId}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border border-line px-4 py-3 text-sm transition-colors",
                  selected.includes(m.userId) ? "bg-fill" : "bg-paper",
                  m.status === "INACTIVE" && "opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(m.userId)}
                  onChange={() => toggle(m.userId)}
                  className="size-4 accent-ink"
                />
                <span className="font-medium">{m.user.displayName}</span>
                {m.status === "INACTIVE" ? (
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                    Inactive
                  </span>
                ) : null}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-5">
        <div className="sticky top-24 space-y-6">
          <div className="rounded-2xl border border-line p-6">
            <Eyebrow>Split method</Eyebrow>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(
                [
                  ["EQUAL", "Equal split"],
                  ["FIXED_PLUS_EQUAL", "Fixed + equal"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSplitType(value)}
                  className={cn(
                    "h-11 rounded-lg border text-sm font-medium transition-colors",
                    splitType === value
                      ? "border-ink bg-ink text-paper"
                      : "border-line hover:bg-fill",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {splitType === "FIXED_PLUS_EQUAL" ? (
              <div className="mt-5 space-y-2">
                {selected.length === 0 ? (
                  <p className="font-mono text-xs text-muted-foreground">
                    Select participants first.
                  </p>
                ) : null}
                {members
                  .filter((m) => selected.includes(m.userId))
                  .map((m) => (
                    <div key={m.userId} className="flex items-center gap-3">
                      <span className="flex-1 text-sm">{m.user.displayName}</span>
                      <input
                        value={fixedText[m.userId] ?? ""}
                        onChange={(e) =>
                          setFixedText((c) => ({ ...c, [m.userId]: e.target.value }))
                        }
                        inputMode="decimal"
                        placeholder="Auto"
                        aria-label={`Fixed amount for ${m.user.displayName}`}
                        className="num h-10 w-32 rounded-lg border border-line bg-paper px-3 text-right text-sm outline-none focus:border-ink"
                      />
                    </div>
                  ))}
                <p className="num pt-2 text-xs text-muted-foreground">
                  Fixed {formatMoney(fixedTotal, currency)} • Remaining{" "}
                  {formatMoney(remaining, currency)}
                  {autoParticipants.length > 0
                    ? ` • ${formatMoney(
                        Math.floor(remaining / autoParticipants.length),
                        currency,
                      )} each for ${autoParticipants.length}`
                    : ""}
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl bg-ink p-6 text-paper">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-mono text-xs tracking-[0.2em] uppercase opacity-60">
                Each person owes
              </h3>
              <span className="rounded border border-paper/20 px-2 py-0.5 font-mono text-[10px]">
                {splitType === "EQUAL" ? "EQUAL" : "FIXED+EQUAL"}
              </span>
            </div>
            <div className="space-y-3">
              {selected.length === 0 ? (
                <p className="font-mono text-xs opacity-60">No participants selected.</p>
              ) : (
                members
                  .filter((m) => selected.includes(m.userId))
                  .map((m) => (
                    <div key={m.userId} className="flex items-center justify-between">
                      <span className="text-sm">{m.user.displayName}</span>
                      <span className="num text-base">
                        {formatMoney(shares[m.userId] ?? 0, currency)}
                      </span>
                    </div>
                  ))
              )}
              <div className="h-px w-full bg-paper/10" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase opacity-60">Total</span>
                <span className="num text-base">
                  {formatMoney(totalAmount, currency)}
                </span>
              </div>
            </div>
          </div>

          {errors.length > 0 ? (
            <ul className="space-y-1 rounded-2xl border border-line bg-fill p-4 text-xs text-owe">
              {errors.map((error) => (
                <li key={error}>• {error}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || errors.length > 0}
              className="h-14 flex-1 rounded-xl bg-ink font-semibold text-paper transition-all hover:bg-ink/90 active:scale-[0.98] disabled:opacity-40"
            >
              Save expense
            </button>
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="h-14 rounded-xl border border-line px-5 font-semibold text-owe transition-colors hover:bg-fill"
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  );
}
