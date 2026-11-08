"use client";
import { InlineError as KitInlineError } from "@/components/ui";

/** Compat wrapper around the kit InlineError (kept for existing imports). */
export function InlineError({
  error,
  onRetry,
  title = "Couldn't load data",
  className,
}: {
  error: unknown;
  onRetry: () => Promise<unknown> | unknown;
  title?: string;
  className?: string;
}) {
  return <KitInlineError error={error} title={title} className={className} onRetry={() => void onRetry()} />;
}
