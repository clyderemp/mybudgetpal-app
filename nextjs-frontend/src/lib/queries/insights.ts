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

/** Business accounts are kept out of household figures unless `includeBusiness` (Insights toggle). */
interface BizOpt {
  includeBusiness?: boolean;
}
const bizQuery = (o?: BizOpt) => (o?.includeBusiness ? { includeBusiness: true } : {});

export function useInsightsSummary(month: string, opts?: BizOpt) {
  return useQuery({
    queryKey: qk.insights.summary(month, Boolean(opts?.includeBusiness)),
    queryFn: ({ signal }) => api.get<InsightsSummary>("/insights/summary", { month, ...bizQuery(opts) }, { signal }),
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

export function useInsightsForecast(opts?: BizOpt) {
  return useQuery({
    queryKey: qk.insights.forecast(Boolean(opts?.includeBusiness)),
    queryFn: ({ signal }) => api.get<Forecast>("/insights/forecast", bizQuery(opts), { signal }),
  });
}

export function useInsightsAnomalies(month: string, opts?: BizOpt) {
  return useQuery({
    queryKey: qk.insights.anomalies(month, Boolean(opts?.includeBusiness)),
    queryFn: ({ signal }) =>
      api.get<Anomaly[] | { items: Anomaly[] }>("/insights/anomalies", { month, ...bizQuery(opts) }, { signal }),
    select: (d) => toList(d),
    enabled: Boolean(month),
  });
}

export function useInsightsHealth(opts?: BizOpt) {
  return useQuery({
    queryKey: qk.insights.healthFor(Boolean(opts?.includeBusiness)),
    queryFn: ({ signal }) => api.get<FinancialHealth>("/insights/health", bizQuery(opts), { signal }),
  });
}

/** Filtered analytics for any range. Keeps the previous result on screen while filters change. */
export function useInsightsExplore(params: ExploreParams) {
  const query: Record<string, string | number | boolean> = {
    from: params.from,
    to: params.to,
    flow: params.flow,
    groupBy: params.groupBy,
  };
  if (params.granularity) query.granularity = params.granularity;
  if (params.categories?.length) query.categories = params.categories.join(",");
  if (params.accounts?.length) query.accounts = params.accounts.join(",");
  if (params.members?.length) query.members = params.members.join(",");
  if (params.merchant?.trim()) query.merchant = params.merchant.trim();
  if (params.horizon) query.horizon = params.horizon;
  if (params.includeBusiness) query.includeBusiness = true;
  return useQuery({
    queryKey: qk.insights.explore(query),
    queryFn: ({ signal }) => api.get<ExploreResult>("/insights/explore", query, { signal }),
    placeholderData: keepPreviousData,
  });
}
