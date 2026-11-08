import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Quiet totals row: one panel split by 1px rules. Smaller than the dashboard band on purpose
 * (no sparklines, 24px figures). Stacks to 1 column below 640px.
 */
export function SummaryStrip({ label, items }: { label: string; items: { label: string; value: ReactNode; hint?: ReactNode }[] }) {
  return (
    <section aria-label={label} className="min-w-0 overflow-hidden rounded-container border border-line bg-surface">
      <dl className={cn("grid grid-cols-1", items.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        {items.map((it) => (
          <div key={it.label} className="flex min-w-0 flex-col gap-0.5 border-line px-4 py-3 not-first:border-t sm:not-first:border-t-0 sm:not-first:border-l md:px-5">
            <dt className="truncate text-meta text-ink-2">{it.label}</dt>
            <dd className="tabular truncate text-2xl font-semibold text-ink">{it.value}</dd>
            {it.hint ? <dd className="truncate text-xs text-ink-2">{it.hint}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
