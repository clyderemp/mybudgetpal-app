"use client";
import { CalendarCheck, Link2, MoreHorizontal, Pencil, SkipForward, Undo2, Unlink, Wallet } from "lucide-react";
import { useState } from "react";
import { ActionMenu, Badge, Button, EmptyState, InlineError, Money, Panel, SkeletonList, notify } from "@/components/ui";
import { formatDate, formatMonth } from "@/lib/dates";
import { formatFils } from "@/lib/money";
import { useAccounts, useBills, useBillsMonth, useSkipBill, useUnlinkBillTransaction } from "@/lib/queries";
import type { BillMonthItem, IncomeMonthItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SummaryStrip } from "@/features/plan/SummaryStrip";
import type { OpenBillForm } from "./BillsView";
import { BILL_KIND_LABEL, BILL_STATUS, INCOME_KIND_LABEL, INCOME_STATUS, dateRange } from "./labels";
import { LinkPaymentDialog } from "./LinkPaymentDialog";
import { SuggestionsPanel } from "./SuggestionsPanel";

export function MonthTab({ month, onEdit, onGoTo }: { month: string; onEdit: OpenBillForm; onGoTo: (t: "income") => void }) {
  const q = useBillsMonth(month);
  const bills = useBills();
  const accounts = useAccounts();
  const skipM = useSkipBill();
  const unlinkM = useUnlinkBillTransaction();
  const [linking, setLinking] = useState<BillMonthItem | null>(null);
  const accountName = (id?: string | null) => (id ? (accounts.data ?? []).find((a) => a.id === id)?.name : undefined);
  const billById = new Map((bills.data ?? []).map((b) => [b.id, b]));

  if (q.isPending) {
    return (
      <div role="status" aria-label="Loading bills" className="flex flex-col gap-5">
        <SummaryStrip label="Loading" items={[{ label: "Bills paid", value: "…" }, { label: "Still to pay", value: "…" }, { label: "Income", value: "…" }]} />
        <Panel flush>
          <SkeletonList rows={6} className="px-4" />
        </Panel>
      </div>
    );
  }
  if (q.isError) return <InlineError error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} title="Couldn't load this month's bills" />;

  const { items, income, totals } = q.data;
  const label = formatMonth(month, true);

  const skip = async (i: BillMonthItem, skipped: boolean) => {
    try {
      await skipM.mutateAsync({ id: i.billId, month, skipped });
      notify.success(skipped ? `${i.name} skipped for ${formatMonth(month)}` : `${i.name} is due again in ${formatMonth(month)}`);
    } catch (err) {
      notify.error(err, "Couldn't update the bill");
    }
  };
  const unlink = async (i: BillMonthItem) => {
    try {
      await Promise.all(i.matches.map((m) => unlinkM.mutateAsync({ id: i.billId, transactionId: m.transactionId })));
      notify.success(`Payment unlinked from ${i.name}`);
    } catch (err) {
      notify.error(err, "Couldn't unlink the payment");
    }
  };

  const menu = (i: BillMonthItem) => {
    const bill = billById.get(i.billId);
    return (
      <ActionMenu
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${i.name}`}>
            <MoreHorizontal />
          </Button>
        }
        items={[
          ...(i.matches.length
            ? [{ label: i.matches.length > 1 ? "Unlink payments" : "Not this payment", icon: <Unlink className="size-4" aria-hidden />, onSelect: () => void unlink(i) }]
            : [{ label: "Link a payment", icon: <Link2 className="size-4" aria-hidden />, onSelect: () => setLinking(i) }]),
          i.status === "skipped"
            ? { label: "Undo skip", icon: <Undo2 className="size-4" aria-hidden />, onSelect: () => void skip(i, false) }
            : { label: "Skip this month", icon: <SkipForward className="size-4" aria-hidden />, disabled: i.status === "paid", onSelect: () => void skip(i, true) },
          { separator: true },
          { label: "Edit recurring payment", icon: <Pencil className="size-4" aria-hidden />, disabled: !bill, onSelect: () => bill && onEdit(bill) },
        ]}
      />
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <SummaryStrip
        label={`${label} summary`}
        items={[
          {
            label: "Bills paid",
            value: (
              <>
                {totals.billsPaidCount} <span className="text-base font-normal text-ink-2">of {totals.billsCount}</span>
              </>
            ),
            hint: <Money fils={totals.billsPaidFils} noDecimals tone="muted" />,
          },
          {
            label: "Still to pay",
            value: <Money fils={totals.billsRemainingFils} noDecimals />,
            hint: `of ${formatFils(totals.billsExpectedFils, "AED", { noDecimals: true })} expected`,
          },
          {
            label: "Income received",
            value: <Money fils={totals.incomeReceivedFils} noDecimals />,
            hint: totals.incomeWaitingFils > 0 ? `Waiting for ${formatFils(totals.incomeWaitingFils, "AED", { noDecimals: true })}` : income.length ? "All expected income is in" : "No expected income set",
          },
        ]}
      />

      <Panel title="Checklist" description={`Bills due in ${label}, in due order. Payments are matched from your transactions.`} flush>
        {items.length === 0 ? (
          <EmptyState
            className="py-10"
            icon={CalendarCheck}
            title={bills.data?.length ? `Nothing due in ${label}` : "No recurring payments yet"}
            description={
              bills.data?.length
                ? "Nothing on your list falls in this month."
                : "Add your set monthly payments (rent, DEWA, Etisalat, the car loan, subscriptions) or pick them from the suggestions below."
            }
            action={
              bills.data?.length ? undefined : (
                <Button size="sm" onClick={() => onEdit(null)}>
                  Add recurring payment
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <BillRow key={i.billId} item={i} accountName={accountName(i.matches[0]?.accountId ?? i.accountId)} menu={menu(i)} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Expected income"
        description={`When money should come in during ${label}.`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => onGoTo("income")}>
            Manage
          </Button>
        }
        flush
      >
        {income.length === 0 ? (
          <EmptyState
            className="py-8"
            icon={Wallet}
            title="No expected income yet"
            description="Add each salary and when it usually arrives, so the app can tell you what's still on its way."
            action={
              <Button size="sm" variant="secondary" onClick={() => onGoTo("income")}>
                Add expected income
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {income.map((i) => (
              <IncomeRow key={`${i.streamId}-${i.partId}`} item={i} />
            ))}
          </ul>
        )}
      </Panel>

      <SuggestionsPanel onAdd={(prefill) => onEdit(null, prefill)} />

      {linking ? <LinkPaymentDialog item={linking} onClose={() => setLinking(null)} /> : null}
    </div>
  );
}

function BillRow({ item: i, accountName, menu }: { item: BillMonthItem; accountName?: string; menu: React.ReactNode }) {
  const st = BILL_STATUS[i.status];
  const paid = i.status === "paid";
  const m = i.matches[0];
  return (
    <li className="flex items-start gap-3 px-4 py-3 md:items-center md:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("truncate text-sm font-medium", i.status === "skipped" ? "text-ink-2 line-through" : "text-ink")}>{i.name}</span>
          <Badge tone={st.tone}>{st.label}</Badge>
          {i.priceChanged ? <Badge tone="warn">Price changed</Badge> : null}
          {i.needsConfirmation && !i.priceChanged ? <Badge tone="outline">Check match</Badge> : null}
          {i.purpose === "business" ? <Badge tone="outline">Business</Badge> : null}
        </div>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-2">
          <span>{BILL_KIND_LABEL[i.kind]}</span>
          <span className="tabular">Due {dateRange(i.dueFrom, i.dueTo)}</span>
          {i.instalmentNumber && i.instalmentsTotal ? (
            <span className="tabular">
              Instalment {i.instalmentNumber} of {i.instalmentsTotal}
            </span>
          ) : null}
          {m ? (
            <span className="min-w-0 truncate">
              Paid {formatDate(m.date, true)}
              {accountName ? `, ${accountName}` : ""}
            </span>
          ) : null}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {paid ? (
          <>
            <Money fils={i.paidFils} className="block text-sm font-medium" />
            <span className={cn("block text-xs", i.priceChanged ? "text-warn" : "text-ink-2")}>
              {i.differenceFils === 0 ? "As expected" : `${i.differenceFils > 0 ? "+" : "−"}${formatFils(Math.abs(i.differenceFils))} vs expected`}
            </span>
          </>
        ) : (
          <>
            <Money fils={i.expectedFils} className={cn("block text-sm font-medium", i.status === "skipped" && "text-ink-2")} />
            <span className="block text-xs text-ink-2">{i.amountMode === "estimate" ? "Estimate" : "Expected"}</span>
          </>
        )}
      </div>
      <div className="-mr-2 shrink-0">{menu}</div>
    </li>
  );
}

function IncomeRow({ item: i }: { item: IncomeMonthItem }) {
  const st = INCOME_STATUS[i.status];
  const range = i.minFils != null || i.maxFils != null
    ? `${formatFils(i.minFils ?? i.expectedFils, "AED", { noDecimals: true })} to ${formatFils(i.maxFils ?? i.expectedFils, "AED", { noDecimals: true })}`
    : null;
  return (
    <li className="flex items-center gap-3 px-4 py-3 md:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-ink">
            {i.streamName}
            <span className="font-normal text-ink-2">, {i.label}</span>
          </span>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-2">
          <span>{INCOME_KIND_LABEL[i.kind]}</span>
          <span className="tabular">
            {i.status === "received" && i.matches[0] ? `Arrived ${formatDate(i.matches[0].date, true)}` : `Usually ${dateRange(i.dueFrom, i.dueTo)}`}
          </span>
          {range && i.status !== "received" ? <span className="tabular">{range}</span> : null}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <Money fils={i.status === "received" ? i.receivedFils : i.expectedFils} flow={i.status === "received" ? "in" : "neutral"} className="block text-sm font-medium" />
        <span className="block text-xs text-ink-2">{i.status === "received" ? "Received" : "Expected"}</span>
      </div>
    </li>
  );
}
