import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/services";
import { ClientOnly } from "@/components/ClientOnly";
import { useSession } from "@/hooks/useSession";
import { Initial } from "@/components/ui-bits";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Split Table — Sign in and split shared expenses" },
      {
        name: "description",
        content:
          "Sign in to Split Table to record group expenses per event, split them equally or with fixed amounts, and see who pays whom.",
      },
      { property: "og:title", content: "Split Table — Sign in and split shared expenses" },
      {
        property: "og:description",
        content: "Event-based expense splitting with a deterministic settlement plan.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <ClientOnly>
        <LoginBody />
      </ClientOnly>
    </div>
  );
}

function LoginBody() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useSession();

  useEffect(() => {
    if (user) navigate({ to: "/events", replace: true });
  }, [user, navigate]);

  const accounts = useQuery({
    queryKey: ["demo-accounts"],
    queryFn: () => api.listDemoAccounts(),
  });

  const signIn = useMutation({
    mutationFn: (userId?: string) =>
      userId ? api.signInAs(userId) : api.signInWithGoogle(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      navigate({ to: "/events", replace: true });
    },
  });

  if (isLoading || user) return null;

  return (
    <div className="ledger-enter mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-12 px-6 py-16 lg:grid-cols-12 lg:py-24">
      <section className="lg:col-span-5">
        <div className="flex items-center gap-3">
          <span className="size-5 rotate-45 bg-ink" aria-hidden="true" />
          <span className="font-mono text-sm font-bold tracking-tighter uppercase">
            Split Table
          </span>
        </div>
        <h1 className="mt-10 font-display text-5xl leading-[0.9] font-semibold tracking-tight text-balance italic lg:text-7xl">
          Shared costs, settled cleanly.
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
          Create an event, add what everyone spent, split equally or with fixed amounts,
          and get a short list of who pays whom.
        </p>

        <div className="mt-12 space-y-3">
          <button
            onClick={() => signIn.mutate(undefined)}
            disabled={signIn.isPending}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-ink font-semibold text-paper transition-all hover:bg-ink/90 active:scale-[0.98] disabled:opacity-60"
          >
            Continue with Google
          </button>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Demo sign-in — no real account needed
          </p>
        </div>
      </section>

      <div className="hidden justify-center lg:col-span-2 lg:flex">
        <div className="relative w-px bg-line">
          <span className="absolute top-1/4 -left-1.5 size-3 rotate-45 border border-ink bg-paper" />
          <span className="absolute bottom-1/4 -left-1.5 size-3 rotate-45 border border-ink bg-paper" />
        </div>
      </div>

      <section className="lg:col-span-5">
        <span className="eyebrow">Switch account</span>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Demo participants</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in as any of these people to try the multi-user flow: creating events,
          joining with a code and editing each other's expenses.
        </p>
        <div className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {(accounts.data ?? []).map((account) => (
            <button
              key={account.id}
              onClick={() => signIn.mutate(account.id)}
              disabled={signIn.isPending}
              className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-fill disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <Initial user={account} />
                <span>
                  <span className="block font-semibold">{account.displayName}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {account.email}
                  </span>
                </span>
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">→</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
