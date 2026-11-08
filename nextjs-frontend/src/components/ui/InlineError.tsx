"use client";
import { AlertCircle } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

/** Inline query failure: what happened + how to fix (Retry). */
export function InlineError({
  error,
  title = "Couldn't load this data",
  onRetry,
  retrying,
  className,
}: {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const message = error ? errorMessage(error, "").replace(/\.$/, "") : "";
  return (
    <div role="alert" className={cn("flex items-start gap-3 rounded-container border border-line bg-surface p-4", className)}>
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-meta text-ink-2">
          {message ? `${message}. ` : ""}Check your connection and try again.
        </p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
