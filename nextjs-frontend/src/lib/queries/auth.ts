"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { AvatarChoice } from "../avatars";
import { api, markLoggingOut } from "../api";
import type {
  AuthStatus,
  AuthUserResponse,
  JoinRequest,
  LoginRequest,
  MeResponse,
  PasswordChange,
  ProfileUpdate,
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

/** Update your own name / avatar; the new user lands in the cached /auth/me. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileUpdate) => api.patch<AuthUserResponse>("/auth/me", body),
    onSuccess: ({ user }) => {
      qc.setQueryData<MeResponse>(qk.me, (prev) =>
        prev
          ? { user, household: { ...prev.household, members: prev.household.members.map((m) => (m.id === user.id ? user : m)) } }
          : prev,
      );
    },
  });
}

/** Change password. The API signs out every other device and re-issues this one's cookies. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: PasswordChange) => api.post<AuthUserResponse>("/auth/password", body),
  });
}

/** Household members' avatars, looked up by user id (preferred) or display name. */
export function useMemberAvatars() {
  const me = useMe();
  return useMemo(() => {
    const byId = new Map<string, AvatarChoice>();
    const byName = new Map<string, AvatarChoice>();
    for (const m of me.data?.household.members ?? []) {
      const choice = { style: m.avatarStyle, seed: m.avatarSeed };
      byId.set(m.id, choice);
      byName.set(m.name, choice);
    }
    return (userId?: string | null, name?: string | null): AvatarChoice | null =>
      (userId ? byId.get(userId) : undefined) ?? (name ? byName.get(name) : undefined) ?? null;
  }, [me.data]);
}
