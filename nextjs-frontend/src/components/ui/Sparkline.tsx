"use client";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import { useChartColors } from "@/lib/chart-theme";

/**
 * Tiny trend line (no axes). Decorative: always pair it with the figure it summarises;
 * pass `label` to describe the trend for screen readers.
 */
export function Sparkline({
  data,
  tone = "ink",
  height = 32,
  label,
  area = false,
  className,
}: {
  data: number[];
  tone?: "ink" | "accent" | "danger" | "muted";
  height?: number;
  label?: string;
  area?: boolean;
  className?: string;
}) {
  const c = useChartColors();
  const color = tone === "accent" ? c.accent : tone === "danger" ? c.danger : tone === "muted" ? c.ink3 : c.expense;
  if (data.length < 2) return <div style={{ height }} className={className} aria-hidden />;
  return (
    <div className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <SparkLineChart
        data={data}
        height={height}
        color={color}
        curve="linear"
        area={area}
        margin={{ top: 3, bottom: 3, left: 2, right: 2 }}
        disableClipping
      />
    </div>
  );
}
