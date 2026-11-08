"use client";
import * as T from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/** Small ink tooltip. Provider is mounted in AppProviders. */
export function Tip({
  content,
  children,
  side = "top",
  disabled,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-[80] rounded-chip bg-ink px-2 py-1 text-xs font-medium text-ink-fg shadow-pop"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
