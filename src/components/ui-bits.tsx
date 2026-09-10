import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { CurrencyCode, User } from "@/domain/types";
import { formatMoney } from "@/domain/money";

export function Initial({
  user,
  size = "md",
  tone = "ink",
}: {
  user: Pick<User, "displayName">;
  size?: "sm" | "md" | "lg";
  tone?: "ink" | "fill";
}) {
  const sizes = { sm: "size-6 text-[10px]", md: "size-8 text-[11px]", lg: "size-10 text-xs" };
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg font-mono",
        sizes[size],
        tone === "ink" ? "bg-ink text-paper" : "border border-line bg-fill text-ink",
      )}
      aria-hidden="true"
    >
      {user.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

export function Amount({
  value,
  currency,
  signed = false,
  className,
}: {
  value: number;
  currency: CurrencyCode;
  signed?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("num", className)}>
      {formatMoney(value, currency, { signed })}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  backTo,
  backLabel,
  backParams,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  backTo?: string;
  backLabel?: string;
  backParams?: Record<string, string>;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        {backTo ? (
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            to={backTo as any}
            params={backParams}
            className="mb-2 inline-block font-mono text-[11px] text-muted-foreground transition-colors hover:text-ink"
          >
            ← {backLabel ?? "Back"}
          </Link>
        ) : null}
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <h1 className="text-4xl leading-[0.95] font-semibold tracking-tight text-balance lg:text-5xl">
          {title}
        </h1>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-line bg-paper", className)}>
      {children}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line px-6 py-10 text-center font-mono text-xs text-muted-foreground">
      {children}
    </p>
  );
}
