import type { ReactNode } from "react";
import { Logo, LogoMark } from "@/components/shell/Logo";

/** Split auth layout: plain form panel on the left, quiet navy product panel on the right (≥1024px). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <main className="flex min-w-0 flex-col px-4 py-6 sm:px-8 lg:px-12">
        <Logo />
        <div className="flex flex-1 items-start justify-center pt-10 pb-6 sm:items-center sm:pt-0">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </main>
      <aside aria-label="About MyBudgetPal" className="hidden min-w-0 flex-col justify-between bg-sidebar p-12 text-sidebar-ink lg:flex">
        <LogoMark />
        <div className="max-w-md">
          <p className="text-[32px] leading-10 font-semibold text-sidebar-active">MyBudgetPal</p>
          <p className="mt-3 text-base leading-6">
            One shared ledger for a household: track spending against a monthly budget, plan debt payoff and fund savings goals.
          </p>
        </div>
        <span aria-hidden />
      </aside>
    </div>
  );
}
