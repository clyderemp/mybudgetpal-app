import type { QueryClient } from "@tanstack/react-query";
import type { TransactionQuery } from "../types";

/** Central query keys. Prefix-match invalidation: invalidateQueries({queryKey: qk.transactions.all}). */
export const qk = {
  me: ["me"] as const,
  authStatus: ["auth", "status"] as const,
  invites: ["household", "invites"] as const,
  accounts: { all: ["accounts"] as const },
  categories: { all: ["categories"] as const },
  transactions: {
    all: ["transactions"] as const,
    list: (q: TransactionQuery) => ["transactions", "list", q] as const,
  },
  budgets: { all: ["budgets"] as const, month: (month: string) => ["budgets", month] as const },
  debts: { all: ["debts"] as const },
  goals: { all: ["goals"] as const },
  plan: {
    all: ["plan"] as const,
    settings: ["plan", "settings"] as const,
    payoff: (strategy?: string, monthlyBudgetFils?: number) => ["plan", "payoff", { strategy, monthlyBudgetFils }] as const,
    compare: (monthlyBudgetFils?: number) => ["plan", "compare", { monthlyBudgetFils }] as const,
  },
  insights: {
    all: ["insights"] as const,
    summary: (month: string) => ["insights", "summary", month] as const,
    trends: (months: number) => ["insights", "trends", months] as const,
    forecast: ["insights", "forecast"] as const,
    anomalies: (month: string) => ["insights", "anomalies", month] as const,
    health: ["insights", "health"] as const,
  },
  dashboard: ["dashboard"] as const,
};

/** After any money movement: refresh everything derived from transactions. */
export function invalidateMoney(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.transactions.all }),
    qc.invalidateQueries({ queryKey: qk.accounts.all }),
    qc.invalidateQueries({ queryKey: qk.budgets.all }),
    qc.invalidateQueries({ queryKey: qk.insights.all }),
    qc.invalidateQueries({ queryKey: qk.dashboard }),
  ]);
}

/** After debt/goal/plan changes. */
export function invalidatePlanning(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.debts.all }),
    qc.invalidateQueries({ queryKey: qk.goals.all }),
    qc.invalidateQueries({ queryKey: qk.plan.all }),
    qc.invalidateQueries({ queryKey: qk.insights.health }),
    qc.invalidateQueries({ queryKey: qk.dashboard }),
  ]);
}

/** Normalise list endpoints that may return either {items,total} or a bare array. */
export function toList<T>(data: { items: T[]; total?: number } | T[] | undefined | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : (data.items ?? []);
}
