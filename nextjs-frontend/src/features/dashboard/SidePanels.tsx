"use client";
import Link from "next/link";
import { CalendarClock, Wallet } from "lucide-react";
import { Badge, EmptyState, Money, Panel, buttonClasses } from "@/components/ui";
import { formatDate, todayISO } from "@/lib/dates";
import { formatFils } from "@/lib/money";
import type { Account, FinancialHealth, UpcomingDebtPayment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { daysBetween, hasHealthData, healthComponents, scoreBand } from "./format";

/* ---------------- Upcoming payments ---------------- */

function dueLabel(days: number) {
  if (days < 0) return { text: `${-days} ${-days === 1 ? "day" : "days"} overdue`, tone: "danger" as const };
  if (days === 0) return { text: "Due today", tone: "warn" as const };
  if (days === 1) return { text: "Tomorrow", tone: "warn" as const };
  return { text: `In ${days} days`, tone: days <= 3 ? ("warn" as const) : ("neutral" as const) };
}

export function UpcomingPaymentsPanel({ items }: { items: UpcomingDebtPayment[] }) {
  const today = todayISO();
  const total = items.reduce((s, p) => s + p.minPaymentFils, 0);
  return (
    <Panel
      title="Upcoming payments"
      description={items.length ? <span className="tabular">{formatFils(total, "AED", { noDecimals: true })} in minimums due</span> : undefined}
      actions={
        <Link href="/plan?tab=debts" className={buttonClasses("ghost", "sm")}>
          Debts
        </Link>
      }
      flush
    >
      {items.length === 0 ? (
        <EmptyState
          className="py-8"
          icon={CalendarClock}
          title="Nothing due soon"
          description="Minimum payments for your debts appear here as their due dates approach."
        />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((p) => {
            const due = dueLabel(daysBetween(today, p.dueDate));
            return (
              <li key={`${p.debtId}-${p.dueDate}`} className="flex min-h-12 items-center gap-3 px-4 py-2 md:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-meta font-medium text-ink">{p.name}</p>
                  <p className="tabular text-xs text-ink-2">{formatDate(p.dueDate, true)}</p>
                </div>
                <Badge tone={due.tone} className="tabular">
                  {due.text}
                </Badge>
                <Money fils={p.minPaymentFils} noDecimals className="w-24 text-right text-meta font-medium" />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------- Financial health ---------------- */

const toneBar = { positive: "bg-accent", warning: "bg-warn", negative: "bg-danger", neutral: "bg-ink-2" } as const;
const toneText = { positive: "text-accent", warning: "text-warn", negative: "text-danger", neutral: "text-ink-2" } as const;

/** Slim 0–100 meter. */
export function ScoreMeter({ score, empty, className }: { score: number; empty?: boolean; className?: string }) {
  const s = empty ? 0 : Math.max(0, Math.min(100, Math.round(score)));
  const band = scoreBand(s);
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={empty ? undefined : s}
      aria-valuetext={empty ? "No score yet" : `${s} out of 100, ${band.label}`}
      aria-label="Financial health score"
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-line", className)}
    >
      <div className={cn("h-full rounded-full", empty ? "bg-transparent" : toneBar[band.tone])} style={{ width: `${s}%` }} />
      {/* Band thresholds at 40 and 70 */}
      <span aria-hidden className="absolute inset-y-0 left-[40%] w-px bg-surface" />
      <span aria-hidden className="absolute inset-y-0 left-[70%] w-px bg-surface" />
    </div>
  );
}

export function HealthComponentsList({ health, showTargets = false }: { health: FinancialHealth; showTargets?: boolean }) {
  const empty = !hasHealthData(health);
  return (
    <dl className="flex flex-col divide-y divide-line">
      {healthComponents(health).map((c) => (
        <div key={c.key} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="min-w-0 truncate text-meta text-ink">{c.label}</dt>
            <dd className="tabular shrink-0 text-meta">
              <span className="font-semibold text-ink">{empty || c.points === null ? "—" : Math.round(c.points)}</span>
              <span className="text-ink-2"> / {c.weight}</span>
            </dd>
          </div>
          <div aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-ink-2"
              style={{ width: `${empty || c.points === null ? 0 : (c.points / c.weight) * 100}%` }}
            />
          </div>
          <dd className="flex flex-wrap justify-between gap-x-3 text-xs text-ink-2">
            <span className="tabular">{empty ? "No data yet" : c.value}</span>
            {showTargets ? <span>{c.target}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function HealthPanel({ health }: { health: FinancialHealth }) {
  const empty = !hasHealthData(health);
  const band = scoreBand(health.score);
  return (
    <Panel
      title="Financial health"
      actions={
        <Link href="/insights#health" className={buttonClasses("ghost", "sm")}>
          Details
        </Link>
      }
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="tabular text-2xl font-semibold text-ink">
          {empty ? "—" : Math.round(health.score)}
          <span className="text-meta font-normal text-ink-2"> / 100</span>
        </p>
        <span className={cn("text-meta font-medium", empty ? "text-ink-2" : toneText[band.tone])}>{empty ? "No data yet" : band.label}</span>
      </div>
      <ScoreMeter score={health.score} empty={empty} className="mb-4" />
      <HealthComponentsList health={health} />
      {empty ? <p className="mt-3 text-xs text-ink-2">Record income and expenses to get a score.</p> : null}
    </Panel>
  );
}

/* ---------------- Accounts ---------------- */

const TYPE_LABEL: Record<Account["type"], string> = {
  bank: "Bank",
  savings: "Savings",
  credit_card: "Credit card",
  cash: "Cash",
  loan: "Loan",
  investment: "Investment",
};

export function AccountsPanel({ accounts }: { accounts: Account[] }) {
  const aed = accounts.filter((a) => a.currency === "AED");
  const excluded = accounts.length - aed.length;
  const total = aed.reduce((s, a) => s + a.balanceFils, 0);
  return (
    <Panel
      title="Accounts"
      actions={
        <Link href="/accounts" className={buttonClasses("ghost", "sm")}>
          Manage
        </Link>
      }
      flush
    >
      {accounts.length === 0 ? (
        <EmptyState
          className="py-8"
          icon={Wallet}
          title="No accounts yet"
          description="Add your bank accounts, cards and cash to track balances."
          action={
            <Link href="/accounts" className={buttonClasses("secondary", "sm")}>
              Add account
            </Link>
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {accounts.map((a) => (
              <li key={a.id} className="flex min-h-12 items-center gap-3 px-4 py-2 md:px-5">
                <span aria-hidden className="h-6 w-1 shrink-0 rounded-full" style={{ background: a.color || "var(--color-line-strong)" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-meta font-medium text-ink">{a.name}</p>
                  <p className="flex min-w-0 gap-2 text-xs text-ink-2">
                    <span className="shrink-0">{TYPE_LABEL[a.type]}</span>
                    {a.institution ? <span className="min-w-0 truncate">{a.institution}</span> : null}
                    {a.last4 ? <span className="tabular shrink-0">•••• {a.last4}</span> : null}
                  </p>
                </div>
                <Money
                  fils={a.balanceFils}
                  currency={a.currency}
                  tone={a.balanceFils < 0 ? "danger" : undefined}
                  className="text-meta font-medium"
                />
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between gap-3 border-t border-line bg-surface-2 px-4 py-2.5 md:px-5">
            <span className="text-meta text-ink-2">
              Net total
              {excluded ? <span className="block text-xs">Excludes {excluded} non-AED {excluded === 1 ? "account" : "accounts"}</span> : null}
            </span>
            <Money fils={total} tone={total < 0 ? "danger" : undefined} className="text-sm font-semibold" />
          </div>
        </>
      )}
    </Panel>
  );
}
