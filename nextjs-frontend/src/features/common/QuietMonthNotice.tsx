"use client";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDate, formatMonth } from "@/lib/dates";
import { usePeriod } from "@/lib/period";
import { useDashboard } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Shown when the selected month has nothing recorded but older activity exists, so an empty
 * month reads as "nothing yet" rather than "AED 0 everywhere", with a one-click jump to the
 * latest month that has data.
 */
export function QuietMonthNotice({ empty, className }: { empty: boolean; className?: string }) {
  const { month, setMonth } = usePeriod();
  const dash = useDashboard();
  const latest = dash.data?.recentTransactions?.[0]?.date;
  if (!empty || !latest) return null;
  const latestMonth = latest.slice(0, 7);
  if (latestMonth >= month) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-container border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center md:px-5",
        className,
      )}
    >
      <span className="hidden size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-ink-2 sm:grid">
        <CalendarClock className="size-4" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-meta text-ink-2">
        <span className="font-medium text-ink">Nothing recorded in {formatMonth(month, true)} yet.</span> The latest
        transaction is from {formatDate(latest)}.
      </p>
      <Button variant="secondary" size="sm" className="self-start sm:self-auto" onClick={() => setMonth(latestMonth)}>
        View {formatMonth(latestMonth, true)}
      </Button>
    </div>
  );
}
