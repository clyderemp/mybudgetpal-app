import type { Delta, Tone } from "@/components/ui/StatTile";
import { addMonths, formatMonth } from "@/lib/dates";
import { formatFils, formatPercent } from "@/lib/money";
import type { FinancialHealth, MonthlySeriesPoint } from "@/lib/types";

/** "vs Oct" — short comparison context for the month before `month`. */
export function vsContext(month: string) {
  return `vs ${formatMonth(addMonths(month, -1)).split(" ")[0]}`;
}

/** Delta for a fils value vs previous month. `higherIsGood` decides the tone (never danger). */
export function filsDelta(delta: number | null | undefined, higherIsGood: boolean, month: string): Delta | undefined {
  if (delta === null || delta === undefined) return undefined;
  const context = vsContext(month);
  if (delta === 0) return { label: "No change", tone: "neutral", direction: "flat", context };
  const good = higherIsGood ? delta > 0 : delta < 0;
  return {
    label: formatFils(Math.abs(delta), "AED", { noDecimals: true }),
    tone: (good ? "positive" : "warning") as Tone,
    direction: delta > 0 ? "up" : "down",
    context,
  };
}

/** Delta for a ratio (savings rate) in percentage points. */
export function rateDelta(delta: number | null | undefined, month: string): Delta | undefined {
  if (delta === null || delta === undefined) return undefined;
  const context = vsContext(month);
  if (Math.abs(delta) < 0.0005) return { label: "No change", tone: "neutral", direction: "flat", context };
  return {
    label: `${Math.abs(delta * 100).toFixed(1)} pts`,
    tone: delta > 0 ? "positive" : "warning",
    direction: delta > 0 ? "up" : "down",
    context,
  };
}

export function savingsRateLabel(rate: number | null | undefined) {
  return rate === null || rate === undefined ? "—" : formatPercent(rate, 1);
}

/** Signed AED figure for KPI cells, with a true minus sign. */
export function signedAed(fils: number | null | undefined) {
  return formatFils(fils, "AED", { noDecimals: true, signed: true }).replace(/^-/, "−");
}

/** `count` trend points ending at `month` (inclusive), oldest → newest. Empty when `month`
 *  isn't in the series (never substitutes other months). Request trends with `end: month`. */
export function seriesEndingAt(points: MonthlySeriesPoint[] | undefined, month: string, count = 6) {
  if (!points?.length) return [];
  const end = points.findIndex((p) => p.month === month);
  if (end === -1) return [];
  return points.slice(Math.max(0, end + 1 - count), end + 1);
}

/** Savings rate per month, clamped to 0–100% like the tile (backend analytics/summary.py). */
export function savingsRateSeries(points: MonthlySeriesPoint[]) {
  return points.map((p) => (p.incomeFils > 0 ? Math.max(0, Math.min(1, p.netFils / p.incomeFils)) : 0));
}

/** Calendar days from `a` to `b` (both YYYY-MM-DD). */
export function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/* ---------------- Financial health ---------------- */

/** True once there's any income/expense data behind the score (otherwise it's just defaults). */
export function hasHealthData(h: FinancialHealth) {
  return h.savingsRate !== null || h.emergencyFundMonths !== null || h.debtToIncome !== null;
}

export function scoreBand(score: number): { label: string; tone: Tone } {
  if (score >= 70) return { label: "Healthy", tone: "positive" };
  if (score >= 40) return { label: "Fair", tone: "neutral" };
  // Red is reserved for overspend/debt; a low score is a caution.
  return { label: "Needs attention", tone: "warning" };
}

export interface HealthComponent {
  key: string;
  label: string;
  weight: number;
  /** Points earned (null when it can't be derived on the client). */
  points: number | null;
  value: string;
  target: string;
}

/**
 * Component points, mirroring backend analytics/health.py (savings 35, emergency fund 35,
 * debt-to-income 30). A null metric is scored all-or-nothing by the backend (emergency fund:
 * full if there is liquid money; DTI: full if there is no debt), so each unknown component is
 * either 0 or its full weight: pick the combination whose total matches the score.
 */
export function healthComponents(h: FinancialHealth): HealthComponent[] {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const sr = h.savingsRate;
  const ef = h.emergencyFundMonths;
  const dti = h.debtToIncome;
  const rows: HealthComponent[] = [
    {
      key: "savings",
      label: "Savings rate",
      weight: 35,
      points: 35 * clamp((sr ?? 0) / 0.2),
      value: sr === null ? "No income" : formatPercent(sr),
      target: "Target 20% or more",
    },
    {
      key: "emergency",
      label: "Emergency fund",
      weight: 35,
      points: ef === null ? null : 35 * clamp(ef / 6),
      value: ef === null ? "No expenses" : `${ef.toFixed(1)} months`,
      target: "Target 6 months of expenses",
    },
    {
      key: "dti",
      label: "Debt-to-income",
      weight: 30,
      points: dti === null ? null : 30 * clamp((0.5 - dti) / 0.4),
      value: dti === null ? "No income" : formatPercent(dti),
      target: "Minimum payments at most 10% of income",
    },
  ];
  const unknown = rows.filter((r) => r.points === null);
  if (unknown.length > 0) {
    const rest = h.score - rows.reduce((s, r) => s + (r.points ?? 0), 0);
    let best = 0;
    let bestGap = Infinity;
    for (let mask = 0; mask < 1 << unknown.length; mask++) {
      const total = unknown.reduce((s, r, i) => s + (mask & (1 << i) ? r.weight : 0), 0);
      const gap = Math.abs(total - rest);
      if (gap < bestGap) [best, bestGap] = [mask, gap];
    }
    unknown.forEach((r, i) => (r.points = best & (1 << i) ? r.weight : 0));
  }
  return rows;
}
