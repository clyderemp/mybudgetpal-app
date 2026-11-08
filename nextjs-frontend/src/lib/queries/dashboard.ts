"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { Dashboard } from "../types";
import { qk } from "./keys";

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: ({ signal }) => api.get<Dashboard>("/dashboard", undefined, { signal }),
  });
}
