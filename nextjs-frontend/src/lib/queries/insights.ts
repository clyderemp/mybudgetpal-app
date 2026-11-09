"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { Anomaly, FinancialHealth, Forecast, InsightsSummary, MonthlySeriesPoint } from "../types";
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
