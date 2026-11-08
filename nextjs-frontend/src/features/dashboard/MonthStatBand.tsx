"use client";
import { StatBand, StatBandItem } from "@/components/ui";
import { formatMonth } from "@/lib/dates";
import { formatFils } from "@/lib/money";
import type { InsightsSummary, MonthlySeriesPoint } from "@/lib/types";
import { filsDelta, rateDelta, savingsRateLabel, savingsRateSeries, seriesEndingAt, signedAed } from "./format";

/** Income | Expenses | Net | Savings rate for `month`, with 6-month sparklines. Shared with Insights. */
export function MonthStatBand({
  month,
  summary,
  trends,
  loading,
}: {
  month: string;
  summary?: InsightsSummary;
  trends?: MonthlySeriesPoint[];
  loading?: boolean;
}) {
  const six = seriesEndingAt(trends, month, 6);
  const label = formatMonth(month, true);
  const s = summary;
  return (
    <StatBand aria-label={`Summary for ${label}`}>
      <StatBandItem
        label="Income"
        loading={loading}
        value={formatFils(s?.incomeFils, "AED", { noDecimals: true })}
        delta={filsDelta(s?.deltas?.incomeFils, true, month)}
        spark={six.map((p) => p.incomeFils)}
        sparkTone="accent"
        sparkLabel="Income, last 6 months"
      />
      <StatBandItem
        label="Expenses"
        loading={loading}
        value={formatFils(s?.expenseFils, "AED", { noDecimals: true })}
        delta={filsDelta(s?.deltas?.expenseFils, false, month)}
        spark={six.map((p) => p.expenseFils)}
        sparkTone="ink"
        sparkLabel="Expenses, last 6 months"
      />
      <StatBandItem
        label="Net"
        loading={loading}
        tone={(s?.netFils ?? 0) < 0 ? "negative" : "neutral"}
        value={signedAed(s?.netFils)}
        delta={filsDelta(s?.deltas?.netFils, true, month)}
        spark={six.map((p) => p.netFils)}
        sparkTone="ink"
        sparkLabel="Net, last 6 months"
      />
      <StatBandItem
        label="Savings rate"
        loading={loading}
        value={savingsRateLabel(s?.savingsRate)}
        delta={rateDelta(s?.deltas?.savingsRate, month)}
        hint={s && s.savingsRate === null ? "No income recorded" : undefined}
        spark={savingsRateSeries(six)}
        sparkTone="muted"
        sparkLabel="Savings rate, last 6 months"
      />
    </StatBand>
  );
}
