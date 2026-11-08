"use client";
import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useCommandPalette, useShortcutLabel } from "./CommandPalette";
import { LogoMark } from "./Logo";
import { NewMenu } from "./NewMenu";
import { navItemFor, titleFor } from "./nav";
import { PeriodSelector } from "./PeriodSelector";
import { ThemeMenu } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

function Breadcrumbs() {
  const pathname = usePathname();
  const item = navItemFor(pathname);
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="hidden shrink-0 text-ink-2 lg:block">
          {item && item.href !== "/" ? (
            <Link href="/" className="rounded-chip hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
              Home
            </Link>
          ) : (
            "Home"
          )}
        </li>
        <li className="hidden shrink-0 lg:block" aria-hidden>
          <ChevronRight className="size-3.5 text-ink-3" />
        </li>
        {item && item.group !== "Settings" ? (
          <>
            <li className="shrink-0 text-ink-2">{item.group}</li>
            <li className="shrink-0" aria-hidden>
              <ChevronRight className="size-3.5 text-ink-3" />
            </li>
          </>
        ) : null}
        <li className="min-w-0 truncate font-semibold text-ink" aria-current="page">
          {item?.label ?? "MyBudgetPal"}
        </li>
      </ol>
    </nav>
  );
}

function SearchButton() {
  const open = useCommandPalette();
  const shortcut = useShortcutLabel();
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search and commands"
      aria-keyshortcuts="Meta+K Control+K"
      className={cn(
        "hidden h-8 w-56 items-center gap-2 rounded-control border border-line-strong bg-surface-2 px-2.5 text-meta text-ink-2 hover:border-ink-3 hover:text-ink lg:flex",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      <Search className="size-3.5" aria-hidden />
      <span className="flex-1 text-left">Search</span>
      <kbd className="rounded-chip border border-line bg-surface px-1.5 font-sans text-xs text-ink-2">{shortcut}</kbd>
    </button>
  );
}

/** 56px top bar. Desktop: breadcrumbs | period · search · New · theme · avatar. Phone: title · search · avatar. */
export function TopBar() {
  const pathname = usePathname();
  const item = navItemFor(pathname);
  const openPalette = useCommandPalette();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
      {/* Desktop */}
      <div className="hidden h-14 items-center gap-3 px-6 md:flex">
        <div className="min-w-0 flex-1">
          <Breadcrumbs />
        </div>
        {item?.period ? <PeriodSelector /> : null}
        <SearchButton />
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Search and commands" onClick={openPalette}>
          <Search />
        </Button>
        <NewMenu />
        <div className="mx-1 h-5 w-px bg-line" aria-hidden />
        <ThemeMenu />
        <UserMenu />
      </div>

      {/* Phone */}
      <div className="flex h-14 items-center gap-2 px-4 md:hidden">
        <Link href="/" aria-label="Dashboard" className="shrink-0 rounded-control focus-visible:outline-2 focus-visible:outline-accent">
          <LogoMark className="size-7" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{titleFor(pathname)}</h1>
        <Button variant="ghost" size="icon" aria-label="Search and commands" onClick={openPalette}>
          <Search />
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
