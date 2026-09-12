import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useSession, useSignOut } from "@/hooks/useSession";
import { Initial } from "@/components/ui-bits";

export function AppShell({
  subtitle,
  children,
}: {
  subtitle?: string;
  children: ReactNode;
}) {
  const { data: user } = useSession();
  const signOut = useSignOut();

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-ink selection:text-paper">
      <nav className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/events" className="flex items-center gap-3">
            <span className="size-5 shrink-0 rotate-45 bg-ink" aria-hidden="true" />
            <span className="font-mono text-sm font-bold tracking-tighter uppercase">
              Split Table <span className="font-normal text-muted-foreground">/ v1.0</span>
            </span>
          </Link>
          <div className="flex items-center gap-6">
            {subtitle ? (
              <span className="hidden font-mono text-[11px] tracking-widest text-muted-foreground uppercase sm:block">
                {subtitle}
              </span>
            ) : null}
            {user ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={signOut}
                  className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase transition-colors hover:text-ink"
                >
                  Sign out
                </button>
                <Initial user={user} tone="fill" />
              </div>
            ) : null}
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-6 py-12 lg:py-16">{children}</main>
      <footer className="mx-auto mt-12 max-w-7xl border-t border-line px-6 py-12">
        <div className="flex items-center gap-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          <span className="size-1.5 bg-ink/20" aria-hidden="true" />
          Deterministic settlement • Non-floating point
        </div>
      </footer>
    </div>
  );
}
