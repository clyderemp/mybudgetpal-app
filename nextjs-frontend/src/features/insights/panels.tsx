"use client";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  PieChart,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Badge,
  EmptyState,
  InlineError,
  Money,
  Panel,
  SkeletonList,
  Tip,
} from "@/components/ui";
import {
  HealthComponentsList,
  ScoreMeter,
} from "@/features/dashboard/SidePanels";
import { hasHealthData, scoreBand } from "@/features/dashboard/format";
import { formatMonth } from "@/lib/dates";
import { formatFils, formatPercent } from "@/lib/money";
import type {
  Anomaly,
  Category,
  CategoryShare,
  Confidence,
  FinancialHealth,
  Forecast,
  InsightsSummary,
  Trend,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { businessCategoryLabel } from "@/features/accounts/accountMeta";
import { useAccounts } from "@/lib/queries";

type QueryState = { loading?: boolean; error?: unknown; onRetry?: () => void };

/** Category id → name. Money moved into a business account (synthetic "business:<id>") reads "To <account>". */
function useCatNamer(categories: Category[]) {
  const accounts = useAccounts();
  const names = new Map(categories.map((c) => [c.id, c.name]));
  return (id: string | null | undefined) =>
    businessCategoryLabel(id, accounts.data ?? [], "to") ||
    (id && names.get(id)) ||
    "Uncategorised";
}

/* ---------------- Spending by category ---------------- */

const MAX_ROWS = 8;

export function CategoryBreakdownPanel({
  items,
  categories,
  month,
  loading,
  error,
  onRetry,
}: QueryState & {
  items?: CategoryShare[];
  categories: Category[];
  month: string;
}) {
  const name = useCatNamer(categories);
  const sorted = [...(items ?? [])]
    .filter((i) => i.expenseFils > 0)
    .sort((a, b) => b.expenseFils - a.expenseFils);
  const total = sorted.reduce((s, i) => s + i.expenseFils, 0);
  const top = sorted.length > MAX_ROWS ? sorted.slice(0, MAX_ROWS - 1) : sorted;
  const rest = sorted.slice(top.length);
  const rows = top.map((i, idx) => ({
    id: i.categoryId ?? `none-${idx}`,
    label: name(i.categoryId),
    value: i.expenseFils,
    other: false,
  }));
  if (rest.length) {
    rows.push({
      id: "__other",
      label: `Other (${rest.length} categories)`,
      value: rest.reduce((s, i) => s + i.expenseFils, 0),
      other: true,
    });
  }
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);

  return (
    <Panel
      title="Spending by category"
      description={
        total ? (
          <span className="tabular">
            {formatFils(total, "AED", { noDecimals: true })} in{" "}
            {formatMonth(month, true)}
          </span>
        ) : (
          formatMonth(month, true)
        )
      }
      flush
    >
      {loading ? (
        <SkeletonList rows={6} className="px-4 md:px-5" />
      ) : error ? (
        <InlineError
          className="m-4 border-0 p-0"
          error={error}
          onRetry={onRetry}
          title="Couldn't load spending by category"
        />
      ) : rows.length === 0 ? (
        <EmptyState
          className="py-10"
          icon={PieChart}
          title="No spending this month"
          description="Record expenses and the category breakdown appears here."
        />
      ) : (
        <table className="w-full table-fixed text-meta">
          <caption className="sr-only">
            Spending by category, {formatMonth(month, true)}
          </caption>
          <thead className="border-b border-line bg-surface-2 text-xs text-ink-2">
            <tr className="h-9">
              <th
                scope="col"
                className="w-[38%] px-4 text-left font-medium md:px-5"
              >
                Category
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
                className="w-28 px-4 text-right font-medium md:px-5"
              >
                Spent
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="h-10">
                <th
                  scope="row"
                  className={cn(
                    "truncate px-4 text-left font-normal md:px-5",
                    r.other ? "text-ink-2" : "text-ink",
                  )}
                >
                  {r.label}
                </th>
                <td className="hidden px-2 sm:table-cell" aria-hidden>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        r.other ? "bg-line-strong" : "bg-ink-2",
                      )}
                      style={{ width: `${max ? (r.value / max) * 100 : 0}%` }}
                    />
                  </div>
                </td>
                <td className="tabular px-2 text-right text-ink-2">
                  {formatPercent(total ? r.value / total : 0)}
                </td>
                <td className="px-4 text-right md:px-5">
                  <Money
                    fils={r.value}
                    noDecimals
                    hideCurrency
                    className="font-medium"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/* ---------------- Forecast ---------------- */

const CONFIDENCE: Record<
  Confidence,
  { label: string; tone: "neutral" | "accent" | "warn"; help: string }
> = {
  low: {
    label: "Low confidence",
    tone: "warn",
    help: "Based on less than 3 months of history",
  },
  medium: {
    label: "Medium confidence",
    tone: "neutral",
    help: "Based on 3 to 5 months of history",
  },
  high: {
    label: "High confidence",
    tone: "accent",
    help: "Based on 6 or more months of history",
  },
};

export function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "up")
    return (
      <ArrowUpRight
        className="size-4 text-warn"
        role="img"
        aria-label="Trending up"
      />
    );
  if (trend === "down")
    return (
      <ArrowDownRight
        className="size-4 text-accent"
        role="img"
        aria-label="Trending down"
      />
    );
  return <Minus className="size-4 text-ink-2" role="img" aria-label="Flat" />;
}

export function ForecastPanel({
  forecast,
  lastMonth,
  categories,
  loading,
  error,
  onRetry,
}: QueryState & {
  forecast?: Forecast;
  lastMonth?: InsightsSummary;
  categories: Category[];
}) {
  const name = useCatNamer(categories);
  const last = new Map(
    (lastMonth?.byCategory ?? []).map((c) => [
      c.categoryId ?? "__none",
      c.expenseFils,
    ]),
  );
  const rows = [...(forecast?.byCategory ?? [])]
    .filter((r) => r.forecastFils > 0)
    .sort((a, b) => b.forecastFils - a.forecastFils)
    .slice(0, 10);
  const conf = forecast ? CONFIDENCE[forecast.confidence] : null;
  const noForecast =
    !forecast ||
    (forecast.totalIncomeFils === 0 && forecast.totalExpenseFils === 0);
  const net = forecast
    ? forecast.totalIncomeFils - forecast.totalExpenseFils
    : 0;

  return (
    <Panel
      title="Forecast"
      description={
        forecast
          ? `Expected for ${formatMonth(forecast.month, true)}`
          : undefined
      }
      actions={
        conf ? (
          <Tip content={conf.help}>
            <Badge tone={conf.tone} tabIndex={0}>
              {conf.label}
            </Badge>
          </Tip>
        ) : null
      }
      flush
    >
      {loading ? (
        <SkeletonList rows={6} className="px-4 md:px-5" />
      ) : error ? (
        <InlineError
          className="m-4 border-0 p-0"
          error={error}
          onRetry={onRetry}
          title="Couldn't load the forecast"
        />
      ) : noForecast ? (
        <EmptyState
          className="py-10"
          icon={TrendingUp}
          title="Not enough history yet"
          description="Keep recording transactions. A forecast appears after your first full month."
        />
      ) : (
        <>
          <dl className="grid grid-cols-3 divide-x divide-line border-b border-line">
            {[
              {
                label: "Income",
                node: <Money fils={forecast!.totalIncomeFils} noDecimals />,
              },
              {
                label: "Spending",
                node: <Money fils={forecast!.totalExpenseFils} noDecimals />,
              },
              {
                label: "Net",
                node: (
                  <Money
                    fils={net}
                    noDecimals
                    tone={net < 0 ? "danger" : undefined}
                  />
                ),
              },
            ].map((x) => (
              <div key={x.label} className="min-w-0 px-3 py-3 sm:px-4 md:px-5">
                <dt className="text-xs text-ink-2">{x.label}</dt>
                <dd className="text-sm leading-tight font-semibold">
                  {x.node}
                </dd>
              </div>
            ))}
          </dl>
          {rows.length === 0 ? (
            <p className="px-4 py-4 text-meta text-ink-2 md:px-5">
              No category spending to forecast yet.
            </p>
          ) : (
            <table className="w-full table-fixed text-meta">
              <caption className="sr-only">
                Forecast spending by category
              </caption>
              <thead className="border-b border-line bg-surface-2 text-xs text-ink-2">
                <tr className="h-9">
                  <th
                    scope="col"
                    className="px-4 text-left font-medium md:px-5"
                  >
                    Category
                  </th>
                  <th
                    scope="col"
                    className="w-16 px-2 text-right font-medium sm:w-28"
                  >
                    {lastMonth
                      ? formatMonth(lastMonth.month).split(" ")[0]
                      : "Last month"}
                  </th>
                  <th
                    scope="col"
                    className="w-16 px-2 text-right font-medium sm:w-28"
                  >
                    Forecast
                  </th>
                  <th
                    scope="col"
                    className="w-12 pr-3 pl-1 text-center font-medium sm:w-16 sm:pr-4 sm:pl-2 md:pr-5"
                  >
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => (
                  <tr key={r.categoryId ?? `none-${i}`} className="h-10">
                    <th
                      scope="row"
                      className="truncate px-4 text-left font-normal text-ink md:px-5"
                    >
                      {name(r.categoryId)}
                    </th>
                    <td className="px-2 text-right">
                      <Money
                        fils={last.get(r.categoryId ?? "__none") ?? 0}
                        noDecimals
                        hideCurrency
                        tone="muted"
                      />
                    </td>
                    <td className="px-2 text-right">
                      <Money
                        fils={r.forecastFils}
                        noDecimals
                        hideCurrency
                        className="font-medium"
                      />
                    </td>
                    <td className="pr-3 pl-1 sm:pr-4 sm:pl-2 md:pr-5">
                      <span className="flex justify-center">
                        <TrendIcon trend={r.trend} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Panel>
  );
}

/* ---------------- Anomalies ---------------- */

export function AnomaliesPanel({
  items,
  categories,
  month,
  loading,
  error,
  onRetry,
}: QueryState & { items?: Anomaly[]; categories: Category[]; month: string }) {
  const name = useCatNamer(categories);
  return (
    <Panel
      title="Unusual activity"
      description={`${formatMonth(month, true)} compared with your usual monthly spending`}
      flush
    >
      {loading ? (
        <SkeletonList rows={4} className="px-4 md:px-5" />
      ) : error ? (
        <InlineError
          className="m-4 border-0 p-0"
          error={error}
          onRetry={onRetry}
          title="Couldn't check for unusual activity"
        />
      ) : !items?.length ? (
        <EmptyState
          className="py-10"
          icon={Sparkles}
          title="Nothing unusual"
          description="No spending spikes or outsized transactions this month."
        />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((a, i) => {
            const ratio =
              a.baselineFils > 0 ? a.amountFils / a.baselineFils : null;
            return (
              <li
                key={`${a.kind}-${a.transactionId ?? a.categoryId ?? i}`}
                className="flex gap-3 px-4 py-3 md:px-5"
              >
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-warn"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-meta font-medium text-ink">
                      {a.kind === "category_spike"
                        ? "Spending spike"
                        : "Large transaction"}
                    </p>
                    {a.categoryId ? (
                      <Badge tone="outline">{name(a.categoryId)}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-meta break-words text-ink-2">
                    {a.message}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Money
                    fils={a.amountFils}
                    noDecimals
                    className="block text-meta font-semibold"
                  />
                  <span className="tabular block text-xs text-ink-2">
                    usual{" "}
                    {formatFils(a.baselineFils, "AED", {
                      noDecimals: true,
                      hideCurrency: true,
                    })}
                  </span>
                  {ratio ? (
                    <span className="tabular block text-xs font-medium text-warn">
                      {ratio.toFixed(1)}x
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------- Health breakdown ---------------- */

const bandText = {
  positive: "text-accent",
  warning: "text-warn",
  negative: "text-danger",
  neutral: "text-ink-2",
} as const;

export function HealthBreakdownPanel({
  health,
  loading,
  error,
  onRetry,
}: QueryState & { health?: FinancialHealth }) {
  const empty = !health || !hasHealthData(health);
  const band = health ? scoreBand(health.score) : null;
  return (
    <Panel
      id="health"
      title="Financial health"
      description="Savings 35 points, emergency fund 35, debt load 30"
      className="scroll-mt-20"
    >
      {loading ? (
        <SkeletonList rows={4} />
      ) : error || !health ? (
        <InlineError
          className="border-0 p-0"
          error={error}
          onRetry={onRetry}
          title="Couldn't load your health score"
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="tabular text-kpi font-semibold text-ink">
                {empty ? "—" : Math.round(health.score)}
                <span className="text-meta font-normal text-ink-2"> / 100</span>
              </p>
              <span
                className={cn(
                  "text-meta font-medium",
                  empty || !band ? "text-ink-2" : bandText[band.tone],
                )}
              >
                {empty ? "No data yet" : band?.label}
              </span>
            </div>
            <ScoreMeter score={health.score} empty={empty} />
            <div aria-hidden className="tabular mt-1 flex text-xs text-ink-2">
              <span className="w-[40%]">Needs attention</span>
              <span className="w-[30%]">Fair</span>
              <span className="w-[30%]">Healthy</span>
            </div>
          </div>
          <HealthComponentsList health={health} showTargets />
          {health.tips.length ? (
            <div className="rounded-control border border-line bg-surface-2 px-3 py-2.5">
              <p className="mb-1.5 text-meta font-medium text-ink">
                What to work on
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-meta text-ink-2 marker:text-ink-3">
                {health.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ) : empty ? (
            <p className="text-meta text-ink-2">
              Record income and expenses to get a score.
            </p>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
