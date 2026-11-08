"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ListResponse, Transaction, TransactionCreate, TransactionQuery, TransactionUpdate } from "../types";
import { invalidateMoney, qk } from "./keys";

/** Paginated transactions → {items, total}. Previous page data kept while fetching. */
export function useTransactions(query: TransactionQuery = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.transactions.list(query),
    queryFn: ({ signal }) =>
      api.get<ListResponse<Transaction>>("/transactions", { ...query }, { signal }),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TransactionCreate) => api.post<Transaction>("/transactions", body),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: TransactionUpdate & { id: string }) =>
      api.patch<Transaction>(`/transactions/${id}`, body),
    onSuccess: () => invalidateMoney(qc),
  });
}

/** Soft delete (204). */
export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => invalidateMoney(qc),
  });
}
