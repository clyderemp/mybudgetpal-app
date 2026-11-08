"use client";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { MoreSheet } from "./MoreSheet";
import { MORE_ITEMS, TAB_ITEMS, isActive } from "./nav";

/** Phone (<768px) bottom tabs: Dashboard, Transactions, Budget, Plan, More. */
export function BottomTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_ITEMS.some((i) => isActive(pathname, i.href));
  const tab =
    "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium " +
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
  const indicator = "before:absolute before:top-0 before:inset-x-4 before:h-0.5 before:rounded-b before:bg-ink";

  return (
    <>
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="flex h-14">
          {TAB_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href} className={cn("flex min-w-0", href === "/transactions" ? "flex-[1.35]" : "flex-1")}>
                <Link href={href} aria-current={active ? "page" : undefined} className={cn(tab, active ? cn("text-ink", indicator) : "text-ink-2")}>
                  <Icon className="size-5" aria-hidden />
                  <span className="max-w-full truncate">{label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(tab, moreActive ? cn("text-ink", indicator) : "text-ink-2")}
            >
              <MoreHorizontal className="size-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
