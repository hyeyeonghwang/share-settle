import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/services";
import { AppShell } from "@/components/AppShell";
import { ClientOnly } from "@/components/ClientOnly";
import { Amount, EmptyNote, Eyebrow, Initial, PageHeader } from "@/components/ui-bits";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/events/$eventId/")({
  head: () => ({
    meta: [
      { title: "Event overview — Split Table" },
      {
        name: "description",
        content:
          "Everything spent on this event: recent expenses, who paid, and shortcuts to the settlement.",
      },
      { property: "og:title", content: "Event overview — Split Table" },
      {
        property: "og:description",
        content: "Recent expenses, participants and settlement for a shared event.",
      },
    ],
  }),
  component: () => (
    <AppShell subtitle="Event">
      <ClientOnly>
        <EventBody />
      </ClientOnly>
    </AppShell>
  ),
});

function EventBody() {
  const { eventId } = Route.useParams();
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

  const setStatus = useMutation({
    mutationFn: (status: "ACTIVE" | "COMPLETED") =>
      api.setEventStatus(eventId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Event status updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!user) return null;
  if (detail.isLoading) return <EmptyNote>Loading event…</EmptyNote>;
  if (detail.error)
    return <EmptyNote>{(detail.error as Error).message}</EmptyNote>;
  if (!detail.data) return null;

  const { event, members, expenses, totalSpent, isCreator } = detail.data;
  const currency = event.currency;
  const completed = event.status === "COMPLETED";
  const inviteLink =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/join/${event.inviteCode}`;

  return (
    <div className="ledger-enter space-y-12">
      <PageHeader
        eyebrow={completed ? "Completed event" : "Active event"}
        title={event.name}
        backTo="/events"
        backLabel="My events"
        actions={
          <>
            {completed ? null : (
              <Link
                to="/events/$eventId/expenses/new"
                params={{ eventId }}
                className="grid h-12 place-items-center rounded-xl bg-ink px-5 font-semibold text-paper transition-all hover:bg-ink/90 active:scale-[0.98]"
              >
                + Add expense
              </Link>
            )}
            <Link
              to="/events/$eventId/settlement"
              params={{ eventId }}
              className="grid h-12 place-items-center rounded-xl border border-line px-5 font-semibold transition-colors hover:bg-fill"
            >
              View settlement
            </Link>
            <Link
              to="/events/$eventId/members"
              params={{ eventId }}
              className="grid h-12 place-items-center rounded-xl border border-line px-5 font-semibold transition-colors hover:bg-fill"
            >
              Participants
            </Link>
          </>
        }
      />

      <div className="grid gap-12 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
            <Eyebrow>Recent expenses</Eyebrow>
            <span className="font-mono text-[11px] text-muted-foreground">
              {expenses.length}
            </span>
          </div>
          {expenses.length === 0 ? (
            <EmptyNote>No expenses recorded yet.</EmptyNote>
          ) : (
            <div className="divide-y divide-line">
              {expenses.map((view) => (
                <Link
                  key={view.expense.id}
                  to="/events/$eventId/expenses/$expenseId"
                  params={{ eventId, expenseId: view.expense.id }}
                  className="flex items-center justify-between gap-4 rounded-lg px-2 py-5 transition-colors hover:bg-fill"
                >
                  <span className="flex items-center gap-3">
                    <Initial user={view.payer} />
                    <span>
                      <span className="block font-semibold">
                        {view.expense.title}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                        Paid by {view.payer.displayName} • entered by{" "}
                        {view.creator.displayName} •{" "}
                        {view.expense.splitType === "EQUAL"
                          ? "equal"
                          : "fixed + equal"}
                      </span>
                    </span>
                  </span>
                  <Amount
                    value={view.expense.totalAmount}
                    currency={currency}
                    className="text-lg"
                  />
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="hidden justify-center lg:col-span-1 lg:flex">
          <div className="w-px bg-line" />
        </div>

        <section className="space-y-8 lg:col-span-4">
          <div className="rounded-2xl bg-ink p-6 text-paper">
            <Eyebrow>Total spent</Eyebrow>
            <p className="num mt-3 text-4xl">
              <Amount value={totalSpent} currency={currency} />
            </p>
            <p className="mt-3 font-mono text-[11px] opacity-60">
              {members.length} participants • {currency}
            </p>
          </div>

          <div className="rounded-2xl border border-line p-6">
            <Eyebrow>Invitation</Eyebrow>
            <p className="num mt-3 text-2xl tracking-[0.3em]">{event.inviteCode}</p>
            <p className="mt-2 font-mono text-[11px] break-all text-muted-foreground">
              {inviteLink}
            </p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(inviteLink);
                toast.success("Invitation link copied.");
              }}
              className="mt-4 h-11 w-full rounded-xl border border-line font-semibold transition-colors hover:bg-fill"
            >
              Copy invitation link
            </button>
          </div>

          {isCreator ? (
            <div className="rounded-2xl border border-line p-6">
              <Eyebrow>Creator controls</Eyebrow>
              <p className="mt-3 text-sm text-muted-foreground">
                {completed
                  ? "This event is locked. Reopen it to correct anything."
                  : "Completing the event locks all expenses."}
              </p>
              <button
                onClick={() => setStatus.mutate(completed ? "ACTIVE" : "COMPLETED")}
                disabled={setStatus.isPending}
                className="mt-4 h-11 w-full rounded-xl bg-ink font-semibold text-paper transition-all hover:bg-ink/90 active:scale-[0.98] disabled:opacity-60"
              >
                {completed ? "Reopen event" : "Mark as completed"}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
