"use client";
import type { CSSProperties, ReactNode } from "react";
import { PeriodProvider } from "@/lib/period";
import { TransactionDialogProvider } from "@/components/transactions/TransactionDialogProvider";
import { AddTransactionFab } from "./AddTransactionFab";
import { BottomTabBar } from "./BottomTabBar";
import { CommandPaletteProvider } from "./CommandPalette";
import { CreateProvider } from "./CreateProvider";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useMediaQuery } from "@/features/transactions/useMediaQuery";
import { useSidebarCollapsed } from "./useSidebarCollapsed";

/**
 * Desktop: dark sidebar (248px / 64px rail) + 56px top bar + content (24px gutter).
 * Tablet (768–1023px): the sidebar stays the 64px rail so the top bar and content keep their room.
 * Phone (<768px): compact top bar + bottom tabs + FAB (16px gutter).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  // false during SSR, so desktop renders expanded first and only tablets switch to the rail.
  const isTablet = useMediaQuery("(max-width: 1023.98px)");
  const rail = collapsed || isTablet;
  return (
    <PeriodProvider>
      <TransactionDialogProvider>
        <CreateProvider>
          <CommandPaletteProvider>
            <a
              href="#main"
              className="sr-only z-[90] rounded-control bg-ink px-3 py-2 text-ink-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
            >
              Skip to content
            </a>
            <Sidebar collapsed={rail} canToggle={!isTablet} onToggle={() => setCollapsed(!collapsed)} />
            <div
              style={{ "--sidebar-w": rail ? "4rem" : "15.5rem" } as CSSProperties}
              className="min-h-dvh min-w-0 transition-[padding] duration-200 md:pl-[var(--sidebar-w)]"
            >
              <TopBar />
              <main id="main" tabIndex={-1} className="min-w-0 pb-[calc(6rem+env(safe-area-inset-bottom))] focus:outline-none md:pb-10">
                <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 md:px-6 md:pt-6">{children}</div>
              </main>
            </div>
            <AddTransactionFab />
            <BottomTabBar />
          </CommandPaletteProvider>
        </CreateProvider>
      </TransactionDialogProvider>
    </PeriodProvider>
  );
}
