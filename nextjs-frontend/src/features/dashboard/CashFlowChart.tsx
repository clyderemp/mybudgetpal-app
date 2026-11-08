"use client";
import { BarPlot } from "@mui/x-charts/BarChart";
import { ChartsAxisHighlight } from "@mui/x-charts/ChartsAxisHighlight";
import { ChartsDataProvider } from "@mui/x-charts/ChartsDataProvider";
import { ChartsGrid } from "@mui/x-charts/ChartsGrid";
import { ChartsSurface } from "@mui/x-charts/ChartsSurface";
import { ChartsTooltip } from "@mui/x-charts/ChartsTooltip";
import { ChartsXAxis } from "@mui/x-charts/ChartsXAxis";
import { ChartsYAxis } from "@mui/x-charts/ChartsYAxis";
import { LinePlot, MarkPlot } from "@mui/x-charts/LineChart";
import { useChartColors } from "@/lib/chart-theme";
import { formatMonth } from "@/lib/dates";
import { formatFils, formatFilsCompact } from "@/lib/money";
import type { MonthlySeriesPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Monthly cash flow: grouped bars (income, expenses) plus a net line on one money axis.
 * A data table is available for screen readers and anyone who wants exact figures.
 */
export function CashFlowChart({
  points: allPoints,
  height = 280,
  className,
}: {
  points: MonthlySeriesPoint[];
  height?: number;
  className?: string;
}) {
  const c = useChartColors();
  // Drop leading months with no activity (before the household started recording) so the
  // net line doesn't show a false jump from zero. Keep at least the last 3 months.
  const firstActive = allPoints.findIndex((p) => p.incomeFils !== 0 || p.expenseFils !== 0);
  const points = firstActive > 0 ? allPoints.slice(Math.min(firstActive, Math.max(0, allPoints.length - 3))) : allPoints;
  const months = points.map((p) => p.month);
  const money = (v: number | null) => formatFils(v ?? 0, "AED", { noDecimals: true });
  const legend = [
    { label: "Income", color: c.income, shape: "bar" },
    { label: "Expenses", color: c.expense, shape: "bar" },
    { label: "Net", color: c.net, shape: "line" },
  ] as const;

  return (
    <div className={cn("min-w-0", className)}>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Chart legend">
        {legend.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={s.shape === "bar" ? "size-2.5 rounded-[2px]" : "h-0.5 w-3 rounded-full"}
              style={{ background: s.color }}
            />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="w-full min-w-0" style={{ height }}>
        <ChartsDataProvider
          height={height}
          margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
          xAxis={[
            {
              id: "month",
              scaleType: "band",
              data: months,
              categoryGapRatio: 0.35,
              barGapRatio: 0.12,
              valueFormatter: (m: string, ctx) =>
                ctx.location === "tick" ? formatMonth(m).split(" ")[0] : formatMonth(m, true),
              tickLabelStyle: { fontSize: 12 },
            },
          ]}
          yAxis={[{ id: "money", valueFormatter: (v: number) => formatFilsCompact(v).replace("AED ", ""), width: 44 }]}
          series={[
            { type: "bar", id: "income", label: "Income", data: points.map((p) => p.incomeFils), color: c.income, valueFormatter: money },
            { type: "bar", id: "expense", label: "Expenses", data: points.map((p) => p.expenseFils), color: c.expense, valueFormatter: money },
            {
              type: "line",
              id: "net",
              label: "Net",
              data: points.map((p) => p.netFils),
              color: c.net,
              curve: "linear",
              showMark: true,
              valueFormatter: (v: number | null) => formatFils(v ?? 0, "AED", { noDecimals: true, signed: true }),
            },
          ]}
        >
          <ChartsSurface
            aria-label="Monthly income, expenses and net"
            sx={{
              "& .MuiLineElement-root": { strokeWidth: 2 },
              "& .MuiMarkElement-root": { r: 2.5, fill: c.surface, strokeWidth: 1.5 },
            }}
          >
            <ChartsGrid horizontal />
            <BarPlot borderRadius={2} />
            <LinePlot />
            <MarkPlot />
            <ChartsXAxis axisId="month" disableTicks />
            <ChartsYAxis axisId="money" disableLine disableTicks />
            <ChartsAxisHighlight x="band" />
          </ChartsSurface>
          <ChartsTooltip trigger="axis" />
        </ChartsDataProvider>
      </div>
      <details className="mt-3 text-meta">
        <summary className="w-fit cursor-pointer rounded-chip text-ink-2 hover:text-ink">Show figures as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="tabular w-full min-w-[18rem] text-left text-xs">
            <caption className="sr-only">Monthly income, expenses and net in AED</caption>
            <thead className="text-ink-2">
              <tr className="border-b border-line">
                <th scope="col" className="py-1.5 font-medium">Month</th>
                <th scope="col" className="py-1.5 text-right font-medium">Income</th>
                <th scope="col" className="py-1.5 text-right font-medium">Expenses</th>
                <th scope="col" className="py-1.5 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.month} className="border-b border-line last:border-0">
                  <th scope="row" className="py-1.5 font-normal text-ink">{formatMonth(p.month)}</th>
                  <td className="py-1.5 text-right text-ink">{formatFils(p.incomeFils, "AED", { noDecimals: true, hideCurrency: true })}</td>
                  <td className="py-1.5 text-right text-ink">{formatFils(p.expenseFils, "AED", { noDecimals: true, hideCurrency: true })}</td>
                  <td className={cn("py-1.5 text-right", p.netFils < 0 ? "text-danger" : "text-ink")}>
                    {formatFils(p.netFils, "AED", { noDecimals: true, hideCurrency: true, signed: true }).replace(/^-/, "−")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
