"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./Skeleton";
import { Sparkline } from "./Sparkline";
import { DeltaText, toneText, type Delta, type Tone } from "./StatTile";

/**
 * Dashboard "statement band": ONE full-width panel split by 1px vertical rules into KPI
 * columns (Income | Expenses | Net | Savings rate). 4 columns ≥1280px, a 2×2 grid below that
 * (phones included; figures step down to 20px and the sparkline drops under the delta).
 */
export function StatBand({ children, className, "aria-label": ariaLabel }: { children: ReactNode; className?: string; "aria-label"?: string }) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "grid min-w-0 grid-cols-2 overflow-hidden rounded-container border border-line bg-surface xl:grid-cols-4",
        // rules: 2-col → left border on even + top border from row 2; 4/5-col → left borders only
        "[&>*]:border-line [&>*:nth-child(even)]:border-l [&>*:nth-child(n+3)]:border-t [&>*:last-child:nth-child(odd)]:col-span-2 xl:[&>*:last-child:nth-child(odd)]:col-span-1 xl:[&>*]:border-t-0 xl:[&>*+*]:border-l",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function StatBandItem({
  label,
  value,
  delta,
  hint,
  spark,
  sparkTone = "ink",
  sparkLabel,
  tone = "neutral",
  loading,
}: {
  label: ReactNode;
  /** Pre-formatted figure (use formatFils / percent). */
  value: ReactNode;
  delta?: Delta;
  hint?: ReactNode;
  /** 6-month series (oldest → newest). */
  spark?: number[];
  sparkTone?: "ink" | "accent" | "danger" | "muted";
  sparkLabel?: string;
  /** Colours the figure; "negative" only for overspend/debt. */
  tone?: Tone;
  loading?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 py-3 sm:px-5 sm:py-4">
      <p className="truncate text-meta font-medium text-ink-2">{label}</p>
      {loading ? (
        <Skeleton className="my-1 h-7 w-36" />
      ) : (
        <p className={cn("tabular truncate text-xl font-semibold sm:text-kpi", tone === "neutral" ? "text-ink" : toneText[tone])}>{value}</p>
      )}
      <div className="flex min-h-8 flex-col items-stretch gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <div className="min-w-0 pb-0.5">
          {loading ? <Skeleton className="h-3 w-24" /> : delta ? <DeltaText delta={delta} /> : null}
          {hint && !loading ? <p className="truncate text-xs text-ink-2">{hint}</p> : null}
        </div>
        {spark && !loading ? <Sparkline data={spark} tone={sparkTone} label={sparkLabel} className="h-6 w-full shrink-0 sm:h-8 sm:w-24" /> : null}
      </div>
    </div>
  );
}
