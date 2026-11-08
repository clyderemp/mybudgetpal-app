"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Budget, BudgetPut } from "../types";
import { qk } from "./keys";

/** Budget for a month ("YYYY-MM"); never 404s — empty lines if none set. */
export function useBudget(month: string) {
  return useQuery({
    queryKey: qk.budgets.month(month),
    queryFn: ({ signal }) => api.get<Budget>(`/budgets/${month}`, undefined, { signal }),
    enabled: Boolean(month),
  });
}

function invalidateBudget(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.budgets.all }),
    qc.invalidateQueries({ queryKey: qk.dashboard }),
  ]);
}

export function usePutBudget(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BudgetPut) => api.put<Budget>(`/budgets/${month}`, body),
    onSuccess: () => invalidateBudget(qc),
  });
}

export function useCopyBudget(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fromMonth: string) => api.post<Budget>(`/budgets/${month}/copy-from/${fromMonth}`),
    onSuccess: () => invalidateBudget(qc),
  });
}
