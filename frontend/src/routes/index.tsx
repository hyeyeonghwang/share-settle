import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/services";
import { ClientOnly } from "@/components/ClientOnly";
import { useSession } from "@/hooks/useSession";

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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) void navigate({ to: "/events", replace: true });
  }, [user, navigate]);

  const auth = useMutation({
    retry: false,
    mutationFn: () =>
      mode === "register"
        ? api.register({ displayName, email, password })
        : api.signInWithPassword({ email, password }),
    onSuccess: (user) => {
      queryClient.setQueryData(["session"], user);
    },
    onError: (error) => {
      console.error("Sign in request failed", error);
    },
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (auth.isPending) return;
    console.log("Sign in submitted", {
      mode,
      email,
      displayName: mode === "register" ? displayName : undefined,
      passwordProvided: Boolean(password),
    });

    try {
      await auth.mutateAsync();
    } catch (error) {
      // React Query stores the error in auth.isError; log it here as well so
      // a failed request is visible while debugging a Docker deployment.
      console.error("Sign in failed", error);
    }
  }

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
          Create an event, add what everyone spent, split equally or with fixed amounts, and get a
          short list of who pays whom.
        </p>

        <form className="mt-12 space-y-3" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
              required
              minLength={1}
              className="h-12 w-full rounded-xl border border-line bg-paper px-4 text-sm"
            />
          ) : null}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
            className="h-12 w-full rounded-xl border border-line bg-paper px-4 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password (8+ characters to register)"
            required
            minLength={mode === "register" ? 8 : 1}
            className="h-12 w-full rounded-xl border border-line bg-paper px-4 text-sm"
          />
          <button
            type="submit"
            disabled={auth.isPending}
            onClick={() => {
              console.log("Sign in clicked", {
                mode,
                email,
                passwordProvided: Boolean(password),
              });
            }}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-ink font-semibold text-paper transition-all hover:bg-ink/90 active:scale-[0.98] disabled:opacity-60"
          >
            {auth.isPending ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
          </button>
          {auth.isError ? <p className="text-sm text-red-700">{auth.error.message}</p> : null}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              auth.reset();
            }}
            className="w-full py-2 text-sm text-muted-foreground underline underline-offset-4"
          >
            {mode === "login" ? "Create a new account" : "I already have an account"}
          </button>
        </form>
      </section>

      <div className="hidden justify-center lg:col-span-2 lg:flex">
        <div className="relative w-px bg-line">
          <span className="absolute top-1/4 -left-1.5 size-3 rotate-45 border border-ink bg-paper" />
          <span className="absolute bottom-1/4 -left-1.5 size-3 rotate-45 border border-ink bg-paper" />
        </div>
      </div>

      <section className="lg:col-span-5">
        <span className="eyebrow">Your account</span>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Your travel folders</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Create an account or sign in to load the travel folders where you are a member. Your
          profile and session are stored in the backend database.
        </p>
        <div className="mt-8 rounded-2xl border border-line p-6 text-sm text-muted-foreground">
          Demo accounts remain available only through the explicit demo API; they are not used by
          this login screen.
        </div>
      </section>
    </div>
  );
}
