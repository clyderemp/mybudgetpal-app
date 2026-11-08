"use client";
import { LineChart, lineClasses } from "@mui/x-charts/LineChart";
import { CHART_DEFAULTS, filsAxisFormatter, useChartColors } from "@/lib/chart-theme";
import { formatMonth } from "@/lib/dates";
import { formatFils } from "@/lib/money";
import type { Debt, PayoffScheduleEntry } from "@/lib/types";

const NOW = "now";

/** Remaining balance per debt over time, stacked (top edge = total debt). */
export function PayoffChart({ schedule, debts, order }: { schedule: PayoffScheduleEntry[]; debts: Debt[]; order: string[] }) {
  const c = useChartColors();
  const months = [NOW, ...schedule.map((s) => s.month)];
  const step = Math.max(1, Math.ceil(months.length / 7));
  const last = months.length - 1;
  const byId = new Map(debts.map((d) => [d.id, d]));
  // Stack in payoff order so the first debt cleared sits at the bottom.
  const ids = [...order.filter((id) => byId.has(id)), ...debts.map((d) => d.id).filter((id) => !order.includes(id))];

  const series = ids.map((id, i) => {
    const d = byId.get(id)!;
    const data = [d.balanceFils, ...schedule.map((s) => s.payments.find((p) => p.debtId === id)?.balanceFils ?? 0)];
    return {
      id,
      data,
      label: d.name,
      area: true,
      stack: "total",
      showMark: false,
      color: c.categorical[i % c.categorical.length],
      valueFormatter: (v: number | null) => formatFils(v ?? 0, "AED", { noDecimals: true }),
    };
  });

  return (
    <div className="h-72 w-full min-w-0 md:h-80">
      <LineChart
        {...CHART_DEFAULTS}
        margin={{ ...CHART_DEFAULTS.margin, right: 32 }}
        xAxis={[
          {
            scaleType: "point",
            data: months,
            valueFormatter: (m: string, ctx) => (m === NOW ? "Now" : ctx.location === "tick" ? formatMonth(m) : `End of ${formatMonth(m, true)}`),
            tickInterval: (_m: string, i: number) => i % step === 0 || i === last,
          },
        ]}
        yAxis={[{ valueFormatter: filsAxisFormatter, width: 64, min: 0 }]}
        series={series}
        slotProps={{ legend: { direction: "horizontal", position: { vertical: "top", horizontal: "start" } } }}
        sx={{
          [`& .${lineClasses.area}`]: { fillOpacity: 0.3 },
          [`& .${lineClasses.line}`]: { strokeWidth: 1.5 },
        }}
      />
    </div>
  );
}
