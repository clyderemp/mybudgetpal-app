"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Account, AccountCreate, AccountUpdate, ListResponse } from "../types";
import { invalidateMoney, qk, toList } from "./keys";

/** Active (non-archived) accounts, each with computed balanceFils. */
export function useAccounts() {
  return useQuery({
    queryKey: qk.accounts.all,
    queryFn: ({ signal }) => api.get<ListResponse<Account>>("/accounts", undefined, { signal }),
    select: (d) => toList(d),
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AccountCreate) => api.post<Account>("/accounts", body),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: AccountUpdate & { id: string }) => api.patch<Account>(`/accounts/${id}`, body),
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useArchiveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Account>(`/accounts/${id}/archive`),
    onSuccess: () => invalidateMoney(qc),
  });
}
