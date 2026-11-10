"use client";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  Bill,
  BillCreate,
  BillsMonth,
  BillsOverview,
  BillSuggestion,
  BillUpdate,
  IncomeStream,
  IncomeStreamCreate,
  IncomeStreamUpdate,
  ListResponse,
  Transaction,
} from "../types";
import { qk, toList } from "./keys";

/** Bills feed the checklist, the dashboard panels, the budget's zero-based plan and the stored links. */
function invalidateBills(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.bills.all }),
    qc.invalidateQueries({ queryKey: qk.budgets.all }),
    qc.invalidateQueries({ queryKey: qk.transactions.all }),
  ]);
}

export function useBills() {
  return useQuery({
    queryKey: qk.bills.list,
    queryFn: ({ signal }) => api.get<ListResponse<Bill>>("/bills", undefined, { signal }),
    select: (d) => toList(d),
  });
}

/** Checklist for a month: bills due and income expected, with status and matched transactions. */
export function useBillsMonth(month: string) {
  return useQuery({
    queryKey: qk.bills.month(month),
    queryFn: ({ signal }) => api.get<BillsMonth>(`/bills/month/${month}`, undefined, { signal }),
    enabled: Boolean(month),
  });
}

export function useBillsOverview() {
  return useQuery({
    queryKey: qk.bills.overview,
    queryFn: ({ signal }) => api.get<BillsOverview>("/bills/overview", undefined, { signal }),
  });
}

export function useBillSuggestions(enabled = true) {
  return useQuery({
    queryKey: qk.bills.suggestions,
    queryFn: ({ signal }) => api.get<ListResponse<BillSuggestion>>("/bills/suggestions", undefined, { signal }),
    select: (d) => toList(d),
    enabled,
  });
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BillCreate) => api.post<Bill>("/bills", body),
    onSuccess: () => invalidateBills(qc),
  });
}

export function useUpdateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: BillUpdate & { id: string }) => api.patch<Bill>(`/bills/${id}`, body),
    onSuccess: () => invalidateBills(qc),
  });
}

export function useArchiveBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Bill>(`/bills/${id}/archive`),
    onSuccess: () => invalidateBills(qc),
  });
}

export function useSkipBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, month, skipped }: { id: string; month: string; skipped: boolean }) =>
      api.post<Bill>(`/bills/${id}/skip`, { month, skipped }),
    onSuccess: () => invalidateBills(qc),
  });
}

export function useLinkBillTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, transactionId }: { id: string; transactionId: string }) =>
      api.post<Transaction>(`/bills/${id}/links`, { transactionId }),
    onSuccess: () => invalidateBills(qc),
  });
}

export function useUnlinkBillTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, transactionId }: { id: string; transactionId: string }) => api.delete(`/bills/${id}/links/${transactionId}`),
    onSuccess: () => invalidateBills(qc),
  });
}

/* ---------------- Expected income ---------------- */

export function useIncomeStreams() {
  return useQuery({
    queryKey: qk.bills.income,
    queryFn: ({ signal }) => api.get<ListResponse<IncomeStream>>("/income-streams", undefined, { signal }),
    select: (d) => toList(d),
  });
}

export function useCreateIncomeStream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: IncomeStreamCreate) => api.post<IncomeStream>("/income-streams", body),
    onSuccess: () => invalidateBills(qc),
  });
}

export function useUpdateIncomeStream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: IncomeStreamUpdate & { id: string }) => api.patch<IncomeStream>(`/income-streams/${id}`, body),
    onSuccess: () => invalidateBills(qc),
  });
}

export function useArchiveIncomeStream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<IncomeStream>(`/income-streams/${id}/archive`),
    onSuccess: () => invalidateBills(qc),
  });
}
