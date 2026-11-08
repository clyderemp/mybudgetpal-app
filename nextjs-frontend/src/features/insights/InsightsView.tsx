"use client";
import { BarChart3 } from "lucide-react";
import { EmptyState, InlineError, PageHeader, Panel, Skeleton } from "@/components/ui";
import { PeriodSelector } from "@/components/shell/PeriodSelector";
import { CashFlowChart } from "@/features/dashboard/CashFlowChart";
import { MonthStatBand } from "@/features/dashboard/MonthStatBand";
import { addMonths, formatMonth } from "@/lib/dates";
import { usePeriod } from "@/lib/period";
import {
  useCategories,
  useInsightsAnomalies,
  useInsightsForecast,
  useInsightsHealth,
  useInsightsSummary,
  useInsightsTrends,
} from "@/lib/queries";
import { AnomaliesPanel, CategoryBreakdownPanel, ForecastPanel, HealthBreakdownPanel } from "./panels";

export function InsightsView() {
  const { month } = usePeriod();
  const summary = useInsightsSummary(month);
  const trends = useInsightsTrends(12);
  const forecast = useInsightsForecast();
  // Forecast uses history up to last month; compare against that month's actuals.
  const lastMonth = useInsightsSummary(forecast.data ? addMonths(forecast.data.month, -2) : "");
  const anomalies = useInsightsAnomalies(month);
  const health = useInsightsHealth();
  const categories = useCategories();
  const cats = categories.data ?? [];
  const label = formatMonth(month, true);
  const hasTrend = (trends.data ?? []).some((p) => p.incomeFils || p.expenseFils);

  return (
    <>
      <PageHeader title="Insights" description={label} actions={<PeriodSelector className="md:hidden" />} />

      <div className="flex flex-col gap-4 lg:gap-5">
        {summary.isError ? (
          <InlineError error={summary.error} onRetry={() => summary.refetch()} title={`Couldn't load the summary for ${label}`} />
        ) : (
          <MonthStatBand month={month} summary={summary.data} trends={trends.data} loading={summary.isPending} />
        )}

        <Panel title="Income, expenses and net" description="Monthly totals, up to 12 months">
          {trends.isPending ? (
            <Skeleton className="h-[340px] w-full" />
          ) : trends.isError ? (
            <InlineError className="border-0 p-0" error={trends.error} onRetry={() => trends.refetch()} title="Couldn't load monthly trends" />
          ) : !hasTrend ? (
            <EmptyState icon={BarChart3} title="No history yet" description="Record income and expenses and your monthly trend appears here." />
          ) : (
            <CashFlowChart points={trends.data} height={300} />
          )}
        </Panel>

        <div className="grid min-w-0 items-start gap-4 lg:gap-5 xl:grid-cols-2">
          <CategoryBreakdownPanel
            month={month}
            items={summary.data?.byCategory}
            categories={cats}
            loading={summary.isPending}
            error={summary.isError ? summary.error : undefined}
            onRetry={() => summary.refetch()}
          />
          <ForecastPanel
            forecast={forecast.data}
            lastMonth={lastMonth.data}
            categories={cats}
            loading={forecast.isPending}
            error={forecast.isError ? forecast.error : undefined}
            onRetry={() => forecast.refetch()}
          />
        </div>

        <div className="grid min-w-0 items-start gap-4 lg:gap-5 xl:grid-cols-2">
          <AnomaliesPanel
            month={month}
            items={anomalies.data}
            categories={cats}
            loading={anomalies.isPending}
            error={anomalies.isError ? anomalies.error : undefined}
            onRetry={() => anomalies.refetch()}
          />
          <HealthBreakdownPanel
            health={health.data}
            loading={health.isPending}
            error={health.isError ? health.error : undefined}
            onRetry={() => health.refetch()}
          />
        </div>
      </div>
    </>
  );
}
