"use client";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { AvatarStack } from "@/components/ui/Avatar";
import { Tip } from "@/components/ui/Tooltip";
import { LogoMark } from "./Logo";
import { NAV_GROUPS, SETTINGS_ITEM, isActive, type NavItem } from "./nav";
import { SidebarUserMenu } from "./UserMenu";

function NavLink({ item, collapsed, active }: { item: NavItem; collapsed: boolean; active: boolean }) {
  const Icon = item.icon;
  return (
    <Tip content={item.label} side="right" disabled={!collapsed}>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
        className={cn(
          "relative flex h-9 items-center gap-3 rounded-control text-sm font-medium transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent",
          collapsed ? "justify-center px-0" : "px-3",
          active
            ? "bg-sidebar-active-bg text-sidebar-active before:absolute before:inset-y-2 before:-left-3 before:w-0.5 before:rounded-full before:bg-accent"
            : "text-sidebar-ink hover:bg-sidebar-active-bg/60 hover:text-sidebar-active",
        )}
      >
        <Icon className={cn("size-4 shrink-0", active ? "text-sidebar-active" : "text-sidebar-ink/80")} aria-hidden />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </Link>
    </Tip>
  );
}

/** Desktop (≥768px) dark navy sidebar: 248px, collapsible to a 64px icon rail. */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const me = useMe();
  const household = me.data?.household;
  const members = household?.members.map((m) => m.name) ?? [];

  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col bg-sidebar text-sidebar-ink transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-62",
      )}
    >
      {/* Household */}
      <div className={cn("flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-line", collapsed ? "justify-center px-0" : "px-4")}>
        <Link
          href="/"
          aria-label={`${household?.name ?? "MyBudgetPal"}, dashboard`}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control focus-visible:outline-2 focus-visible:outline-accent"
        >
          <LogoMark />
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-sidebar-active">{household?.name ?? "MyBudgetPal"}</span>
              <span className="block truncate text-xs text-sidebar-ink/80">Household</span>
            </span>
          ) : null}
        </Link>
        {!collapsed && members.length > 0 ? (
          <AvatarStack names={members} size="xs" ringClassName="ring-sidebar" className="shrink-0" />
        ) : null}
      </div>

      <nav aria-label="Main" className={cn("flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")}>
        {NAV_GROUPS.map((g, gi) => (
          <div key={g.label} className={cn(gi > 0 && "mt-4")}>
            {collapsed ? (
              gi > 0 ? <div className="mx-2 mb-3 h-px bg-sidebar-line" aria-hidden /> : null
            ) : (
              <p className="px-3 pb-1.5 text-xs font-medium text-sidebar-ink/70">{g.label}</p>
            )}
            <ul className="flex flex-col gap-0.5" aria-label={collapsed ? g.label : undefined}>
              {g.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} collapsed={collapsed} active={isActive(pathname, item.href)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("flex shrink-0 flex-col gap-0.5 border-t border-sidebar-line py-3", collapsed ? "px-2" : "px-3")}>
        <NavLink item={SETTINGS_ITEM} collapsed={collapsed} active={isActive(pathname, SETTINGS_ITEM.href)} />
        <Tip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn(
              "flex h-9 items-center gap-3 rounded-control text-sm font-medium text-sidebar-ink hover:bg-sidebar-active-bg/60 hover:text-sidebar-active",
              "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent",
              collapsed ? "justify-center" : "px-3",
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4 text-sidebar-ink/80" aria-hidden />}
            {!collapsed ? "Collapse" : null}
          </button>
        </Tip>
        <div className="mt-2 border-t border-sidebar-line pt-2">
          <SidebarUserMenu collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}
