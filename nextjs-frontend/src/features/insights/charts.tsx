"use client";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useEffect, useMemo, useRef } from "react";
import { CATEGORICAL, OTHER_COLOR, useChartColors } from "@/lib/chart-theme";
import { formatFils, formatFilsCompact, formatPercent } from "@/lib/money";
import type {
  ExploreFlow,
  ExploreForecastPoint,
  ExploreGranularity,
  ExploreGroup,
  ExplorePoint,
  ExploreResult,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Short tick label for a period key ("2026-11" | "2026-11-03"). */
export function periodLabel(
  key: string,
  gran: ExploreGranularity,
  long = false,
): string {
  const y = key.slice(0, 4);
  const m = MONTHS[Number(key.slice(5, 7)) - 1] ?? "";
  if (gran === "month") return long ? `${m} ${y}` : m;
  const d = String(Number(key.slice(8, 10)));
  if (gran === "week") return long ? `Week of ${d} ${m} ${y}` : `${d} ${m}`;
  return long ? `${d} ${m} ${y}` : `${d} ${m}`;
}

const money = (v: number | null) =>
  v == null ? "" : formatFils(v, "AED", { noDecimals: true });
const axisMoney = (v: number) => formatFilsCompact(v).replace("AED ", "");

export function Legend({
  items,
  className,
}: {
  items: { label: string; color: string; shape?: "bar" | "line" | "dash" }[];
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2",
        className,
      )}
      aria-label="Chart legend"
    >
      {items.map((s) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={
              s.shape === "line"
                ? "h-0.5 w-3 rounded-full"
                : s.shape === "dash"
                  ? "h-0 w-3 border-t-2 border-dashed"
                  : "size-2.5 rounded-[2px]"
            }
            style={
              s.shape === "dash"
                ? { borderColor: s.color }
                : { background: s.color }
            }
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export function useGroupColors(keys: string[]) {
  const c = useChartColors();
  return useMemo(() => {
    const pal = CATEGORICAL[c.mode];
    const map = new Map<string, string>();
    keys.forEach((k, i) =>
      map.set(
        k,
        k === "__other" || k === "none"
          ? OTHER_COLOR[c.mode]
          : pal[i % pal.length],
      ),
    );
    return map;
  }, [keys, c.mode]);
}

/* ---------------- Trend ---------------- */

export type TrendMode = "bars" | "lines" | "area" | "stacked" | "cumulative";

export function TrendChart({
  data,
  mode,
  compare,
  height = 300,
}: {
  data: ExploreResult;
  mode: TrendMode;
  compare: boolean;
  height?: number;
}) {
  const c = useChartColors();
  const gran = data.granularity;
  const periods = data.series.map((p) => p.period);
  const flowKey = data.flow === "income" ? "incomeFils" : "expenseFils";
  const prevKey = data.flow === "income" ? "prevIncomeFils" : "prevExpenseFils";
  const flowLabel = data.flow === "income" ? "Income" : "Spending";
  const flowColor = data.flow === "income" ? c.income : c.expense;
  const stackColors = useGroupColors(data.stackKeys.map((k) => k.key));
  const xAxis = [
    {
      scaleType: "band" as const,
      data: periods,
      valueFormatter: (k: string, ctx: { location: string }) =>
        periodLabel(k, gran, ctx.location !== "tick"),
      tickLabelStyle: { fontSize: 11 },
      categoryGapRatio: 0.3,
      barGapRatio: 0.1,
    },
  ];
  const lineX = [{ ...xAxis[0], scaleType: "point" as const }];
  const yAxis = [{ valueFormatter: axisMoney, width: 48 }];
  const common = {
    height,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
    hideLegend: true,
    grid: { horizontal: true },
  };
  const prev = compare
    ? [
        {
          id: "prev",
          label: `${flowLabel}, previous period`,
          data: data.series.map((p) => p[prevKey]),
          color: c.ink3,
          valueFormatter: money,
          showMark: false,
          curve: "linear" as const,
        },
      ]
    : [];

  let legend: {
    label: string;
    color: string;
    shape?: "bar" | "line" | "dash";
  }[] = [];
  let chart: React.ReactNode;
  if (mode === "bars") {
    legend = [
      { label: "Income", color: c.income },
      { label: "Spending", color: c.expense },
    ];
    chart = (
      <BarChart
        {...common}
        xAxis={xAxis}
        yAxis={yAxis}
        borderRadius={2}
        series={[
          {
            id: "inc",
            label: "Income",
            data: data.series.map((p) => p.incomeFils),
            color: c.income,
            valueFormatter: money,
          },
          {
            id: "exp",
            label: "Spending",
            data: data.series.map((p) => p.expenseFils),
            color: c.expense,
            valueFormatter: money,
          },
        ]}
      />
    );
  } else if (mode === "stacked") {
    legend = data.stackKeys.map((k) => ({
      label: k.label,
      color: stackColors.get(k.key)!,
    }));
    chart = (
      <BarChart
        {...common}
        xAxis={xAxis}
        yAxis={yAxis}
        series={data.stackKeys.map((k) => ({
          id: k.key,
          label: k.label,
          stack: "total",
          data: data.stacked.map((r) => r.values[k.key] ?? 0),
          color: stackColors.get(k.key),
          valueFormatter: money,
        }))}
      />
    );
  } else if (mode === "cumulative") {
    legend = [
      { label: "Running net (income − spending)", color: c.net, shape: "line" },
    ];
    chart = (
      <LineChart
        {...common}
        xAxis={lineX}
        yAxis={yAxis}
        series={[
          {
            id: "cum",
            label: "Running net",
            data: data.series.map((p) => p.cumulativeNetFils),
            color: c.net,
            area: true,
            curve: "linear",
            showMark: data.series.length <= 24,
            valueFormatter: (v) =>
              formatFils(v ?? 0, "AED", { noDecimals: true, signed: true }),
          },
        ]}
        sx={{ "& .MuiAreaElement-root": { fillOpacity: 0.15 } }}
      />
    );
  } else {
    const area = mode === "area";
    legend = area
      ? [{ label: flowLabel, color: flowColor, shape: "line" }]
      : [
          { label: "Income", color: c.income, shape: "line" },
          { label: "Spending", color: c.expense, shape: "line" },
        ];
    if (compare)
      legend.push({ label: "Previous period", color: c.ink3, shape: "dash" });
    const main = area
      ? [
          {
            id: "flow",
            label: flowLabel,
            data: data.series.map((p) => p[flowKey]),
            color: flowColor,
            area: true,
            valueFormatter: money,
            showMark: data.series.length <= 24,
            curve: "linear" as const,
          },
        ]
      : [
          {
            id: "inc",
            label: "Income",
            data: data.series.map((p) => p.incomeFils),
            color: c.income,
            valueFormatter: money,
            showMark: data.series.length <= 24,
            curve: "linear" as const,
          },
          {
            id: "exp",
            label: "Spending",
            data: data.series.map((p) => p.expenseFils),
            color: c.expense,
            valueFormatter: money,
            showMark: data.series.length <= 24,
            curve: "linear" as const,
          },
        ];
    chart = (
      <LineChart
        {...common}
        xAxis={lineX}
        yAxis={yAxis}
        series={[...main, ...prev]}
        sx={{
          "& .MuiAreaElement-root": { fillOpacity: 0.15 },
          '& [data-series="prev"]': { strokeDasharray: "4 4" },
          "& .MuiMarkElement-root": { r: 2.5 },
        }}
      />
    );
  }

  return (
    <div className="min-w-0">
      <Legend items={legend} className="mb-2" />
      <div
        className="w-full min-w-0"
        role="img"
        aria-label={`${flowLabel} over time, ${mode} chart`}
      >
        {chart}
      </div>
    </div>
  );
}

/* ---------------- Breakdown ---------------- */

export type BreakdownMode = "donut" | "pie" | "bars";

const MAX_SLICES = 8;

/** Top groups + one "Other" slice, so a pie never turns into confetti. */
export function topWithOther(
  items: ExploreGroup[],
  max = MAX_SLICES,
): ExploreGroup[] {
  if (items.length <= max) return items;
  const top = items.slice(0, max - 1);
  const rest = items.slice(max - 1);
  const fils = rest.reduce((s, i) => s + i.fils, 0);
  const count = rest.reduce((s, i) => s + i.count, 0);
  const share = rest.reduce((s, i) => s + i.share, 0);
  return [
    ...top,
    {
      key: "__other",
      label: `Other (${rest.length})`,
      fils,
      count,
      share,
      avgFils: count ? Math.round(fils / count) : 0,
    },
  ];
}

export function BreakdownChart({
  items,
  mode,
  total,
  flow,
  onSelect,
  height = 280,
}: {
  items: ExploreGroup[];
  mode: BreakdownMode;
  total: number;
  flow: ExploreFlow;
  onSelect?: (key: string) => void;
  height?: number;
}) {
  const shown = mode === "bars" ? items.slice(0, 15) : topWithOther(items);
  const colors = useGroupColors(shown.map((i) => i.key));
  const label = flow === "income" ? "Income" : "Spending";

  if (mode === "bars") {
    return (
      <div
        className="w-full min-w-0"
        role="img"
        aria-label={`${label} by group, bar chart`}
      >
        <BarChart
          height={Math.max(160, shown.length * 30 + 24)}
          layout="horizontal"
          margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
          hideLegend
          grid={{ vertical: true }}
          borderRadius={2}
          yAxis={[
            {
              scaleType: "band",
              data: shown.map((i) => i.label),
              width: 112,
              tickLabelStyle: { fontSize: 11 },
              categoryGapRatio: 0.35,
            },
          ]}
          xAxis={[
            { valueFormatter: axisMoney, tickLabelStyle: { fontSize: 11 } },
          ]}
          series={[
            {
              id: "v",
              label,
              data: shown.map((i) => i.fils),
              valueFormatter: money,
              color: colors.get(shown[0]?.key ?? ""),
            },
          ]}
          onItemClick={(_e, d) => {
            const row = shown[d.dataIndex];
            if (row && row.key !== "__other") onSelect?.(row.key);
          }}
        />
      </div>
    );
  }

  const donut = mode === "donut";
  return (
    <div
      className="relative mx-auto w-full max-w-[22rem]"
      role="img"
      aria-label={`${label} by group, ${mode} chart`}
    >
      <PieChart
        height={height}
        hideLegend
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        series={[
          {
            innerRadius: donut ? "58%" : 0,
            paddingAngle: donut ? 1.5 : 0.5,
            cornerRadius: donut ? 3 : 1,
            highlightScope: { fade: "global", highlight: "item" },
            data: shown.map((i, idx) => ({
              id: i.key || idx,
              value: i.fils,
              label: i.label,
              color: colors.get(i.key),
            })),
            valueFormatter: (v) =>
              `${money(v.value)} · ${formatPercent(total ? v.value / total : 0)}`,
          },
        ]}
        onItemClick={(_e, d) => {
          const row = shown[d.dataIndex];
          if (row && row.key !== "__other") onSelect?.(row.key);
        }}
      />
      {donut ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xs text-ink-2">{label}</p>
            <p className="tabular text-lg font-semibold text-ink">
              {formatFilsCompact(total)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Forecast ---------------- */

export function ForecastChart({
  history,
  points,
  gran,
  flow,
  height = 300,
}: {
  history: ExplorePoint[];
  points: ExploreForecastPoint[];
  gran: ExploreGranularity;
  flow: ExploreFlow;
  height?: number;
}) {
  const c = useChartColors();
  const isInc = flow === "income";
  const color = isInc ? c.income : c.net;
  const firstFc = points[0]?.period;
  const past = history.filter((p) => !firstFc || p.period < firstFc);
  const periods = [
    ...past.map((p) => p.period),
    ...points.map((p) => p.period),
  ];
  const actual = [
    ...past.map((p) => (isInc ? p.incomeFils : p.expenseFils)),
    ...points.map(() => null),
  ];
  const pick = (p: ExploreForecastPoint, k: "" | "Low" | "High") =>
    (isInc ? p[`income${k}Fils` as const] : p[`expense${k}Fils` as const]) ??
    null;
  // Join the forecast line to the last actual so the two read as one story.
  const lastActual = past.length ? actual[past.length - 1] : null;
  const fcLine = [
    ...past.map((_, i) => (i === past.length - 1 ? lastActual : null)),
    ...points.map((p) => pick(p, "")),
  ];
  const low = [...past.map(() => null), ...points.map((p) => pick(p, "Low"))];
  const band = [
    ...past.map(() => null),
    ...points.map((p) => {
      const lo = pick(p, "Low");
      const hi = pick(p, "High");
      return lo == null || hi == null ? null : hi - lo;
    }),
  ];
  const range = (i: number) => {
    const p = points[i - past.length];
    return p ? `${money(pick(p, "Low"))} – ${money(pick(p, "High"))}` : null;
  };

  return (
    <div className="min-w-0">
      <Legend
        className="mb-2"
        items={[
          {
            label: isInc ? "Actual income" : "Actual spending",
            color: c.expense,
            shape: "line",
          },
          { label: "Forecast", color, shape: "dash" },
          { label: "Likely range (80%)", color: `${color}33` },
        ]}
      />
      <div
        className="w-full min-w-0"
        role="img"
        aria-label="Actual and forecast with likely range"
      >
        <LineChart
          height={height}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          hideLegend
          grid={{ horizontal: true }}
          xAxis={[
            {
              scaleType: "point",
              data: periods,
              valueFormatter: (k: string, ctx: { location: string }) =>
                periodLabel(k, gran, ctx.location !== "tick"),
              tickLabelStyle: { fontSize: 11 },
            },
          ]}
          yAxis={[{ valueFormatter: axisMoney, width: 48 }]}
          series={[
            {
              id: "bandLow",
              data: low,
              stack: "band",
              area: true,
              showMark: false,
              curve: "linear",
              color: "transparent",
              valueFormatter: () => null,
            },
            {
              id: "band",
              label: "Likely range",
              data: band,
              stack: "band",
              area: true,
              showMark: false,
              curve: "linear",
              color: `${color}33`,
              valueFormatter: (_v, ctx) => range(ctx.dataIndex),
            },
            {
              id: "actual",
              label: "Actual",
              data: actual,
              color: c.expense,
              valueFormatter: money,
              showMark: periods.length <= 24,
              curve: "linear",
            },
            {
              id: "fc",
              label: "Forecast",
              data: fcLine,
              color,
              valueFormatter: (v, ctx) =>
                ctx.dataIndex < past.length ? null : money(v),
              showMark: true,
              curve: "linear",
            },
          ]}
          sx={{
            '& [data-series="bandLow"]': { display: "none" },
            '& .MuiLineElement-root[data-series="band"]': { display: "none" },
            '& [data-series="fc"]': { strokeDasharray: "5 4" },
            "& .MuiMarkElement-root": { r: 2.5 },
          }}
        />
      </div>
    </div>
  );
}

/* ---------------- Weekday ---------------- */

export function WeekdayChart({
  data,
  flow,
}: {
  data: ExploreResult["weekday"];
  flow: ExploreFlow;
}) {
  const c = useChartColors();
  return (
    <div className="w-full min-w-0" role="img" aria-label="Average per weekday">
      <BarChart
        height={220}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        hideLegend
        grid={{ horizontal: true }}
        borderRadius={3}
        xAxis={[
          {
            scaleType: "band",
            data: data.map((d) => d.label),
            categoryGapRatio: 0.4,
          },
        ]}
        yAxis={[{ valueFormatter: axisMoney, width: 44 }]}
        series={[
          {
            id: "avg",
            label: "Average per day",
            data: data.map((d) => d.avgFils),
            color: flow === "income" ? c.income : c.expense,
            valueFormatter: money,
          },
        ]}
      />
    </div>
  );
}

/* ---------------- Calendar heatmap ---------------- */

/** GitHub-style grid: one column per week (Mon at top), cell shade = amount that day. */
export function CalendarHeatmap({
  from,
  to,
  daily,
  flow,
}: {
  from: string;
  to: string;
  daily: ExploreResult["daily"];
  flow: ExploreFlow;
}) {
  const c = useChartColors();
  const scroller = useRef<HTMLDivElement>(null);
  // Narrow screens scroll the grid; start at the newest weeks.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [from, to]);
  const byDay = new Map(daily.map((d) => [d.date, d.fils]));
  const max = Math.max(1, ...daily.map((d) => d.fils));
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const offset = (start.getUTCDay() + 6) % 7; // Monday = 0
  const cells: ({ date: string; fils: number } | null)[] = Array.from(
    { length: offset },
    () => null,
  );
  for (
    let d = new Date(start);
    d <= end && cells.length < 7 * 60;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const iso = d.toISOString().slice(0, 10);
    cells.push({ date: iso, fils: byDay.get(iso) ?? 0 });
  }
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const base = flow === "income" ? c.income : c.accent;
  const shade = (f: number) => {
    if (!f) return undefined;
    const t = Math.sqrt(f / max); // sqrt keeps small days visible next to rent day
    return `color-mix(in srgb, ${base} ${Math.round(15 + t * 85)}%, transparent)`;
  };

  return (
    <div className="min-w-0">
      <div ref={scroller} className="flex gap-2 overflow-x-auto pb-1">
        <div
          className="grid shrink-0 grid-rows-7 gap-[3px] pt-0 text-[10px] leading-[14px] text-ink-3"
          aria-hidden
        >
          {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((d, i) => (
            <span key={i} className="h-3.5">
              {d}
            </span>
          ))}
        </div>
        <div className="flex gap-[3px]" role="grid" aria-label="Daily amounts">
          {weeks.map((w, wi) => (
            <div key={wi} className="grid grid-rows-7 gap-[3px]" role="row">
              {Array.from({ length: 7 }, (_, di) => {
                const cell = w[di];
                if (!cell) return <span key={di} className="size-3.5" />;
                return (
                  <span
                    key={di}
                    role="gridcell"
                    title={`${cell.date}: ${cell.fils ? money(cell.fils) : "nothing"}`}
                    aria-label={`${cell.date}: ${cell.fils ? money(cell.fils) : "nothing"}`}
                    className="size-3.5 rounded-[3px] border border-line/60 bg-surface-2"
                    style={
                      cell.fils
                        ? {
                            background: shade(cell.fils),
                            borderColor: "transparent",
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div
        className="mt-2 flex items-center gap-1.5 text-xs text-ink-2"
        aria-hidden
      >
        Less
        {[0, 0.1, 0.35, 0.65, 1].map((t) => (
          <span
            key={t}
            className="size-3 rounded-[3px] border border-line/60 bg-surface-2"
            style={
              t
                ? { background: shade(t * max), borderColor: "transparent" }
                : undefined
            }
          />
        ))}
        More
      </div>
    </div>
  );
}
