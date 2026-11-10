"use client";
import { Archive, MoreHorizontal, Pause, Pencil, Play, Repeat } from "lucide-react";
import { useState } from "react";
import { ActionMenu, Badge, Button, ConfirmDialog, EmptyState, InlineError, Money, Panel, SkeletonList, notify } from "@/components/ui";
import { formatMonth } from "@/lib/dates";
import { formatFils, formatPercent } from "@/lib/money";
import { useAccounts, useArchiveBill, useBills, useIncomeStreams, useUpdateBill } from "@/lib/queries";
import type { Bill, BillKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SummaryStrip } from "@/features/plan/SummaryStrip";
import type { OpenBillForm } from "./BillsView";
import { BILL_KIND_GROUP, CADENCE_LABEL, dayRange } from "./labels";
import { SuggestionsPanel } from "./SuggestionsPanel";

const KIND_ORDER: BillKind[] = ["bill", "loan", "bnpl", "debt_payment", "subscription", "savings", "other"];

function counts(b: Bill) {
  return b.active && !b.completed && b.purpose === "household";
}

export function RecurringTab({ view, onEdit }: { view: "all" | "subscriptions"; onEdit: OpenBillForm }) {
  const bills = useBills();
  const streams = useIncomeStreams();
  const accounts = useAccounts();
  const updateM = useUpdateBill();
  const archiveM = useArchiveBill();
  const [archiving, setArchiving] = useState<Bill | null>(null);
  const accountName = (id?: string | null) => (id ? (accounts.data ?? []).find((a) => a.id === id)?.name : undefined);

  if (bills.isPending) {
    return (
      <Panel flush>
        <SkeletonList rows={6} className="px-4" />
      </Panel>
    );
  }
  if (bills.isError) return <InlineError error={bills.error} onRetry={() => bills.refetch()} title="Couldn't load recurring payments" />;

  const subs = view === "subscriptions";
  const list = subs ? bills.data.filter((b) => b.kind === "subscription") : bills.data;
  const income = (streams.data ?? []).filter((s) => s.active).reduce((s, x) => s + x.monthlyFils, 0);
  const monthly = list.filter(counts).reduce((s, b) => s + b.monthlyFils, 0);

  const togglePause = async (b: Bill) => {
    try {
      await updateM.mutateAsync({ id: b.id, active: !b.active });
      notify.success(b.active ? `${b.name} paused` : `${b.name} resumed`);
    } catch (err) {
      notify.error(err, "Couldn't update the recurring payment");
    }
  };

  const menu = (b: Bill) => (
    <ActionMenu
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${b.name}`}>
          <MoreHorizontal />
        </Button>
      }
      items={[
        { label: "Edit", icon: <Pencil className="size-4" aria-hidden />, onSelect: () => onEdit(b) },
        b.active
          ? { label: "Pause", icon: <Pause className="size-4" aria-hidden />, onSelect: () => void togglePause(b) }
          : { label: "Resume", icon: <Play className="size-4" aria-hidden />, onSelect: () => void togglePause(b) },
        { separator: true },
        { label: "Delete", icon: <Archive className="size-4" aria-hidden />, danger: true, onSelect: () => setArchiving(b) },
      ]}
    />
  );

  const empty = (
    <Panel>
      <EmptyState
        icon={Repeat}
        title={subs ? "No subscriptions yet" : "No recurring payments yet"}
        description={
          subs
            ? "Add ChatGPT, Spotify, Netflix and the like to see what they cost each month and each year."
            : "Add each set monthly payment with its usual amount and due days. Amounts stay editable."
        }
        action={
          <Button size="sm" onClick={() => onEdit(null, subs ? { kind: "subscription" } : undefined)}>
            {subs ? "Add subscription" : "Add recurring payment"}
          </Button>
        }
      />
    </Panel>
  );

  const groups = subs
    ? [["subscription", list] as const]
    : KIND_ORDER.map((k) => [k, list.filter((b) => b.kind === k)] as const).filter(([, l]) => l.length);

  return (
    <div className="flex flex-col gap-5">
      {list.length ? (
        <SummaryStrip
          label={subs ? "Subscription totals" : "Commitment totals"}
          items={
            subs
              ? [
                  { label: "Per month", value: <Money fils={monthly} noDecimals />, hint: `${list.filter(counts).length} active` },
                  { label: "Per year", value: <Money fils={monthly * 12} noDecimals />, hint: "Monthly cost times 12" },
                  {
                    label: "Share of expected income",
                    value: income > 0 ? formatPercent(monthly / income, 1) : "—",
                    hint: income > 0 ? `of ${formatFils(income, "AED", { noDecimals: true })} a month` : "Add expected income to compare",
                  },
                ]
              : [
                  { label: "Committed each month", value: <Money fils={monthly} noDecimals />, hint: "Active household payments, yearly ones spread monthly" },
                  {
                    label: "Share of expected income",
                    value: income > 0 ? formatPercent(monthly / income) : "—",
                    hint: income > 0 ? `of ${formatFils(income, "AED", { noDecimals: true })} a month` : "Add expected income to compare",
                  },
                  { label: "Left after commitments", value: <Money fils={income - monthly} noDecimals tone={income - monthly < 0 ? "danger" : undefined} />, hint: "Before flexible spending" },
                ]
          }
        />
      ) : null}

      {list.length === 0
        ? empty
        : groups.map(([kind, rows]) => {
            const total = rows.filter(counts).reduce((s, b) => s + b.monthlyFils, 0);
            return (
              <Panel
                key={kind}
                title={BILL_KIND_GROUP[kind]}
                description={
                  <span className="tabular">
                    {formatFils(total, "AED", { noDecimals: true })} a month{subs ? `, ${formatFils(total * 12, "AED", { noDecimals: true })} a year` : ""}
                  </span>
                }
                flush
              >
                <table className="hidden w-full table-fixed border-collapse text-sm md:table">
                  <caption className="sr-only">{BILL_KIND_GROUP[kind]}</caption>
                  <colgroup>
                    <col />
                    <col className="w-[22%]" />
                    <col className="w-[18%]" />
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                    <col className="w-14" />
                  </colgroup>
                  <thead>
                    <tr className="h-9 border-b border-line bg-surface-2 text-meta text-ink-2">
                      <th scope="col" className="px-4 text-left font-medium md:px-5">
                        Name
                      </th>
                      <th scope="col" className="px-3 text-left font-medium">
                        Due
                      </th>
                      <th scope="col" className="px-3 text-left font-medium">
                        Paid from
                      </th>
                      <th scope="col" className="px-3 text-right font-medium">
                        Amount
                      </th>
                      <th scope="col" className="px-3 text-right font-medium">
                        {subs ? "Per year" : "Per month"}
                      </th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => (
                      <tr key={b.id} className={cn("h-12 border-b border-line last:border-b-0", !counts(b) && "text-ink-2")}>
                        <td className="px-4 md:px-5">
                          <div className="flex min-w-0 items-center gap-2">
                            <button type="button" className="min-w-0 truncate text-left font-medium text-ink hover:underline" onClick={() => onEdit(b)}>
                              {b.name}
                            </button>
                            <StateBadges bill={b} />
                          </div>
                        </td>
                        <td className="px-3">
                          <span className="block truncate tabular">
                            {b.cadence === "monthly" ? dayRange(b.dueDayFrom, b.dueDayTo) : `${CADENCE_LABEL[b.cadence]}, ${dayRange(b.dueDayFrom, b.dueDayTo)}`}
                          </span>
                          <Ends bill={b} />
                        </td>
                        <td className="px-3">
                          <span className="block truncate text-ink-2">{accountName(b.accountId) ?? "Any account"}</span>
                        </td>
                        <td className="px-3 text-right">
                          <Money fils={b.amountFils} />
                          {b.amountMode === "estimate" ? <span className="block text-xs text-ink-2">Varies</span> : null}
                        </td>
                        <td className="px-3 text-right">
                          <Money fils={subs ? b.monthlyFils * 12 : b.monthlyFils} tone={counts(b) ? undefined : "muted"} />
                        </td>
                        <td className="pr-2 text-right">{menu(b)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <ul className="divide-y divide-line md:hidden">
                  {rows.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 py-2.5 pr-2 pl-4">
                      <button type="button" onClick={() => onEdit(b)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={cn("truncate text-sm font-medium", counts(b) ? "text-ink" : "text-ink-2")}>{b.name}</span>
                            <StateBadges bill={b} />
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-2">
                            {b.cadence === "monthly" ? `Due ${dayRange(b.dueDayFrom, b.dueDayTo)}` : `${CADENCE_LABEL[b.cadence]}, ${dayRange(b.dueDayFrom, b.dueDayTo)}`}
                            {b.instalmentsTotal ? `, ${b.instalmentsRemaining ?? 0} left` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <Money fils={b.amountFils} className="block text-sm font-medium" />
                          <span className="block text-xs text-ink-2">
                            {subs ? `${formatFils(b.monthlyFils * 12, "AED", { noDecimals: true })} a year` : b.cadence === "monthly" ? (b.amountMode === "estimate" ? "Varies" : "Monthly") : `${formatFils(b.monthlyFils, "AED", { noDecimals: true })} a month`}
                          </span>
                        </span>
                      </button>
                      {menu(b)}
                    </li>
                  ))}
                </ul>
              </Panel>
            );
          })}

      {subs ? null : <SuggestionsPanel onAdd={(prefill) => onEdit(null, prefill)} />}

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Delete ${archiving?.name ?? "recurring payment"}?`}
        description="It leaves your checklist and plan. Past payments stay in your transactions."
        confirmLabel="Delete recurring payment"
        danger
        onConfirm={async () => {
          if (!archiving) return;
          await archiveM.mutateAsync(archiving.id);
          notify.success(`${archiving.name} deleted`);
        }}
      />
    </div>
  );
}

function StateBadges({ bill: b }: { bill: Bill }) {
  return (
    <>
      {!b.active ? <Badge tone="outline">Paused</Badge> : null}
      {b.completed ? <Badge tone="accent">Paid off</Badge> : null}
      {b.purpose === "business" ? <Badge tone="outline">Business</Badge> : null}
    </>
  );
}

function Ends({ bill: b }: { bill: Bill }) {
  if (b.instalmentsTotal) {
    return (
      <span className="block truncate text-xs text-ink-2 tabular">
        {b.instalmentsRemaining ?? 0} of {b.instalmentsTotal} left{b.lastMonth ? `, last ${formatMonth(b.lastMonth)}` : ""}
      </span>
    );
  }
  if (b.endMonth) return <span className="block truncate text-xs text-ink-2">Until {formatMonth(b.endMonth)}</span>;
  return null;
}
