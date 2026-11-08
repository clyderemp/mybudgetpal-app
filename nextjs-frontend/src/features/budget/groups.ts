import type { CategoryGroup } from "@/lib/types";

export const GROUP_ORDER: CategoryGroup[] = ["essentials", "lifestyle", "debt", "savings", "other", "income"];

export const GROUP_LABEL: Record<CategoryGroup, string> = {
  essentials: "Essentials",
  lifestyle: "Lifestyle",
  debt: "Debt",
  savings: "Savings",
  income: "Income",
  other: "Other",
};

export function groupBy<T extends { group: CategoryGroup }>(items: T[]): [CategoryGroup, T[]][] {
  const map = new Map<CategoryGroup, T[]>();
  for (const it of items) {
    const g = GROUP_ORDER.includes(it.group) ? it.group : "other";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(it);
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)!]);
}
