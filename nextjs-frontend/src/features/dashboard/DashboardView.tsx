"use client";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { EmptyState, InlineError, PageHeader, Panel, Skeleton, buttonClasses } from "@/components/ui";
import { PeriodSelector } from "@/components/shell/PeriodSelector";
import { QuietMonthNotice } from "@/features/common/QuietMonthNotice";
import { formatMonth } from "@/lib/dates";
import { usePeriod } from "@/lib/period";
import { useBudget, useCategories, useDashboard, useInsightsSummary, useInsightsTrends, useTransactions } from "@/lib/queries";
import { BudgetPanel } from "./BudgetPanel";
import { CashFlowChart } from "./CashFlowChart";
import { MonthStatBand } from "./MonthStatBand";
import { RecentTransactionsPanel } from "./RecentTransactionsPanel";
import { AccountsPanel, HealthPanel, UpcomingPaymentsPanel } from "./SidePanels";

export function DashboardView() {
  const { month, isCurrent, range } = usePeriod();
  const dash = useDashboard();
  const summary = useInsightsSummary(month);
  const trends = useInsightsTrends(12, month);
  const budget = useBudget(month);
  const categories = useCategories();
  // The dashboard endpoint returns the latest 10 overall; for a past month list that month's latest.
  const monthTxns = useTransactions({ from: range[0], to: range[1], pageSize: 10, sort: "-date" }, { enabled: !isCurrent });

  const label = formatMonth(month, true);
  const hasTrend = (trends.data ?? []).some((p) => p.incomeFils || p.expenseFils);
  const recent = isCurrent
    ? { items: dash.data?.recentTransactions ?? [], loading: dash.isPending, error: dash.error, retry: () => dash.refetch() }
    : { items: monthTxns.data?.items ?? [], loading: monthTxns.isPending, error: monthTxns.error, retry: () => monthTxns.refetch() };

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={isCurrent ? `${label}, month to date` : label}
        actions={<PeriodSelector className="md:hidden" />}
      />

      <div className="flex flex-col gap-4 lg:gap-5">
        <QuietMonthNotice empty={Boolean(summary.data && !summary.data.incomeFils && !summary.data.expenseFils)} />
        {summary.isError ? (
          <InlineError error={summary.error} onRetry={() => summary.refetch()} title={`Couldn't load the summary for ${label}`} />
        ) : (
          <MonthStatBand month={month} summary={summary.data} trends={trends.data} loading={summary.isPending} />
        )}

        <div className="grid min-w-0 gap-4 lg:gap-5 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Cash flow"
            description="Monthly totals, up to 12 months"
            actions={
              <Link href={`/insights${isCurrent ? "" : `?month=${month}`}`} className={buttonClasses("ghost", "sm")}>
                Open insights
              </Link>
            }
          >
            {trends.isPending ? (
              <Skeleton className="h-[300px] w-full" />
            ) : trends.isError ? (
              <InlineError className="border-0 p-0" error={trends.error} onRetry={() => trends.refetch()} title="Couldn't load cash flow" />
            ) : !hasTrend ? (
              <EmptyState icon={BarChart3} title="No history yet" description="Record income and expenses and your monthly cash flow appears here." />
            ) : (
              <CashFlowChart points={trends.data} height={260} />
            )}
          </Panel>
          <BudgetPanel
            month={month}
            budget={budget.data}
            loading={budget.isPending}
            error={budget.isError ? budget.error : undefined}
            onRetry={() => budget.refetch()}
          />
        </div>

        <div className="grid min-w-0 items-start gap-4 lg:gap-5 xl:grid-cols-3">
          <RecentTransactionsPanel
            className="xl:col-span-2"
            title={isCurrent ? "Recent transactions" : `Latest transactions in ${label}`}
            viewAllHref={isCurrent ? "/transactions" : `/transactions?month=${month}`}
            items={recent.items}
            categories={categories.data ?? []}
            accounts={dash.data?.accounts ?? []}
            loading={recent.loading}
            error={recent.error ?? undefined}
            onRetry={recent.retry}
          />
          <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
            {dash.isPending ? (
              <>
                <Skeleton className="h-40 w-full rounded-container" />
                <Skeleton className="h-56 w-full rounded-container" />
                <Skeleton className="h-48 w-full rounded-container" />
              </>
            ) : dash.isError ? (
              <InlineError error={dash.error} onRetry={() => dash.refetch()} title="Couldn't load payments, health and accounts" />
            ) : (
              <>
                <UpcomingPaymentsPanel items={dash.data.upcomingDebtPayments} />
                <HealthPanel health={dash.data.health} />
                <AccountsPanel accounts={dash.data.accounts} />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
