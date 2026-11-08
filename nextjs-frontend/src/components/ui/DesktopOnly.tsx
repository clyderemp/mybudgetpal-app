"use client";
import type { ReactNode } from "react";
import { useIsDesktop } from "@/features/transactions/useMediaQuery";

/**
 * Mounts its children only at ≥768px. Use around MUI DataGrid tables that have a phone list
 * alternative: a grid inside a `display:none` wrapper measures 0px wide and logs MUI X errors.
 */
export function DesktopOnly({ children, className }: { children: ReactNode; className?: string }) {
  const isDesktop = useIsDesktop();
  if (!isDesktop) return null;
  return <div className={className}>{children}</div>;
}
