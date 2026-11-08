"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Goal, GoalContribution, GoalCreate, GoalUpdate, ListResponse } from "../types";
import { invalidatePlanning, qk, toList } from "./keys";

export function useGoals() {
  return useQuery({
    queryKey: qk.goals.all,
    queryFn: ({ signal }) => api.get<ListResponse<Goal>>("/goals", undefined, { signal }),
    select: (d) => toList(d),
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GoalCreate) => api.post<Goal>("/goals", body),
    onSuccess: () => invalidatePlanning(qc),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: GoalUpdate & { id: string }) => api.patch<Goal>(`/goals/${id}`, body),
    onSuccess: () => invalidatePlanning(qc),
  });
}

export function useArchiveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Goal>(`/goals/${id}/archive`),
    onSuccess: () => invalidatePlanning(qc),
  });
}

/** amountFils may be negative to withdraw (adjusts savedFils). */
export function useGoalContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: GoalContribution & { id: string }) => api.post<Goal>(`/goals/${id}/contributions`, body),
    onSuccess: () => invalidatePlanning(qc),
  });
}
