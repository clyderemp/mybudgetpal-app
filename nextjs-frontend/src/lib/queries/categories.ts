"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Category, CategoryCreate, CategoryUpdate, ListResponse } from "../types";
import { qk, toList } from "./keys";

export function useCategories() {
  return useQuery({
    queryKey: qk.categories.all,
    queryFn: ({ signal }) => api.get<ListResponse<Category>>("/categories", undefined, { signal }),
    select: (d) => toList(d),
    staleTime: 5 * 60_000,
  });
}

function invalidateCategories(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.categories.all }),
    qc.invalidateQueries({ queryKey: qk.budgets.all }),
  ]);
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CategoryCreate) => api.post<Category>("/categories", body),
    onSuccess: () => invalidateCategories(qc),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: CategoryUpdate & { id: string }) => api.patch<Category>(`/categories/${id}`, body),
    onSuccess: () => invalidateCategories(qc),
  });
}

export function useArchiveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Category>(`/categories/${id}/archive`),
    onSuccess: () => invalidateCategories(qc),
  });
}
