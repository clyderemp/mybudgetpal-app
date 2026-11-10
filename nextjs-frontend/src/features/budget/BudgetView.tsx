"use client";
import Link from "next/link";
import { Copy, PiggyBank, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { PeriodSelector } from "@/components/shell/PeriodSelector";
import {
  ActionButton,
  Badge,
  Button,
  buttonClasses,
  ConfirmDialog,
  EmptyState,
  InlineError,
  Money,
  PageHeader,
  Panel,
  ProgressBar,
  SkeletonList,
  StatBand,
  StatBandItem,
  notify,
  type Delta,
} from "@/components/ui";
import { addMonths, formatMonth } from "@/lib/dates";
import { formatFils, formatPercent } from "@/lib/money";
import { usePeriod } from "@/lib/period";
import { useBudget, useCategories, useCopyBudget } from "@/lib/queries";
import type { Budget, BudgetLine, CategoryGroup } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CategoryLabel } from "@/features/transactions/CategoryDot";
import { EditLimitsDialog } from "./EditLimitsDialog";
import { ZeroBasedPlanPanel } from "./ZeroBasedPlanPanel";
import { GROUP_LABEL, groupBy } from "./groups";

function txnHref(month: string, thisMonth: string, extra: Record<string, string>) {
  const p = new URLSearchParams(extra);
  if (month !== thisMonth) p.set("month", month);
  return `/transactions?${p.toString()}`;
}

function pctUsed(spent: number, limit: number) {
  if (limit <= 0) return spent > 0 ? "—" : "0%";
  return formatPercent(spent / limit);
}

export function BudgetView() {
  const period = usePeriod();
  const { month, thisMonth } = period;
  const lastMonth = addMonths(month, -1);

  const budgetQ = useBudget(month);
  const prevQ = useBudget(lastMonth);
  const categoriesQ = useCategories();
  const copyM = useCopyBudget(month);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmCopy, setConfirmCopy] = useState(false);

  const b = budgetQ.data;
  const hasLines = (b?.lines.length ?? 0) > 0;

  const doCopy = async () => {
    const res = await copyM.mutateAsync(lastMonth);
    if (res && Array.isArray(res.lines) && res.lines.length === 0)
      notify.info(`${formatMonth(lastMonth)} has no budget to copy`, "Set budgets for this month with Edit budget instead.");
    else notify.success(`Copied budgets from ${formatMonth(lastMonth)}`);
  };

  const copyButton = hasLines ? (
    <Button variant="secondary" onClick={() => setConfirmCopy(true)}>
      <Copy /> Copy last month
    </Button>
  ) : (
    <ActionButton variant="secondary" onAction={doCopy} errorMessage="Couldn't copy last month's budget">
      <Copy /> Copy last month
    </ActionButton>
  );

  const categoryById = new Map((categoriesQ.data ?? []).map((c) => [c.id, c]));

  let body;
  if (budgetQ.isPending) {
    body = (
      <div role="status" aria-label="Loading budget" className="flex flex-col gap-5">
        <BudgetBand loading />
        <Panel flush>
          <div className="h-9 border-b border-line bg-surface-2" />
          <SkeletonList rows={8} className="px-4" />
        </Panel>
      </div>
    );
  } else if (budgetQ.isError) {
    body = <InlineError error={budgetQ.error} onRetry={() => void budgetQ.refetch()} retrying={budgetQ.isFetching} title="Couldn't load budget" />;
  } else if (b) {
    const groups = groupBy(b.lines);
    const lineSpent = b.lines.reduce((s, l) => s + l.spentFils, 0);
    body = (
      <div className="flex flex-col gap-5">
        <ZeroBasedPlanPanel plan={b.plan} categories={categoriesQ.data ?? []} />
        <BudgetBand budget={b} prev={prevQ.data} lastMonthLabel={formatMonth(lastMonth)} />

        {b.unbudgetedSpentFils > 0 && hasLines ? (
          <div role="note" className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-container border border-line bg-surface px-4 py-2.5">
            <p className="min-w-0 flex-1 basis-60 text-meta text-ink">
              <Money fils={b.unbudgetedSpentFils} className="font-semibold" /> was spent in categories without a budget. Add budgets for them to keep the
              plan complete.
            </p>
            <div className="flex shrink-0 gap-2">
              <Link href={txnHref(month, thisMonth, { type: "expense" })} className={buttonClasses("ghost", "sm")}>
                View expenses
              </Link>
              <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                Edit budget
              </Button>
            </div>
          </div>
        ) : null}

        {hasLines ? (
          <>
            {/* Desktop table grouped by category group. */}
            <Panel flush className="hidden md:block">
              <table className="w-full table-fixed border-collapse text-sm">
                <caption className="sr-only">Budget for {formatMonth(month, true)} by category</caption>
                <colgroup>
                  <col />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr className="h-9 border-b border-line bg-surface-2 text-meta text-ink-2">
                    <th scope="col" className="px-4 text-left font-medium">
                      Category
                    </th>
                    <th scope="col" className="px-3 text-right font-medium">
                      Budgeted
                    </th>
                    <th scope="col" className="px-3 text-right font-medium">
                      Spent
                    </th>
                    <th scope="col" className="px-3 text-right font-medium">
                      Remaining
                    </th>
                    <th scope="col" className="px-4 text-left font-medium">
                      Used
                    </th>
                  </tr>
                </thead>
                {groups.map(([g, lines]) => (
                  <GroupRows key={g} group={g} lines={lines} month={month} thisMonth={thisMonth} categoryById={categoryById} />
                ))}
                <tfoot>
                  <tr className="h-10 border-t border-line-strong bg-surface-2 font-semibold">
                    <th scope="row" className="px-4 text-left text-ink">
                      Total budgeted categories
                    </th>
                    <td className="px-3 text-right">
                      <Money fils={b.totalLimitFils} />
                    </td>
                    <td className="px-3 text-right">
                      <Money fils={lineSpent} />
                    </td>
                    <td className="px-3 text-right">
                      <Money fils={b.totalLimitFils - lineSpent} tone={b.totalLimitFils - lineSpent < 0 ? "danger" : undefined} />
                    </td>
                    <td className="px-4">
                      <UsedCell spent={lineSpent} limit={b.totalLimitFils} label="Total budget used" />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Panel>

            {/* Phones: list rows per group. */}
            <div className="flex flex-col gap-4 md:hidden">
              {groups.map(([g, lines]) => {
                const limit = lines.reduce((s, l) => s + l.limitFils, 0);
                const spent = lines.reduce((s, l) => s + l.spentFils, 0);
                return (
                  <section key={g} aria-label={GROUP_LABEL[g]} className="overflow-hidden rounded-container border border-line bg-surface">
                    <div className="flex h-9 items-center justify-between gap-3 border-b border-line bg-surface-2 px-4">
                      <h2 className="truncate text-meta font-semibold text-ink">{GROUP_LABEL[g]}</h2>
                      <span className="tabular shrink-0 text-xs text-ink-2">
                        <Money fils={spent} noDecimals className={cn("font-semibold", spent > limit && "text-danger")} /> of{" "}
                        <Money fils={limit} noDecimals tone="muted" />
                      </span>
                    </div>
                    <ul className="divide-y divide-line">
                      {lines.map((l) => {
                        const over = l.remainingFils < 0;
                        return (
                          <li key={l.categoryId}>
                            <Link
                              href={txnHref(month, thisMonth, { categoryId: l.categoryId })}
                              className="block px-4 py-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                            >
                              <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3">
                                <CategoryLabel category={categoryById.get(l.categoryId) ?? { id: l.categoryId }} label={l.categoryName} className="text-sm font-medium text-ink" />
                                <span className="shrink-0 text-meta">
                                  <Money fils={l.spentFils} noDecimals className={cn("font-semibold", over && "text-danger")} />
                                  <span className="text-ink-2"> of </span>
                                  <Money fils={l.limitFils} noDecimals tone="muted" />
                                </span>
                              </div>
                              <ProgressBar value={l.spentFils} max={l.limitFils} label={`${l.categoryName} budget used`} />
                              <p className={cn("mt-1 text-xs", over ? "font-medium text-danger" : "text-ink-2")}>
                                <Money fils={Math.abs(l.remainingFils)} tone={over ? "danger" : "muted"} /> {over ? "over budget" : "left"}
                              </p>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </>
        ) : (
          <Panel>
            <EmptyState
              icon={PiggyBank}
              title={`No budget for ${formatMonth(month, true)}`}
              description="Set a monthly amount for each category, or start from last month's budget."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setEditOpen(true)}>
                    <SlidersHorizontal /> Set up budget
                  </Button>
                  {copyButton}
                </div>
              }
            />
          </Panel>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Budget"
        description={`Monthly spending plan for ${formatMonth(month, true)}.`}
        actions={
          <>
            <PeriodSelector className="md:hidden" />
            {hasLines ? (
              <>
                {copyButton}
                <Button onClick={() => setEditOpen(true)}>
                  <SlidersHorizontal /> Edit budget
                </Button>
              </>
            ) : null}
          </>
        }
      />
      {body}
      <EditLimitsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        month={month}
        budget={b}
        previous={prevQ.data}
        categories={categoriesQ.data ?? []}
      />
      <ConfirmDialog
        open={confirmCopy}
        onOpenChange={setConfirmCopy}
        danger={false}
        title={`Copy budgets from ${formatMonth(lastMonth)}?`}
        description={`This replaces the budgets you've set for ${formatMonth(month)}.`}
        confirmLabel="Copy last month"
        onConfirm={doCopy}
      />
    </>
  );
}

function BudgetBand({
  budget: b,
  prev,
  lastMonthLabel,
  loading,
}: {
  budget?: Budget;
  prev?: Budget;
  lastMonthLabel?: string;
  loading?: boolean;
}) {
  if (loading || !b) {
    return (
      <StatBand aria-label="Month summary" className="xl:grid-cols-5">
        {["Income", "Budgeted", "Spent", "Remaining", "Unbudgeted"].map((l) => (
          <StatBandItem key={l} label={l} value="" loading />
        ))}
      </StatBand>
    );
  }
  const lineSpent = b.lines.reduce((s, l) => s + l.spentFils, 0);
  const remaining = b.totalLimitFils - lineSpent;
  let spentDelta: Delta | undefined;
  if (prev && prev.totalSpentFils > 0) {
    const ratio = (b.totalSpentFils - prev.totalSpentFils) / prev.totalSpentFils;
    spentDelta = {
      label: `${ratio > 0 ? "+" : ratio < 0 ? "−" : ""}${formatPercent(Math.abs(ratio))}`,
      direction: Math.abs(ratio) < 0.005 ? "flat" : ratio > 0 ? "up" : "down",
      tone: "neutral",
      context: `vs ${lastMonthLabel}`,
    };
  }
  return (
    <StatBand aria-label="Month summary" className="xl:grid-cols-5">
      <StatBandItem label="Income" value={formatFils(b.incomeFils, "AED", { noDecimals: true })} hint="Recorded this month" />
      <StatBandItem
        label="Budgeted"
        value={formatFils(b.totalLimitFils, "AED", { noDecimals: true })}
        hint={
          b.totalLimitFils <= 0
            ? "No limits set"
            : b.incomeFils > 0
              ? `${formatPercent(b.totalLimitFils / b.incomeFils)} of income`
              : "Across all categories"
        }
      />
      <StatBandItem label="Spent" value={formatFils(b.totalSpentFils, "AED", { noDecimals: true })} delta={spentDelta} hint={spentDelta ? undefined : "All expenses"} />
      <StatBandItem
        label={remaining < 0 ? "Over budget" : "Remaining"}
        value={formatFils(Math.abs(remaining), "AED", { noDecimals: true })}
        tone={remaining < 0 ? "negative" : "neutral"}
        hint={b.totalLimitFils > 0 ? `${pctUsed(lineSpent, b.totalLimitFils)} of budget used` : "No budget set"}
      />
      <StatBandItem
        label="Unbudgeted"
        value={formatFils(b.unbudgetedSpentFils, "AED", { noDecimals: true })}
        tone={b.unbudgetedSpentFils > 0 ? "warning" : "neutral"}
        hint="Spent outside any budget"
      />
    </StatBand>
  );
}

function GroupRows({
  group,
  lines,
  month,
  thisMonth,
  categoryById,
}: {
  group: CategoryGroup;
  lines: BudgetLine[];
  month: string;
  thisMonth: string;
  categoryById: Map<string, { id: string; color?: string | null }>;
}) {
  const limit = lines.reduce((s, l) => s + l.limitFils, 0);
  const spent = lines.reduce((s, l) => s + l.spentFils, 0);
  const rem = limit - spent;
  return (
    <tbody className="border-b border-line last:border-b-0">
      <tr className="h-9 border-b border-line">
        <th scope="rowgroup" className="px-4 text-left font-semibold text-ink">
          {GROUP_LABEL[group]}
        </th>
        <td className="px-3 text-right font-semibold">
          <Money fils={limit} />
        </td>
        <td className="px-3 text-right font-semibold">
          <Money fils={spent} />
        </td>
        <td className="px-3 text-right font-semibold">
          <Money fils={rem} tone={rem < 0 ? "danger" : undefined} />
        </td>
        <td className="px-4">
          <UsedCell spent={spent} limit={limit} label={`${GROUP_LABEL[group]} budget used`} />
        </td>
      </tr>
      {lines.map((l) => {
        const over = l.remainingFils < 0;
        return (
          <tr key={l.categoryId} className="relative h-10 border-b border-line last:border-b-0 hover:bg-surface-2">
            <td className="px-4 pl-8">
              <div className="flex min-w-0 items-center gap-2">
                <Link
                  href={txnHref(month, thisMonth, { categoryId: l.categoryId })}
                  className="min-w-0 text-ink after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
                  aria-label={`${l.categoryName}, view transactions`}
                >
                  <CategoryLabel category={categoryById.get(l.categoryId) ?? { id: l.categoryId }} label={l.categoryName} />
                </Link>
                {over ? <Badge tone="danger">Over</Badge> : null}
              </div>
            </td>
            <td className="px-3 text-right">
              <Money fils={l.limitFils} />
            </td>
            <td className="px-3 text-right">
              <Money fils={l.spentFils} tone={over ? "danger" : undefined} />
            </td>
            <td className="px-3 text-right">
              <Money fils={l.remainingFils} tone={over ? "danger" : undefined} />
            </td>
            <td className="px-4">
              <UsedCell spent={l.spentFils} limit={l.limitFils} label={`${l.categoryName} budget used`} />
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}

function UsedCell({ spent, limit, label }: { spent: number; limit: number; label: string }) {
  const over = limit > 0 ? spent > limit : spent > 0;
  return (
    <div className="flex items-center gap-3">
      <ProgressBar value={spent} max={limit} label={label} className="flex-1" />
      <span className={cn("tabular w-11 shrink-0 text-right text-meta", over ? "font-medium text-danger" : "text-ink-2")}>{pctUsed(spent, limit)}</span>
    </div>
  );
}
