"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { CompareResult, PayoffResult, Plan, PlanPut, Strategy } from "../types";
import { invalidatePlanning, qk } from "./keys";

export function usePlan() {
  return useQuery({
    queryKey: qk.plan.settings,
    queryFn: ({ signal }) => api.get<Plan>("/plan", undefined, { signal }),
  });
}

export function usePutPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PlanPut) => api.put<Plan>("/plan", body),
    onSuccess: () => invalidatePlanning(qc),
  });
}

/** simulate_payoff for current debts. Omitted params default to the saved plan. */
export function usePayoff(params: { strategy?: Strategy; monthlyBudgetFils?: number } = {}) {
  return useQuery({
    queryKey: qk.plan.payoff(params.strategy, params.monthlyBudgetFils),
    queryFn: ({ signal }) => api.get<PayoffResult>("/plan/payoff", { ...params }, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useCompare(params: { monthlyBudgetFils?: number } = {}) {
  return useQuery({
    queryKey: qk.plan.compare(params.monthlyBudgetFils),
    queryFn: ({ signal }) => api.get<CompareResult>("/plan/compare", { ...params }, { signal }),
    placeholderData: keepPreviousData,
  });
}
