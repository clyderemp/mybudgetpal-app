"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type {
  Anomaly,
  ExploreParams,
  ExploreResult,
  FinancialHealth,
  Forecast,
  InsightsSummary,
  MonthlySeriesPoint,
} from "../types";
import { qk, toList } from "./keys";

export function useInsightsSummary(month: string) {
  return useQuery({
    queryKey: qk.insights.summary(month),
    queryFn: ({ signal }) => api.get<InsightsSummary>("/insights/summary", { month }, { signal }),
    enabled: Boolean(month),
  });
}

/** Zero-filled monthly series, oldest → newest, ending at `end` (YYYY-MM; default current month). */
export function useInsightsTrends(months = 12, end?: string) {
  return useQuery({
    queryKey: qk.insights.trends(months, end),
    queryFn: ({ signal }) =>
      api.get<MonthlySeriesPoint[] | { items: MonthlySeriesPoint[] }>(
        "/insights/trends",
        end ? { months, end } : { months },
        { signal },
      ),
    select: (d) => toList(d),
  });
}

export function useInsightsForecast() {
  return useQuery({
    queryKey: qk.insights.forecast,
    queryFn: ({ signal }) => api.get<Forecast>("/insights/forecast", undefined, { signal }),
  });
}

export function useInsightsAnomalies(month: string) {
  return useQuery({
    queryKey: qk.insights.anomalies(month),
    queryFn: ({ signal }) => api.get<Anomaly[] | { items: Anomaly[] }>("/insights/anomalies", { month }, { signal }),
    select: (d) => toList(d),
    enabled: Boolean(month),
  });
}

export function useInsightsHealth() {
  return useQuery({
    queryKey: qk.insights.health,
    queryFn: ({ signal }) => api.get<FinancialHealth>("/insights/health", undefined, { signal }),
  });
}

/** Filtered analytics for any range. Keeps the previous result on screen while filters change. */
export function useInsightsExplore(params: ExploreParams) {
  const query: Record<string, string | number> = { from: params.from, to: params.to, flow: params.flow, groupBy: params.groupBy };
  if (params.granularity) query.granularity = params.granularity;
  if (params.categories?.length) query.categories = params.categories.join(",");
  if (params.accounts?.length) query.accounts = params.accounts.join(",");
  if (params.members?.length) query.members = params.members.join(",");
  if (params.merchant?.trim()) query.merchant = params.merchant.trim();
  if (params.horizon) query.horizon = params.horizon;
  return useQuery({
    queryKey: qk.insights.explore(query),
    queryFn: ({ signal }) => api.get<ExploreResult>("/insights/explore", query, { signal }),
    placeholderData: keepPreviousData,
  });
}
