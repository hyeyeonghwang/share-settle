import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/services";
import { AppShell } from "@/components/AppShell";
import { ClientOnly } from "@/components/ClientOnly";
import { Amount, EmptyNote, Eyebrow, Initial, PageHeader } from "@/components/ui-bits";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/events/$eventId/settlement")({
  head: () => ({
    meta: [
      { title: "Settlement — Split Table" },
      {
        name: "description",
        content:
          "What each person paid, what they owe, their net balance, and the shortest sensible list of transfers.",
      },
      { property: "og:title", content: "Settlement — Split Table" },
      {
        property: "og:description",
        content: "Net balances and the final who-pays-whom plan for this event.",
      },
    ],
  }),
  component: () => (
    <AppShell subtitle="Settlement">
      <ClientOnly>
        <SettlementBody />
      </ClientOnly>
    </AppShell>
  ),
});

function SettlementBody() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const { data: user, isLoading: sessionLoading } = useSession();

  useEffect(() => {
    if (!sessionLoading && !user) navigate({ to: "/", replace: true });
  }, [user, sessionLoading, navigate]);

  const detail = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.getEvent(eventId),
    enabled: Boolean(user),
  });
  const settlement = useQuery({
    queryKey: ["settlement", eventId],
    queryFn: () => api.getSettlement(eventId),
    enabled: Boolean(user),
  });

  if (!user) return null;
  if (detail.isLoading || settlement.isLoading)
    return <EmptyNote>Calculating settlement…</EmptyNote>;
  const error = detail.error ?? settlement.error;
  if (error) return <EmptyNote>{(error as Error).message}</EmptyNote>;
  if (!detail.data || !settlement.data) return null;

  const currency = detail.data.event.currency;
  const { balances, transfers } = settlement.data;

  return (
    <div className="ledger-enter space-y-12">
      <PageHeader
        eyebrow={detail.data.event.name}
        title="Settlement"
        backTo="/events/$eventId"
        backLabel="Back to event"
        backParams={{ eventId }}
      />

      <div className="grid gap-12 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <div className="mb-4 border-b border-line pb-4">
            <Eyebrow>Balances</Eyebrow>
          </div>
          <div className="divide-y divide-line">
            {balances.map((row) => (
              <div
                key={row.user.id}
                className="flex items-center justify-between gap-4 py-5"
              >
                <span className="flex items-center gap-3">
                  <Initial user={row.user} />
                  <span>
                    <span className="block font-semibold">{row.user.displayName}</span>
                    <span className="num mt-0.5 block text-xs text-muted-foreground">
                      Paid <Amount value={row.paid} currency={currency} /> • Owes{" "}
                      <Amount value={row.owed} currency={currency} />
                    </span>
                  </span>
                </span>
                <Amount
                  value={row.balance}
                  currency={currency}
                  signed
                  className={cn(
                    "text-xl",
                    row.balance > 0 && "text-receive",
                    row.balance < 0 && "text-owe",
                    row.balance === 0 && "text-muted-foreground",
                  )}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="hidden justify-center lg:col-span-1 lg:flex">
          <div className="w-px bg-line" />
        </div>

        <section className="lg:col-span-4">
          <div className="rounded-2xl bg-ink p-6 text-paper">
            <h2 className="font-mono text-xs tracking-[0.2em] uppercase opacity-60">
              Transfers
            </h2>
            {transfers.length === 0 ? (
              <p className="mt-5 font-mono text-xs opacity-60">
                Everyone is square — no transfers needed.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {transfers.map((transfer, index) => (
                  <div
                    key={`${transfer.from.id}-${transfer.to.id}-${index}`}
                    className="flex items-center justify-between gap-3 border-b border-paper/10 pb-4 last:border-0 last:pb-0"
                  >
                    <span className="text-sm">
                      {transfer.from.displayName}{" "}
                      <span className="opacity-60">→</span>{" "}
                      {transfer.to.displayName}
                    </span>
                    <Amount
                      value={transfer.amount}
                      currency={currency}
                      className="text-base"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="mt-4 font-mono text-[11px] text-muted-foreground">
            A greedy plan that keeps the number of transfers small and always adds up
            to the exact balances.
          </p>
        </section>
      </div>
    </div>
  );
}
