"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, markLoggingOut } from "../api";
import type {
  AuthStatus,
  AuthUserResponse,
  JoinRequest,
  LoginRequest,
  MeResponse,
  RegisterRequest,
} from "../types";
import { qk } from "./keys";

/** Current user + household. 401 → api.ts refreshes once, then redirects to /login. */
export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: ({ signal }) => api.get<MeResponse>("/auth/me", undefined, { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useAuthStatus() {
  return useQuery({
    queryKey: qk.authStatus,
    queryFn: ({ signal }) => api.get<AuthStatus>("/auth/status", undefined, { signal, noAuthRedirect: true }),
    staleTime: 60_000,
  });
}

function useAuthMutation<TBody>(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => api.post<AuthUserResponse>(path, body, { noAuthRedirect: true }),
    onSuccess: async () => {
      qc.clear();
    },
  });
}

export const useLogin = () => useAuthMutation<LoginRequest>("/auth/login");
export const useRegister = () => useAuthMutation<RegisterRequest>("/auth/register");
export const useJoin = () => useAuthMutation<JoinRequest>("/auth/join");

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      // Stop mounted queries (useMe) from refreshing/redirecting to /login?reauth=1 mid-logout.
      markLoggingOut();
      return api.post<void>("/auth/logout", undefined, { noAuthRedirect: true });
    },
    onSettled: () => {
      // Navigate first; the full reload drops the cache. No qc.clear(): it would refetch
      // still-mounted queries (401 -> refresh -> redirect race).
      void qc.cancelQueries();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (typeof window !== "undefined") window.location.assign("/login");
    },
  });
}
