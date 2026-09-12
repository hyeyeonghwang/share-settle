import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/services";
import { AppShell } from "@/components/AppShell";
import { ClientOnly } from "@/components/ClientOnly";
import { Amount, EmptyNote, Eyebrow, PageHeader } from "@/components/ui-bits";
import { ExpenseForm } from "@/components/ExpenseForm";
import { useSession } from "@/hooks/useSession";
import type { ExpenseInput } from "@/domain/types";

export const Route = createFileRoute("/events/$eventId/expenses/$expenseId")({
  head: () => ({
    meta: [
      { title: "Expense detail — Split Table" },
      {
        name: "description",
        content: "Review one expense, its line items and each participant's share.",
      },
      { property: "og:title", content: "Expense detail — Split Table" },
      {
        property: "og:description",
        content: "Line items, payer, and per-person shares for a single expense.",
      },
    ],
  }),
  component: () => (
    <AppShell subtitle="Expense">
      <ClientOnly>
        <ExpenseBody />
      </ClientOnly>
    </AppShell>
  ),
});

function ExpenseBody() {
  const { eventId, expenseId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user, isLoading: sessionLoading } = useSession();

  useEffect(() => {
    if (!sessionLoading && !user) navigate({ to: "/", replace: true });
  }, [user, sessionLoading, navigate]);

  const detail = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.getEvent(eventId),
    enabled: Boolean(user),
  });
  const expense = useQuery({
    queryKey: ["expense", eventId, expenseId],
    queryFn: () => api.getExpense(eventId, expenseId),
    enabled: Boolean(user),
  });

  const update = useMutation({
    mutationFn: (input: ExpenseInput) =>
      api.updateExpense(eventId, expenseId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Expense updated.");
      navigate({ to: "/events/$eventId", params: { eventId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteExpense(eventId, expenseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Expense deleted.");
      navigate({ to: "/events/$eventId", params: { eventId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!user) return null;
  if (detail.isLoading || expense.isLoading)
    return <EmptyNote>Loading expense…</EmptyNote>;
  const error = detail.error ?? expense.error;
  if (error) return <EmptyNote>{(error as Error).message}</EmptyNote>;
  if (!detail.data || !expense.data) return null;

  const view = expense.data;
  const currency = detail.data.event.currency;
  const itemsTotal = view.items.reduce((a, i) => a + i.amount, 0);

  return (
    <div className="ledger-enter space-y-12">
      <PageHeader
        eyebrow={detail.data.event.name}
        title={view.expense.title}
        backTo="/events/$eventId"
        backLabel="Back to event"
        backParams={{ eventId }}
      />

      <div className="grid max-w-3xl gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-line p-5">
          <Eyebrow>Total</Eyebrow>
          <p className="mt-2 text-2xl">
            <Amount value={view.expense.totalAmount} currency={currency} />
          </p>
        </div>
        <div className="rounded-2xl border border-line p-5">
          <Eyebrow>Paid by</Eyebrow>
          <p className="mt-2 text-lg font-semibold">{view.payer.displayName}</p>
        </div>
        <div className="rounded-2xl border border-line p-5">
          <Eyebrow>Entered by</Eyebrow>
          <p className="mt-2 text-lg font-semibold">{view.creator.displayName}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {new Date(view.expense.createdAt).toISOString().slice(0, 10)}
          </p>
        </div>
      </div>

      {view.items.length > 0 ? (
        <div className="max-w-3xl">
          <div className="mb-3 border-b border-line pb-3">
            <Eyebrow>Detail items</Eyebrow>
          </div>
          <div className="divide-y divide-line">
            {view.items.map((item) => (
              <div key={item.id} className="flex justify-between py-3 text-sm">
                <span>{item.name}</span>
                <Amount value={item.amount} currency={currency} />
              </div>
            ))}
            <div className="flex justify-between py-3 font-mono text-xs text-muted-foreground">
              <span>Other / uncategorised</span>
              <Amount
                value={view.expense.totalAmount - itemsTotal}
                currency={currency}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-w-3xl">
        <div className="mb-3 border-b border-line pb-3">
          <Eyebrow>Each person owes</Eyebrow>
        </div>
        <div className="divide-y divide-line">
          {view.participants.map((participant) => {
            const person = detail.data.members.find(
              (m) => m.userId === participant.userId,
            );
            return (
              <div
                key={participant.id}
                className="flex justify-between py-3 text-sm"
              >
                <span>
                  {person?.user.displayName ?? participant.userId}
                  {participant.mode === "FIXED" ? (
                    <span className="ml-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                      Fixed
                    </span>
                  ) : null}
                </span>
                <Amount
                  value={view.shares[participant.userId] ?? 0}
                  currency={currency}
                />
              </div>
            );
          })}
        </div>
      </div>

      {view.canEdit ? (
        <div className="space-y-6 border-t border-line pt-12">
          <Eyebrow>Edit this expense</Eyebrow>
          <ExpenseForm
            event={detail.data.event}
            members={detail.data.members}
            currentUserId={detail.data.currentUserId}
            initial={view}
            submitting={update.isPending || remove.isPending}
            onSubmit={(input) => update.mutate(input)}
            onDelete={() => remove.mutate()}
          />
        </div>
      ) : (
        <p className="font-mono text-[11px] text-muted-foreground">
          {detail.data.event.status === "COMPLETED"
            ? "This event is completed, so expenses are locked."
            : "Only the person who entered this expense or the event creator can change it."}
        </p>
      )}
    </div>
  );
}
