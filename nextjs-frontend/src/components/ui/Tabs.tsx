"use client";
import * as T from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Thin styled wrappers over Radix Tabs. */
export const Tabs = T.Root;

export function TabsList({ className, ...rest }: ComponentProps<typeof T.List>) {
  return (
    <T.List
      className={cn("mb-5 flex max-w-full gap-4 overflow-x-auto border-b border-line [scrollbar-width:none]", className)}
      {...rest}
    />
  );
}

export function TabsTrigger({ className, ...rest }: ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "-mb-px h-10 shrink-0 border-b-2 border-transparent px-0.5 text-sm font-medium text-ink-2 hover:text-ink",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
        "data-[state=active]:border-ink data-[state=active]:font-semibold data-[state=active]:text-ink",
        className,
      )}
      {...rest}
    />
  );
}

export const TabsContent = T.Content;
