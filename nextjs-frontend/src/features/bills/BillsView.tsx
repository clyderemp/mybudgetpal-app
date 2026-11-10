"use client";
import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PeriodSelector } from "@/components/shell/PeriodSelector";
import { Button, PageHeader, SegmentedControl } from "@/components/ui";
import { formatMonth } from "@/lib/dates";
import { usePeriod } from "@/lib/period";
import type { Bill } from "@/lib/types";
import { BillFormDialog, type BillPrefill } from "./BillFormDialog";
import { IncomeTab } from "./IncomeTab";
import { MonthTab } from "./MonthTab";
import { RecurringTab } from "./RecurringTab";

type Tab = "month" | "all" | "subscriptions" | "income";
const TABS: { value: Tab; label: string; short: string }[] = [
  { value: "month", label: "This month", short: "Month" },
  { value: "all", label: "All recurring", short: "All" },
  { value: "subscriptions", label: "Subscriptions", short: "Subs" },
  { value: "income", label: "Income", short: "Income" },
];

function parseTab(v: string | null): Tab {
  return v === "all" || v === "subscriptions" || v === "income" ? v : "month";
}

/** Shared state for the add/edit dialog so every tab (and suggestions) opens the same form. */
export type OpenBillForm = (bill: Bill | null, prefill?: BillPrefill) => void;

export function BillsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { month, isCurrent } = usePeriod();
  const tab = parseTab(params.get("tab"));
  const [form, setForm] = useState<{ bill: Bill | null; prefill?: BillPrefill } | null>(null);
  const openForm: OpenBillForm = (bill, prefill) => setForm({ bill, prefill });

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params.toString());
    if (t === "month") next.delete("tab");
    else next.set("tab", t);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const tabs = TABS.map((t) => (t.value === "month" && !isCurrent ? { ...t, label: formatMonth(month) } : t));

  return (
    <>
      <PageHeader
        title="Bills"
        description="Set monthly payments, subscriptions and instalments, and the income they're paid from."
        actions={
          <>
            {tab === "month" ? <PeriodSelector className="md:hidden" /> : null}
            <Button onClick={() => openForm(null)}>
              <Plus aria-hidden /> Add recurring payment
            </Button>
          </>
        }
      />
      <SegmentedControl<Tab>
        aria-label="Bills section"
        fullWidth
        className="mb-5 sm:inline-flex sm:w-auto sm:[&>button]:flex-none sm:[&>button]:px-4"
        value={tab}
        onChange={setTab}
        options={tabs.map((t) => ({
          value: t.value,
          label: (
            <>
              <span className="sm:hidden">{t.value === "month" && !isCurrent ? formatMonth(month) : t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </>
          ),
        }))}
      />
      <div role="region" aria-label={tabs.find((t) => t.value === tab)?.label}>
        {tab === "month" ? (
          <MonthTab month={month} onEdit={openForm} onGoTo={setTab} />
        ) : tab === "income" ? (
          <IncomeTab />
        ) : (
          <RecurringTab view={tab} onEdit={openForm} />
        )}
      </div>
      {form ? <BillFormDialog bill={form.bill} prefill={form.prefill} onClose={() => setForm(null)} /> : null}
    </>
  );
}
