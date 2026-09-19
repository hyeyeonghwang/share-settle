import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/services";
import { AppShell } from "@/components/AppShell";
import { ClientOnly } from "@/components/ClientOnly";
import { Amount, EmptyNote, Eyebrow } from "@/components/ui-bits";
import { CURRENCIES, CURRENCY_CODES } from "@/domain/money";
import type { CurrencyCode, EventSummary } from "@/domain/types";
import { useRequiredSession } from "@/hooks/useSession";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: "My events — Split Table" },
      {
        name: "description",
        content: "All the trips, dinners and gatherings you are splitting costs for.",
      },
      { property: "og:title", content: "My events — Split Table" },
      {
        property: "og:description",
        content: "All the trips, dinners and gatherings you are splitting costs for.",
      },
    ],
  }),
  component: () => (
    <AppShell subtitle="My events">
      <ClientOnly>
        <EventsBody />
      </ClientOnly>
    </AppShell>
  ),
});

function EventsBody() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useRequiredSession();

  const events = useQuery({
    queryKey: ["events"],
    queryFn: () => api.listEvents(),
    enabled: Boolean(user),
  });

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("KRW");
  const [code, setCode] = useState("");

  const createEvent = useMutation({
    mutationFn: () => api.createEvent({ name, currency }),
    onSuccess: async (event) => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      navigate({ to: "/events/$eventId", params: { eventId: event.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const joinEvent = useMutation({
    mutationFn: () => api.joinEvent(code),
    onSuccess: async (event) => {
      setCode("");
      await queryClient.invalidateQueries();
      navigate({ to: "/events/$eventId", params: { eventId: event.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!user) return null;

  const list = events.data ?? [];
  const active = list.filter((e) => e.event.status === "ACTIVE");
  const completed = list.filter((e) => e.event.status === "COMPLETED");

  return (
    <div className="ledger-enter grid gap-12 lg:grid-cols-12">
      <section className="lg:col-span-7">
        <Eyebrow>Signed in as {user.displayName}</Eyebrow>
        <h1 className="mt-1 font-display text-5xl leading-[0.9] font-semibold tracking-tight italic">
          My Events
        </h1>

        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
            <Eyebrow>Active</Eyebrow>
            <span className="font-mono text-[11px] text-muted-foreground">
              {active.length}
            </span>
          </div>
          {active.length === 0 ? (
            <EmptyNote>No active events yet. Create one on the right.</EmptyNote>
          ) : (
            <div className="space-y-1">
              {active.map((summary) => (
                <EventRow key={summary.event.id} summary={summary} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
            <Eyebrow>Completed</Eyebrow>
            <span className="font-mono text-[11px] text-muted-foreground">
              {completed.length}
            </span>
          </div>
          {completed.length === 0 ? (
            <EmptyNote>Nothing settled and closed yet.</EmptyNote>
          ) : (
            <div className="space-y-1 opacity-70">
              {completed.map((summary) => (
                <EventRow key={summary.event.id} summary={summary} />
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="hidden justify-center lg:col-span-1 lg:flex">
        <div className="w-px bg-line" />
      </div>

      <section className="space-y-10 lg:col-span-4">
        <div className="rounded-2xl border border-line bg-fill p-6">
          <Eyebrow>Create event</Eyebrow>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) {
                toast.error("Give the event a name first.");
                return;
              }
              createEvent.mutate();
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jeju Trip"
              aria-label="Event name"
              className="h-12 w-full rounded-xl border border-line bg-paper px-4 text-sm outline-none focus:border-ink"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              aria-label="Currency"
              className="h-12 w-full rounded-xl border border-line bg-paper px-4 font-mono text-sm outline-none focus:border-ink"
            >
              {CURRENCY_CODES.map((c) => (
                <option key={c} value={c}>
                  {c} — {CURRENCIES[c].label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={createEvent.isPending}
              className="h-12 w-full rounded-xl bg-ink font-semibold text-paper transition-all hover:bg-ink/90 active:scale-[0.98] disabled:opacity-60"
            >
              Create event
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-line p-6">
          <Eyebrow>Join with a code</Eyebrow>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!code.trim()) {
                toast.error("Enter an invite code.");
                return;
              }
              joinEvent.mutate();
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="JEJU24"
              aria-label="Invite code"
              className="num h-12 w-full rounded-xl border border-line bg-paper px-4 text-sm tracking-[0.3em] uppercase outline-none focus:border-ink"
            />
            <button
              type="submit"
              disabled={joinEvent.isPending}
              className="h-12 w-full rounded-xl border border-line font-semibold transition-colors hover:bg-fill disabled:opacity-60"
            >
              Join event
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function EventRow({ summary }: { summary: EventSummary }) {
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: summary.event.id }}
      className="group flex items-center justify-between rounded-lg px-2 py-4 transition-colors hover:bg-fill"
    >
      <span>
        <span className="block font-semibold">{summary.event.name}</span>
        <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
          {summary.memberCount} members • {summary.expenseCount} records
          {summary.isCreator ? " • you created this" : ""}
        </span>
      </span>
      <Amount
        value={summary.totalSpent}
        currency={summary.event.currency}
        className="text-lg"
      />
    </Link>
  );
}
