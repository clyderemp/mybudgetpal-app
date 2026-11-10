import {
  ArrowLeftRight,
  CalendarClock,
  FileUp,
  Landmark,
  LayoutDashboard,
  LineChart,
  PieChart,
  Settings,
  Target,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Group label (breadcrumb root). */
  group: NavGroupLabel;
  /** Shows the global month selector in the top bar. */
  period?: boolean;
}

export type NavGroupLabel = "Overview" | "Money" | "Planning" | "Settings";

export const NAV_GROUPS: { label: Exclude<NavGroupLabel, "Settings">; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, group: "Overview", period: true },
      { href: "/insights", label: "Insights", icon: LineChart, group: "Overview" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, group: "Money", period: true },
      { href: "/accounts", label: "Accounts", icon: Landmark, group: "Money" },
      { href: "/budget", label: "Budget", icon: PieChart, group: "Money", period: true },
      { href: "/bills", label: "Bills", icon: CalendarClock, group: "Money", period: true },
      { href: "/import", label: "Import statement", icon: FileUp, group: "Money" },
    ],
  },
  {
    label: "Planning",
    items: [{ href: "/plan", label: "Plan", icon: Target, group: "Planning" }],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings, group: "Settings" };

export const NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

const byHref = (h: string) => NAV_ITEMS.find((i) => i.href === h)!;

/** Phone bottom tabs (the rest live under "More"). */
export const TAB_ITEMS: NavItem[] = ["/", "/transactions", "/budget", "/plan"].map(byHref);
export const MORE_ITEMS: NavItem[] = ["/bills", "/accounts", "/insights", "/settings"].map(byHref);

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function navItemFor(pathname: string): NavItem | undefined {
  return [...NAV_ITEMS].reverse().find((n) => isActive(pathname, n.href));
}

export function titleFor(pathname: string): string {
  return navItemFor(pathname)?.label ?? "MyBudgetPal";
}
