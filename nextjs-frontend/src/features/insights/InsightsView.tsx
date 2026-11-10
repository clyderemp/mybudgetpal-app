"use client";
import {
  BarChart3,
  CalendarDays,
  PieChart as PieIcon,
  Sparkles,
  Store,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  Dropdown,
  EmptyState,
  InlineError,
  Money,
  PageHeader,
  Panel,
  SegmentedControl,
  Skeleton,
  StatBand,
  StatBandItem,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type Delta,
} from "@/components/ui";
import {
  addMonths,
  currentMonth,
  formatDate,
  monthRange,
  todayISO,
} from "@/lib/dates";
import { formatFils, formatPercent } from "@/lib/money";
import {
  useCategories,
  useInsightsAnomalies,
  useInsightsExplore,
  useInsightsForecast,
  useInsightsHealth,
  useInsightsSummary,
} from "@/lib/queries";
import type {
  Confidence,
  ExploreGranularity,
  ExploreGroupBy,
  ExploreResult,
  ExploreTotals,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  BreakdownChart,
  CalendarHeatmap,
  ForecastChart,
  periodLabel,
  TrendChart,
  WeekdayChart,
  type BreakdownMode,
  type TrendMode,
} from "./charts";
import { FilterBar } from "./FilterBar";
import {
  useExploreFilters,
  type ExploreFilters,
  type InsightsView as View,
} from "./filters";
import { AnomaliesPanel, ForecastPanel, HealthBreakdownPanel } from "./panels";

const VIEW_LABELS: Record<View, string> = {
  overview: "Overview",
  trends: "Trends",
  breakdown: "Breakdown",
  patterns: "Patterns",
  forecast: "Forecast",
  health: "Health",
};

const INTERVALS = [
  { value: "auto", label: "Auto interval" },
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

const GROUP_OPTIONS: { value: ExploreGroupBy; label: string }[] = [
  { value: "category", label: "Category" },
  { value: "group", label: "Category group" },
  { value: "account", label: "Account" },
  { value: "member", label: "Person" },
  { value: "merchant", label: "Merchant" },
  { value: "weekday", label: "Day of week" },
];

export function InsightsView() {
  const f = useExploreFilters();
  const q = useInsightsExplore(f.params);
  const data = q.data;
  const flowWord = f.flow === "income" ? "income" : "spending";

  return (
    <>
      <PageHeader
        title="Insights"
        description="Filter by date, category, account, person or merchant, then switch views."
      />
      <div className="mb-4">
        <FilterBar f={f} />
      </div>

      <Tabs
        value={f.view}
        onValueChange={(v) => f.set({ view: v === "overview" ? null : v })}
      >
        <TabsList aria-label="Insights views" className="mb-4">
          {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
            <TabsTrigger key={v} value={v}>
              {VIEW_LABELS[v]}
            </TabsTrigger>
          ))}
        </TabsList>

        {q.isError && !data ? (
          <InlineError
            error={q.error}
            onRetry={() => q.refetch()}
            title="Couldn't load insights"
          />
        ) : (
          <div
            className={cn(
              "transition-opacity",
              q.isPlaceholderData && "opacity-60",
            )}
            aria-busy={q.isFetching}
          >
            <TabsContent value="overview">
              <Overview f={f} data={data} />
            </TabsContent>
            <TabsContent value="trends">
              <Trends f={f} data={data} />
            </TabsContent>
            <TabsContent value="breakdown">
              <Breakdown f={f} data={data} />
            </TabsContent>
            <TabsContent value="patterns">
              <Patterns f={f} data={data} flowWord={flowWord} />
            </TabsContent>
            <TabsContent value="forecast">
              <ForecastView f={f} />
            </TabsContent>
            <TabsContent value="health">
              <HealthView to={f.to} />
            </TabsContent>
          </div>
        )}
      </Tabs>
    </>
  );
}

/* ---------------- helpers ---------------- */

function pctDelta(
  cur: number,
  prev: number,
  goodWhenUp: boolean,
): Delta | undefined {
  if (!prev) return undefined;
  const r = (cur - prev) / prev;
  const flat = Math.abs(r) < 0.005;
  return {
    label: `${r > 0 ? "+" : ""}${formatPercent(r, Math.abs(r) < 0.1 ? 1 : 0)}`,
    direction: flat ? "flat" : r > 0 ? "up" : "down",
    tone: flat ? "neutral" : r > 0 === goodWhenUp ? "positive" : "warning",
    context: "vs previous period",
  };
}

const aed = (v: number) => formatFils(v, "AED", { noDecimals: true });

function KpiBand({
  t,
  p,
  loading,
}: {
  t?: ExploreTotals;
  p?: ExploreTotals;
  loading: boolean;
}) {
  return (
    <StatBand aria-label="Totals for the selected range">
      <StatBandItem
        label="Spending"
        value={t ? aed(t.expenseFils) : "—"}
        loading={loading}
        delta={
          t && p ? pctDelta(t.expenseFils, p.expenseFils, false) : undefined
        }
        hint={t ? `${t.expenseCount} expenses` : undefined}
      />
      <StatBandItem
        label="Income"
        value={t ? aed(t.incomeFils) : "—"}
        loading={loading}
        delta={t && p ? pctDelta(t.incomeFils, p.incomeFils, true) : undefined}
      />
      <StatBandItem
        label="Net"
        value={
          t
            ? formatFils(t.netFils, "AED", {
                noDecimals: true,
                signed: true,
              }).replace(/^-/, "−")
            : "—"
        }
        tone={t && t.netFils < 0 ? "negative" : "neutral"}
        loading={loading}
        hint={
          t?.savingsRate == null
            ? undefined
            : t.savingsRate >= 0
              ? `Saved ${formatPercent(t.savingsRate)} of income`
              : `Spent ${formatPercent(-t.savingsRate)} more than income`
        }
      />
      <StatBandItem
        label="Average spend per day"
        value={t ? aed(t.avgDailyExpenseFils) : "—"}
        loading={loading}
        delta={
          t && p
            ? pctDelta(t.avgDailyExpenseFils, p.avgDailyExpenseFils, false)
            : undefined
        }
        hint={
          t?.expenseCount
            ? `Typical expense ${aed(t.avgExpenseFils)}`
            : undefined
        }
      />
    </StatBand>
  );
}

function Loading({ h = 300 }: { h?: number }) {
  return (
    <div style={{ height: h }}>
      <Skeleton className="h-full w-full" />
    </div>
  );
}

function Empty({
  what = "No transactions match these filters",
}: {
  what?: string;
}) {
  return (
    <EmptyState
      className="py-10"
      icon={BarChart3}
      title={what}
      description="Try a longer date range or remove a filter."
    />
  );
}

const hasAny = (d?: ExploreResult) => Boolean(d && d.totals.count > 0);

/* ---------------- Overview ---------------- */

function Overview({ f, data }: { f: ExploreFilters; data?: ExploreResult }) {
  const loading = !data;
  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <KpiBand t={data?.totals} p={data?.previous} loading={loading} />
      <div className="grid min-w-0 items-start gap-4 lg:gap-5 xl:grid-cols-[3fr_2fr]">
        <Panel
          title="Income and spending"
          description={
            data ? `${intervalWord(data.granularity)} totals` : undefined
          }
          actions={
            <LinkButton onClick={() => f.set({ view: "trends" })}>
              More trends
            </LinkButton>
          }
        >
          {loading ? (
            <Loading />
          ) : hasAny(data) ? (
            <TrendChart data={data!} mode="bars" compare={false} height={280} />
          ) : (
            <Empty />
          )}
        </Panel>
        <Panel
          title={
            f.flow === "income" ? "Income by category" : "Spending by category"
          }
          actions={
            <LinkButton onClick={() => f.set({ view: "breakdown" })}>
              Break down
            </LinkButton>
          }
        >
          {loading ? (
            <Loading h={280} />
          ) : data!.breakdown.length && f.groupBy === "category" ? (
            <>
              <BreakdownChart
                items={data!.breakdown}
                mode="donut"
                total={flowTotal(data!)}
                flow={f.flow}
                height={240}
                onSelect={(k) => f.set({ cat: [k] })}
              />
              <TopList
                rows={data!.breakdown
                  .slice(0, 5)
                  .map((b) => ({
                    key: b.key,
                    label: b.label,
                    fils: b.fils,
                    share: b.share,
                  }))}
              />
            </>
          ) : data!.breakdown.length ? (
            <>
              <BreakdownChart
                items={data!.breakdown}
                mode="donut"
                total={flowTotal(data!)}
                flow={f.flow}
                height={240}
              />
              <TopList
                rows={data!.breakdown
                  .slice(0, 5)
                  .map((b) => ({
                    key: b.key,
                    label: b.label,
                    fils: b.fils,
                    share: b.share,
                  }))}
              />
            </>
          ) : (
            <Empty />
          )}
        </Panel>
      </div>
      <div className={cn("grid min-w-0 items-start gap-4 lg:gap-5", (!data || data.pace) && "xl:grid-cols-2")}>
        {!data || data.pace ? <PacePanel data={data} onMore={() => f.set({ view: "forecast" })} /> : null}
        <Panel title="Top merchants" flush>
          {loading ? (
            <div className="p-4">
              <Loading h={200} />
            </div>
          ) : data!.topMerchants.length ? (
            <ul className="divide-y divide-line">
              {data!.topMerchants.slice(0, 6).map((m) => (
                <li key={m.merchant}>
                  <button
                    type="button"
                    onClick={() => f.set({ q: m.merchant })}
                    className="flex h-11 w-full items-center gap-3 px-4 text-left text-meta hover:bg-surface-2 md:px-5"
                  >
                    <Store className="size-4 shrink-0 text-ink-3" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {m.merchant}
                    </span>
                    <span className="tabular text-xs text-ink-2">
                      {m.count}×
                    </span>
                    <Money
                      fils={m.fils}
                      noDecimals
                      hideCurrency
                      className="font-medium"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              className="py-10"
              icon={Store}
              title="No merchants recorded"
              description="Add a merchant when you record a transaction, or scan a receipt."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function flowTotal(d: ExploreResult) {
  return d.flow === "income" ? d.totals.incomeFils : d.totals.expenseFils;
}

function intervalWord(g: ExploreGranularity) {
  return g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly";
}

function LinkButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-chip text-meta font-medium text-accent hover:underline pointer-coarse:py-2"
    >
      {children}
    </button>
  );
}

function TopList({
  rows,
}: {
  rows: { key: string; label: string; fils: number; share: number }[];
}) {
  return (
    <ul className="mt-3 divide-y divide-line text-meta">
      {rows.map((r) => (
        <li key={r.key} className="flex h-9 items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-ink">{r.label}</span>
          <span className="tabular w-12 text-right text-xs text-ink-2">
            {formatPercent(r.share)}
          </span>
          <Money
            fils={r.fils}
            noDecimals
            hideCurrency
            className="w-24 text-right font-medium"
          />
        </li>
      ))}
    </ul>
  );
}

function PacePanel({
  data,
  onMore,
}: {
  data?: ExploreResult;
  onMore?: () => void;
}) {
  const pace = data?.pace;
  return (
    <Panel
      title="This month so far"
      actions={
        onMore ? (
          <LinkButton onClick={onMore}>See forecast</LinkButton>
        ) : undefined
      }
    >
      {!data ? (
        <Loading h={160} />
      ) : !pace ? (
        <p className="text-meta text-ink-2">
          Pick a range that includes today to see how this period is going.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-meta text-ink-2">Spent so far</p>
              <p className="tabular text-xl font-semibold text-ink">
                {aed(pace.spentFils)}
              </p>
              <p className="text-xs text-ink-2">
                Day {pace.elapsedDays} of {pace.totalDays}
              </p>
            </div>
            <div>
              <p className="text-meta text-ink-2">At this pace</p>
              <p className="tabular text-xl font-semibold text-ink">
                {aed(pace.projectedFils)}
              </p>
              {pace.forecastFils ? (
                <p className="text-xs text-ink-2">
                  Forecast: about {aed(pace.forecastFils)}
                </p>
              ) : null}
            </div>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-2"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{
                width: `${Math.min(100, (pace.elapsedDays / pace.totalDays) * 100)}%`,
              }}
            />
          </div>
          {!pace.spentFils ? (
            <p className="text-meta text-ink-2">
              Nothing recorded yet this month.
            </p>
          ) : pace.forecastFils ? (
            <p className="text-meta text-ink-2">
              {pace.projectedFils > pace.forecastFils * 1.05
                ? `Running ${aed(pace.projectedFils - pace.forecastFils)} above the forecast. Early-period figures swing with big bills, so check again later.`
                : pace.projectedFils < pace.forecastFils * 0.95
                  ? `Running ${aed(pace.forecastFils - pace.projectedFils)} below the forecast.`
                  : "On track with the forecast."}
            </p>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Trends ---------------- */

const TREND_MODES: { value: TrendMode; label: string }[] = [
  { value: "bars", label: "Bars" },
  { value: "lines", label: "Lines" },
  { value: "area", label: "Area" },
  { value: "stacked", label: "By group" },
  { value: "cumulative", label: "Running net" },
];

function Trends({ f, data }: { f: ExploreFilters; data?: ExploreResult }) {
  const [mode, setMode] = useState<TrendMode>("lines");
  const [compare, setCompare] = useState(true);
  const canCompare = mode === "lines" || mode === "area";
  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <KpiBand t={data?.totals} p={data?.previous} loading={!data} />
      <Panel
        title="Over time"
        description={
          data
            ? `${intervalWord(data.granularity)}, ${formatDate(data.range.from, true)} to ${formatDate(data.range.to)}`
            : undefined
        }
      >
        <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2">
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl
              size="sm"
              aria-label="Chart type"
              value={mode}
              onChange={setMode}
              options={TREND_MODES}
            />
          </div>
          <Dropdown
            appearance="chip"
            aria-label="Interval"
            options={INTERVALS}
            value={f.granularity ?? "auto"}
            onChange={(v) => f.set({ int: v === "auto" ? null : v })}
          />
          {mode === "stacked" ? (
            <Dropdown
              appearance="chip"
              aria-label="Group by"
              options={GROUP_OPTIONS}
              value={f.groupBy}
              onChange={(v) => f.set({ by: v === "category" ? null : v })}
            />
          ) : null}
          {canCompare ? (
            <label className="inline-flex cursor-pointer items-center gap-2 text-meta text-ink-2 pointer-coarse:min-h-11">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-accent)]"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
              />
              Compare with previous period
            </label>
          ) : null}
        </div>
        {!data ? (
          <Loading />
        ) : hasAny(data) ? (
          <TrendChart data={data} mode={mode} compare={compare && canCompare} />
        ) : (
          <Empty />
        )}
      </Panel>
      {data && hasAny(data) ? <SeriesTable data={data} /> : null}
    </div>
  );
}

function SeriesTable({ data }: { data: ExploreResult }) {
  const rows = [...data.series].reverse();
  return (
    <Panel title="Figures" flush>
      <div className="max-h-[28rem] overflow-auto">
        <table className="tabular w-full min-w-[30rem] text-meta">
          <caption className="sr-only">
            Income, spending and net per period
          </caption>
          <thead className="sticky top-0 border-b border-line bg-surface-2 text-xs text-ink-2">
            <tr className="h-9">
              <th scope="col" className="px-4 text-left font-medium md:px-5">
                Period
              </th>
              <th scope="col" className="px-2 text-right font-medium">
                Income
              </th>
              <th scope="col" className="px-2 text-right font-medium">
                Spending
              </th>
              <th scope="col" className="px-2 text-right font-medium">
                Net
              </th>
              <th scope="col" className="px-4 text-right font-medium md:px-5">
                Items
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.period} className="h-10">
                <th
                  scope="row"
                  className="px-4 text-left font-normal text-ink md:px-5"
                >
                  {periodLabel(p.period, data.granularity, true)}
                  {p.partial ? (
                    <span className="ml-1.5 text-xs text-ink-3">(partial)</span>
                  ) : null}
                </th>
                <td className="px-2 text-right text-ink">
                  {formatFils(p.incomeFils, "AED", {
                    noDecimals: true,
                    hideCurrency: true,
                  })}
                </td>
                <td className="px-2 text-right text-ink">
                  {formatFils(p.expenseFils, "AED", {
                    noDecimals: true,
                    hideCurrency: true,
                  })}
                </td>
                <td
                  className={cn(
                    "px-2 text-right",
                    p.netFils < 0 ? "text-danger" : "text-ink",
                  )}
                >
                  {formatFils(p.netFils, "AED", {
                    noDecimals: true,
                    hideCurrency: true,
                    signed: true,
                  }).replace(/^-/, "−")}
                </td>
                <td className="px-4 text-right text-ink-2 md:px-5">
                  {p.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ---------------- Breakdown ---------------- */

function Breakdown({ f, data }: { f: ExploreFilters; data?: ExploreResult }) {
  const [mode, setMode] = useState<BreakdownMode>("donut");
  const drill = (key: string) => {
    if (f.groupBy === "category") f.set({ cat: [key] });
    else if (f.groupBy === "account") f.set({ acct: [key] });
    else if (f.groupBy === "member") f.set({ who: [key] });
    else if (f.groupBy === "merchant" && key !== "none")
      f.set({ q: data?.breakdown.find((b) => b.key === key)?.label ?? null });
  };
  const canDrill = f.groupBy !== "group" && f.groupBy !== "weekday";
  const total = data ? flowTotal(data) : 0;
  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <Panel
        title={`${f.flow === "income" ? "Income" : "Spending"} by ${GROUP_OPTIONS.find((g) => g.value === f.groupBy)?.label.toLowerCase()}`}
        description={
          data ? (
            <span className="tabular">{aed(total)} in total</span>
          ) : undefined
        }
      >
        <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2">
          <Dropdown
            appearance="chip"
            aria-label="Group by"
            options={GROUP_OPTIONS}
            value={f.groupBy}
            onChange={(v) => f.set({ by: v === "category" ? null : v })}
          />
          <SegmentedControl<BreakdownMode>
            size="sm"
            aria-label="Chart type"
            value={mode}
            onChange={setMode}
            options={[
              { value: "donut", label: "Donut" },
              { value: "pie", label: "Pie" },
              { value: "bars", label: "Bars" },
            ]}
          />
          {canDrill ? (
            <p className="text-xs text-ink-2">
              Select a slice or row to filter to it.
            </p>
          ) : null}
        </div>
        {!data ? (
          <Loading />
        ) : !data.breakdown.length ? (
          <EmptyState
            className="py-10"
            icon={PieIcon}
            title="Nothing to break down"
            description="Try a longer date range or remove a filter."
          />
        ) : (
          <div
            className={cn(
              "grid min-w-0 items-center gap-6",
              mode !== "bars" && "lg:grid-cols-[minmax(0,22rem)_1fr]",
            )}
          >
            <BreakdownChart
              items={data.breakdown}
              mode={mode}
              total={total}
              flow={f.flow}
              onSelect={canDrill ? drill : undefined}
            />
            {mode !== "bars" ? (
              <BreakdownTable
                data={data}
                onSelect={canDrill ? drill : undefined}
              />
            ) : null}
          </div>
        )}
      </Panel>
      {data && mode === "bars" && data.breakdown.length ? (
        <Panel title="Details" flush>
          <BreakdownTable data={data} onSelect={canDrill ? drill : undefined} />
        </Panel>
      ) : null}
    </div>
  );
}

function BreakdownTable({
  data,
  onSelect,
}: {
  data: ExploreResult;
  onSelect?: (key: string) => void;
}) {
  const max = Math.max(1, ...data.breakdown.map((b) => b.fils));
  return (
    <div className="max-h-[26rem] min-w-0 overflow-auto">
      <table className="w-full table-fixed text-meta">
        <caption className="sr-only">Breakdown</caption>
        <thead className="sticky top-0 border-b border-line bg-surface text-xs text-ink-2">
          <tr className="h-9">
            <th scope="col" className="w-[40%] px-2 text-left font-medium">
              Name
            </th>
            <th
              scope="col"
              className="hidden px-2 text-left font-medium sm:table-cell"
            >
              <span className="sr-only">Relative amount</span>
            </th>
            <th scope="col" className="w-14 px-2 text-right font-medium">
              Share
            </th>
            <th
              scope="col"
              className="hidden w-14 px-2 text-right font-medium md:table-cell"
            >
              Items
            </th>
            <th scope="col" className="w-28 px-2 text-right font-medium">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.breakdown.map((b) => (
            <tr
              key={b.key}
              className={cn(
                "h-10",
                onSelect && "cursor-pointer hover:bg-surface-2",
              )}
              onClick={onSelect ? () => onSelect(b.key) : undefined}
            >
              <th
                scope="row"
                className="truncate px-2 text-left font-normal text-ink"
              >
                {onSelect ? (
                  <button
                    type="button"
                    className="max-w-full truncate text-left hover:underline"
                    onClick={(e) => (e.stopPropagation(), onSelect(b.key))}
                  >
                    {b.label}
                  </button>
                ) : (
                  b.label
                )}
              </th>
              <td className="hidden px-2 sm:table-cell" aria-hidden>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-ink-2"
                    style={{ width: `${(b.fils / max) * 100}%` }}
                  />
                </div>
              </td>
              <td className="tabular px-2 text-right text-ink-2">
                {formatPercent(b.share)}
              </td>
              <td className="tabular hidden px-2 text-right text-ink-2 md:table-cell">
                {b.count}
              </td>
              <td className="px-2 text-right">
                <Money
                  fils={b.fils}
                  noDecimals
                  hideCurrency
                  className="font-medium"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Patterns ---------------- */

function Patterns({
  f,
  data,
  flowWord,
}: {
  f: ExploreFilters;
  data?: ExploreResult;
  flowWord: string;
}) {
  const categories = useCategories();
  const catName = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data],
  );
  // The calendar shows at most the last ~53 weeks of the range.
  const heatFrom = useMemo(() => {
    const d = new Date(`${f.to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 370);
    const min = d.toISOString().slice(0, 10);
    return f.from < min ? min : f.from;
  }, [f.from, f.to]);
  if (!data) return <Loading />;
  if (!hasAny(data)) return <Empty />;
  const busiest = [...data.weekday].sort((a, b) => b.avgFils - a.avgFils)[0];
  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <Panel
        title={`Daily ${flowWord}`}
        description={
          heatFrom !== f.from
            ? "The last 12 months of the range"
            : "Darker days had more"
        }
      >
        <CalendarHeatmap
          from={heatFrom}
          to={f.to}
          daily={data.daily}
          flow={f.flow}
        />
      </Panel>
      <div className="grid min-w-0 items-start gap-4 lg:gap-5 xl:grid-cols-2">
        <Panel
          title="By day of the week"
          description={
            busiest?.avgFils
              ? `${busiest.label} is the biggest day on average`
              : undefined
          }
        >
          <WeekdayChart data={data.weekday} flow={f.flow} />
        </Panel>
        <Panel
          title={`Largest ${f.flow === "income" ? "income" : "expenses"}`}
          flush
        >
          <ul className="divide-y divide-line">
            {data.largest.map((t) => (
              <li
                key={t.id}
                className="flex h-12 items-center gap-3 px-4 text-meta md:px-5"
              >
                <CalendarDays
                  className="size-4 shrink-0 text-ink-3"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink">
                    {t.merchant ||
                      (t.categoryId && catName.get(t.categoryId)) ||
                      "No merchant"}
                  </p>
                  <p className="text-xs text-ink-2">
                    {formatDate(t.date)}
                    {t.merchant && t.categoryId && catName.get(t.categoryId)
                      ? ` · ${catName.get(t.categoryId)}`
                      : ""}
                  </p>
                </div>
                <Money
                  fils={t.fils}
                  noDecimals
                  hideCurrency
                  className="font-medium"
                />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Forecast ---------------- */

const CONFIDENCE_TEXT: Record<Confidence, string> = {
  high: "Based on 6 or more periods of history.",
  medium: "Based on 4 to 5 periods of history; treat it as a rough guide.",
  low: "Little history so far; this will firm up as you record more.",
};

function ForecastView({ f }: { f: ExploreFilters }) {
  const [gran, setGran] = useState<ExploreGranularity>("month");
  const [horizon, setHorizon] = useState(3);
  const today = todayISO();
  const from =
    gran === "month"
      ? monthRange(addMonths(currentMonth(), -11))[0]
      : gran === "week"
        ? shiftDays(today, -7 * 26)
        : shiftDays(today, -59);
  const q = useInsightsExplore({
    ...f.params,
    from,
    to: today,
    granularity: gran,
    horizon: gran === "day" ? horizon * 7 : horizon,
  });
  const next = useInsightsForecast();
  const lastMonth = useInsightsSummary(
    next.data ? addMonths(next.data.month, -2) : "",
  );
  const categories = useCategories();
  const d = q.data;
  const pts = d?.forecast.points ?? [];
  const first = pts[0];
  const filtered = f.activeCount > 0;
  const word = f.flow === "income" ? "income" : "spending";

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <Panel
        title={`Projected ${word}`}
        description={
          filtered
            ? "For the filtered transactions only"
            : "Trend of recent history, with a likely range"
        }
      >
        <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2">
          <SegmentedControl<ExploreGranularity>
            size="sm"
            aria-label="Forecast interval"
            value={gran}
            onChange={setGran}
            options={[
              { value: "week", label: "Weekly" },
              { value: "month", label: "Monthly" },
            ]}
          />
          <Dropdown
            appearance="chip"
            aria-label="How far ahead"
            options={[
              {
                value: "3",
                label: gran === "month" ? "Next 3 months" : "Next 3 weeks",
              },
              {
                value: "6",
                label: gran === "month" ? "Next 6 months" : "Next 6 weeks",
              },
              {
                value: "12",
                label: gran === "month" ? "Next 12 months" : "Next 12 weeks",
              },
            ]}
            value={String(horizon)}
            onChange={(v) => setHorizon(Number(v))}
          />
        </div>
        {!d ? (
          <Loading />
        ) : !pts.length ? (
          <EmptyState
            className="py-10"
            icon={Sparkles}
            title="Not enough history to forecast"
            description="Forecasts need at least 3 complete periods with transactions. Try Weekly, or remove a filter."
          />
        ) : (
          <>
            {d.forecast.stale && d.forecast.lastDataPeriod ? (
              <p className="mb-3 flex items-start gap-2 rounded-container border border-line bg-surface-2 p-3 text-meta text-ink-2">
                <Sparkles
                  className="mt-0.5 size-4 shrink-0 text-warn"
                  aria-hidden
                />
                Nothing has been recorded since{" "}
                {periodLabel(d.forecast.lastDataPeriod, d.granularity, true)},
                so this forecast uses the history up to then. Record recent
                transactions for a sharper forecast.
              </p>
            ) : null}
            <ForecastChart
              history={d.series}
              points={pts}
              gran={d.granularity}
              flow={f.flow}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Figure
                label={`Next: ${periodLabel(first.period, d.granularity, true)}`}
                value={aed(
                  (f.flow === "income"
                    ? first.incomeFils
                    : first.expenseFils) ?? 0,
                )}
                hint={`Likely ${aed((f.flow === "income" ? first.incomeLowFils : first.expenseLowFils) ?? 0)} to ${aed((f.flow === "income" ? first.incomeHighFils : first.expenseHighFils) ?? 0)}`}
              />
              <Figure
                label={`Total over ${pts.length} ${d.granularity === "month" ? "months" : "weeks"}`}
                value={aed(
                  pts.reduce(
                    (s, p) =>
                      s +
                      ((f.flow === "income" ? p.incomeFils : p.expenseFils) ??
                        0),
                    0,
                  ),
                )}
                hint={
                  f.flow === "expense" && pts.every((p) => p.incomeFils != null)
                    ? `Projected net ${formatFils(
                        pts.reduce(
                          (s, p) =>
                            s + (p.incomeFils ?? 0) - (p.expenseFils ?? 0),
                          0,
                        ),
                        "AED",
                        { noDecimals: true, signed: true },
                      ).replace(/^-/, "−")}`
                    : undefined
                }
              />
              <Figure
                label="Confidence"
                value={
                  d.forecast.confidence[0].toUpperCase() +
                  d.forecast.confidence.slice(1)
                }
                hint={CONFIDENCE_TEXT[d.forecast.confidence]}
              />
            </div>
          </>
        )}
      </Panel>
      <div className="grid min-w-0 items-start gap-4 lg:gap-5 xl:grid-cols-2">
        <PacePanel data={d} />
        <ForecastPanel
          forecast={next.data}
          lastMonth={lastMonth.data}
          categories={categories.data ?? []}
          loading={next.isPending}
          error={next.isError ? next.error : undefined}
          onRetry={() => next.refetch()}
        />
      </div>
    </div>
  );
}

function shiftDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-container border border-line bg-surface-2 p-3">
      <p className="truncate text-meta text-ink-2">{label}</p>
      <p className="tabular mt-0.5 text-xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-2">{hint}</p> : null}
    </div>
  );
}

/* ---------------- Health ---------------- */

function HealthView({ to }: { to: string }) {
  const month = to.slice(0, 7);
  const anomalies = useInsightsAnomalies(month);
  const health = useInsightsHealth();
  const categories = useCategories();
  return (
    <div className="grid min-w-0 items-start gap-4 lg:gap-5 xl:grid-cols-2">
      <AnomaliesPanel
        month={month}
        items={anomalies.data}
        categories={categories.data ?? []}
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
  );
}
