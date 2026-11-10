"use client";
import Link from "next/link";
import { CalendarCheck, Hourglass } from "lucide-react";
import { Badge, EmptyState, InlineError, Money, Panel, Skeleton, buttonClasses } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { formatFils } from "@/lib/money";
import { useBillsOverview } from "@/lib/queries";
import type { BillsOverview } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BILL_STATUS, dateRange } from "@/features/bills/labels";

/** Dashboard: safe to spend, income still on its way, and bills due in the next two weeks. */
export function BillsOverviewPanels() {
  const q = useBillsOverview();
  if (q.isPending) {
    return (
      <>
        <Skeleton className="h-44 w-full rounded-container" />
        <Skeleton className="h-36 w-full rounded-container" />
      </>
    );
  }
  if (q.isError) return <InlineError error={q.error} onRetry={() => q.refetch()} title="Couldn't load bills and expected income" />;
  const o = q.data;
  if (!o.hasBills && !o.hasIncome) {
    return (
      <Panel title="Bills and income">
        <EmptyState
          className="py-4"
          icon={CalendarCheck}
          title="Track set payments"
          description="Add your monthly bills, subscriptions and when salaries arrive to see what's safe to spend."
          action={
            <Link href="/bills" className={buttonClasses("secondary", "sm")}>
              Set up bills
            </Link>
          }
        />
      </Panel>
    );
  }
  return (
    <>
      <SafeToSpendPanel o={o} />
      {o.waitingFor.length ? <WaitingForPanel o={o} /> : null}
      <UpcomingBillsPanel o={o} />
    </>
  );
}

function SafeToSpendPanel({ o }: { o: BillsOverview }) {
  const s = o.safeToSpend;
  const negative = s.safeToSpendFils < 0;
  return (
    <Panel
      title="Safe to spend"
      description={
        !s.nextSalary
          ? `Until the end of the month, ${formatDate(s.until, true)}`
          : s.nextSalary.dueFrom < o.today
            ? `${s.nextSalary.streamName} is late, so bills due by today count`
            : `Until ${s.nextSalary.streamName}, from ${formatDate(s.until, true)}`
      }
      actions={
        <Link href="/bills" className={buttonClasses("ghost", "sm")}>
          Bills
        </Link>
      }
    >
      <p className={cn("tabular text-kpi font-semibold", negative ? "text-danger" : "text-ink")}>
        <Money fils={s.safeToSpendFils} noDecimals tone={negative ? "danger" : undefined} />
      </p>
      <dl className="mt-3 flex flex-col gap-1.5 text-meta" aria-label="How it's worked out">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">Cash in household bank and cash accounts</dt>
          <dd>
            <Money fils={s.cashFils} noDecimals />
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">
            {s.bills.length === 1 ? "1 bill" : `${s.bills.length} bills`} still due before then
          </dt>
          <dd>
            <Money fils={s.billsDueFils} noDecimals flow="out" />
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">Income expected before then</dt>
          <dd>
            <Money fils={s.incomeExpectedFils} noDecimals flow="in" />
          </dd>
        </div>
      </dl>
      <p className="mt-3 border-t border-line pt-2 text-xs text-ink-2">
        Business accounts and business bills are left out. Income counts at its lowest expected amount.
      </p>
    </Panel>
  );
}

function WaitingForPanel({ o }: { o: BillsOverview }) {
  return (
    <Panel title="Waiting for" description="Income expected this month that hasn't arrived" flush>
      <ul className="divide-y divide-line">
        {o.waitingFor.map((i) => {
          const late = i.status === "overdue";
          return (
            <li key={`${i.streamId}-${i.partId}`} className="flex min-h-12 items-center gap-3 px-4 py-2 md:px-5">
              <Hourglass className="size-4 shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-meta font-medium text-ink">
                  {i.streamName}
                  <span className="font-normal text-ink-2">, {i.label}</span>
                </p>
                <p className="tabular text-xs text-ink-2">Usually {dateRange(i.dueFrom, i.dueTo)}</p>
              </div>
              {late ? <Badge tone="warn">Late</Badge> : null}
              <span className="shrink-0 text-right text-meta font-medium">
                {i.minFils != null && i.maxFils != null ? (
                  <span className="tabular">
                    {formatFils(i.minFils, "AED", { noDecimals: true })} to {formatFils(i.maxFils, "AED", { noDecimals: true, hideCurrency: true })}
                  </span>
                ) : (
                  <Money fils={i.expectedFils} noDecimals />
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function UpcomingBillsPanel({ o }: { o: BillsOverview }) {
  const total = o.upcomingBills.reduce((s, i) => s + i.expectedFils, 0);
  return (
    <Panel
      title="Upcoming bills"
      description={o.upcomingBills.length ? <span className="tabular">{formatFils(total, "AED", { noDecimals: true })} in the next 2 weeks</span> : undefined}
      actions={
        <Link href="/bills" className={buttonClasses("ghost", "sm")}>
          Checklist
        </Link>
      }
      flush
    >
      {o.upcomingBills.length === 0 ? (
        <EmptyState className="py-6" icon={CalendarCheck} title="Nothing due in the next 2 weeks" description="Paid bills drop off this list." />
      ) : (
        <ul className="divide-y divide-line">
          {o.upcomingBills.slice(0, UPCOMING_SHOWN).map((i) => {
            const st = BILL_STATUS[i.status];
            return (
              <li key={`${i.billId}-${i.dueFrom}`} className="flex min-h-12 items-center gap-3 px-4 py-2 md:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-meta font-medium text-ink">{i.name}</p>
                  <p className="tabular text-xs text-ink-2">{dateRange(i.dueFrom, i.dueTo)}</p>
                </div>
                {i.status !== "upcoming" ? <Badge tone={st.tone}>{st.label}</Badge> : null}
                <Money fils={i.expectedFils} noDecimals className="w-24 text-right text-meta font-medium" />
              </li>
            );
          })}
          {o.upcomingBills.length > UPCOMING_SHOWN ? (
            <li className="px-4 py-2.5 md:px-5">
              <Link href="/bills" className="text-meta text-accent underline-offset-2 hover:underline">
                {o.upcomingBills.length - UPCOMING_SHOWN} more in the checklist
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </Panel>
  );
}

const UPCOMING_SHOWN = 6;
