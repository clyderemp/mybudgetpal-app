"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Debt, DebtCreate, DebtPayment, DebtUpdate, ListResponse } from "../types";
import { invalidateMoney, invalidatePlanning, qk, toList } from "./keys";

export function useDebts() {
  return useQuery({
    queryKey: qk.debts.all,
    queryFn: ({ signal }) => api.get<ListResponse<Debt>>("/debts", undefined, { signal }),
    select: (d) => toList(d),
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DebtCreate) => api.post<Debt>("/debts", body),
    onSuccess: () => invalidatePlanning(qc),
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: DebtUpdate & { id: string }) => api.patch<Debt>(`/debts/${id}`, body),
    onSuccess: () => invalidatePlanning(qc),
  });
}

export function useArchiveDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Debt>(`/debts/${id}/archive`),
    onSuccess: () => invalidatePlanning(qc),
  });
}

/**
 * Records a payment and reduces the balance. For a debt linked to an account the backend records a
 * transfer from the paying account to the linked account; otherwise a "Debt payment" expense.
 */
export function useDebtPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: DebtPayment & { id: string }) => api.post<unknown>(`/debts/${id}/payments`, body),
    onSuccess: () => Promise.all([invalidatePlanning(qc), invalidateMoney(qc)]),
  });
}
