"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { HouseholdUpdate, Invite, InviteSummary } from "../types";
import { qk } from "./keys";

export function useUpdateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: HouseholdUpdate) => api.patch<unknown>("/household", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

/** Returns the plain invite code once — show it to the user immediately. */
export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Invite>("/household/invites"),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invites }),
  });
}

/** Outstanding (unused, unexpired) invites. Owner only — pass enabled=false for members. */
export function useInvites(enabled = true) {
  return useQuery({
    queryKey: qk.invites,
    queryFn: ({ signal }) => api.get<InviteSummary[]>("/household/invites", undefined, { signal }),
    enabled,
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/household/invites/${encodeURIComponent(id)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invites }),
  });
}
