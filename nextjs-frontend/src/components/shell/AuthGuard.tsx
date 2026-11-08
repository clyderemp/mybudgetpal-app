"use client";
import type { ReactNode } from "react";
import { isApiError } from "@/lib/api";
import { useMe } from "@/lib/queries";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Renders children only once /auth/me succeeds. On 401 api.ts refreshes once and
 * otherwise redirects to /login (we show the loader meanwhile).
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const me = useMe();

  if (me.isSuccess) return <>{children}</>;

  if (me.isError && !(isApiError(me.error) && me.error.status === 401)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-base font-semibold">Couldn&apos;t load your household</p>
        <p className="max-w-sm text-meta text-ink-2">
          {me.error instanceof Error ? `${me.error.message.replace(/\.$/, "")}. ` : ""}Check that the server is reachable, then try again.
        </p>
        <Button onClick={() => me.refetch()} loading={me.isFetching}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div role="status" aria-label="Loading" className="flex min-h-dvh">
      <div className="hidden w-62 bg-sidebar md:block" />
      <div className="flex-1">
        <div className="h-14 border-b border-line bg-surface" />
        <div className="space-y-4 p-4 md:p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-32 rounded-container" />
          <Skeleton className="h-64 rounded-container" />
        </div>
      </div>
    </div>
  );
}
