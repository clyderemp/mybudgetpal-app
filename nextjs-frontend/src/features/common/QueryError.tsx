"use client";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Inline error state with a retry button for failed queries. */
export function QueryError({
  error,
  onRetry,
  title = "Couldn't load this",
  className,
}: {
  error: unknown;
  onRetry: () => unknown;
  title?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-8 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-warning">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <div className="max-w-sm">
        <p className="font-semibold text-fg">{title}</p>
        <p className="mt-1 text-sm break-words text-muted">{errorMessage(error)}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => onRetry()}>
        <RotateCw aria-hidden /> Retry
      </Button>
    </div>
  );
}
