"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DebtsTab } from "./DebtsTab";
import { GoalsTab } from "./GoalsTab";
import { PayoffTab } from "./PayoffTab";

type Tab = "payoff" | "debts" | "goals";
const TABS: { value: Tab; label: string }[] = [
  { value: "payoff", label: "Payoff plan" },
  { value: "debts", label: "Debts" },
  { value: "goals", label: "Savings goals" },
];

function parseTab(v: string | null): Tab {
  return v === "goals" || v === "debts" ? v : "payoff";
}

export function PlanView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = parseTab(params.get("tab"));

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", t);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <>
      <PageHeader title="Plan" description="Pay down debt in the cheapest order and fund your savings goals." />
      <SegmentedControl<Tab> aria-label="Plan section" fullWidth className="mb-5 sm:inline-flex sm:w-auto sm:[&>button]:flex-none sm:[&>button]:px-4" value={tab} onChange={setTab} options={TABS} />
      <div role="region" aria-label={TABS.find((t) => t.value === tab)?.label}>
        {tab === "debts" ? <DebtsTab /> : tab === "goals" ? <GoalsTab /> : <PayoffTab onGoToDebts={() => setTab("debts")} />}
      </div>
    </>
  );
}
