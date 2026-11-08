"use client";
import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { EmptyState, Money, Panel, ProgressBar, SkeletonList, InlineError, buttonClasses } from "@/components/ui";
import { formatFils } from "@/lib/money";
import type { Budget } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROWS = 6;

function usage(spent: number, limit: number) {
  return limit > 0 ? spent / limit : spent > 0 ? Infinity : 0;
}

/** Top budget categories for the month as compact rows: name, thin bar, spent / limit. */
export function BudgetPanel({
  budget,
  loading,
  error,
  onRetry,
  month,
  className,
}: {
  budget?: Budget;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  month: string;
  className?: string;
}) {
  const href = `/budget?month=${month}`;
  const lines = budget
    ? [...budget.lines]
        .filter((l) => l.limitFils > 0 || l.spentFils > 0)
        .sort((a, b) => usage(b.spentFils, b.limitFils) - usage(a.spentFils, a.limitFils) || b.spentFils - a.spentFils)
        .slice(0, ROWS)
    : [];
  const overall = budget && budget.totalLimitFils > 0 ? usage(budget.totalSpentFils, budget.totalLimitFils) : null;

  return (
    <Panel
      className={className}
      title="Budget"
      description={
        budget && budget.totalLimitFils > 0 ? (
          <span className="tabular">
            {formatFils(budget.totalSpentFils, "AED", { noDecimals: true })} of {formatFils(budget.totalLimitFils, "AED", { noDecimals: true })} spent
          </span>
        ) : undefined
      }
      actions={
        <Link href={href} className={buttonClasses("ghost", "sm")}>
          Open budget
        </Link>
      }
      flush
    >
      {loading ? (
        <SkeletonList rows={6} className="px-4 md:px-5" />
      ) : error ? (
        <InlineError className="m-4 border-0 p-0" error={error} onRetry={onRetry} title="Couldn't load the budget" />
      ) : lines.length === 0 ? (
        <EmptyState
          className="py-8"
          icon={PiggyBank}
          title="No budget for this month"
          description="Set monthly limits per category to see how spending is tracking."
          action={
            <Link href={href} className={buttonClasses("secondary", "sm")}>
              Set up budget
            </Link>
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {lines.map((l) => {
              const ratio = usage(l.spentFils, l.limitFils);
              const over = ratio > 1;
              return (
                <li key={l.categoryId} className="flex flex-col justify-center gap-1.5 px-4 py-2.5 md:px-5">
                  <div className="flex items-baseline justify-between gap-3 text-meta">
                    <span className="min-w-0 truncate text-ink">{l.categoryName}</span>
                    <span className="tabular shrink-0 whitespace-nowrap">
                      <Money fils={l.spentFils} noDecimals hideCurrency tone={over ? "danger" : undefined} className="font-medium" />
                      <span className="text-ink-2"> / {l.limitFils > 0 ? formatFils(l.limitFils, "AED", { noDecimals: true, hideCurrency: true }) : "No limit"}</span>
                    </span>
                  </div>
                  <ProgressBar size="sm" value={l.spentFils} max={l.limitFils} label={`${l.categoryName}: budget used`} />
                  {over && l.limitFils > 0 ? (
                    <p className="tabular text-xs text-danger">Over by {formatFils(l.spentFils - l.limitFils, "AED", { noDecimals: true })}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {overall !== null || (budget?.unbudgetedSpentFils ?? 0) > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-surface-2 px-4 py-2 text-xs text-ink-2 md:px-5">
              {overall !== null ? (
                <span className={cn("tabular", overall > 1 && "text-danger")}>{Math.round(overall * 100)}% of total budget used</span>
              ) : (
                <span />
              )}
              {budget && budget.unbudgetedSpentFils > 0 ? (
                <span className="tabular">Unbudgeted {formatFils(budget.unbudgetedSpentFils, "AED", { noDecimals: true })}</span>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}
