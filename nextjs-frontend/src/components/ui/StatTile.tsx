import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./Skeleton";

/** positive = accent, negative = danger (overspend/debt only), warning = warn, neutral = ink-2. */
export type Tone = "neutral" | "positive" | "negative" | "warning";

export const toneText: Record<Tone, string> = {
  neutral: "text-ink-2",
  positive: "text-accent",
  negative: "text-danger",
  warning: "text-warn",
};

export interface Delta {
  /** e.g. "+12.4%" or "AED 1,200". */
  label: ReactNode;
  tone?: Tone;
  /** Arrow direction; omit for no arrow. */
  direction?: "up" | "down" | "flat";
  /** Trailing comparison text, e.g. "vs Oct". */
  context?: ReactNode;
}

export function DeltaText({ delta, className }: { delta: Delta; className?: string }) {
  const Arrow = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : delta.direction === "flat" ? Minus : null;
  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-xs", className)}>
      <span className={cn("tabular inline-flex items-center gap-0.5 font-medium whitespace-nowrap", toneText[delta.tone ?? "neutral"])}>
        {Arrow ? <Arrow className="size-3.5" aria-hidden /> : null}
        {delta.label}
      </span>
      {delta.context ? <span className="min-w-0 truncate text-ink-2">{delta.context}</span> : null}
    </span>
  );
}

/** Single KPI in its own panel. For the dashboard headline use <StatBand>. */
export function StatTile({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  tone = "neutral",
  loading,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  delta?: Delta;
  icon?: LucideIcon;
  /** Colours the value (use "negative" only for overspend/debt). */
  tone?: Tone;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-container border border-line bg-surface p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-meta text-ink-2">{label}</p>
        {Icon ? <Icon className="size-4 shrink-0 text-ink-3" aria-hidden /> : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : (
        <p className={cn("tabular mt-1 truncate text-2xl font-semibold", tone === "neutral" ? "text-ink" : toneText[tone])}>{value}</p>
      )}
      {delta ? <DeltaText delta={delta} className="mt-1" /> : null}
      {hint ? <p className="mt-1 truncate text-xs text-ink-2">{hint}</p> : null}
    </div>
  );
}
