"use client";
import Link from "next/link";
import { Info } from "lucide-react";
import { Money, Panel, buttonClasses } from "@/components/ui";
import { formatFils, formatPercent } from "@/lib/money";
import type { Category, ZeroBasedPlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BILL_KIND_GROUP } from "@/features/bills/labels";

/**
 * Zero-based plan ("give every dirham a job"): expected income, minus commitments (bills,
 * subscriptions, loans, instalments, debt payments), minus sinking funds and savings, minus the
 * flexible category limits below, leaves an amount to assign. The goal is zero.
 */
export function ZeroBasedPlanPanel({ plan, categories }: { plan?: ZeroBasedPlan | null; categories: Category[] }) {
  if (!plan) return null;
  if (!plan.hasBills && !plan.hasIncome) {
    return (
      <div role="note" className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-container border border-line bg-surface px-4 py-2.5">
        <p className="min-w-0 flex-1 basis-60 text-meta text-ink">
          Plan every dirham: add your expected income and set monthly payments, and this page shows what&apos;s left to assign after bills.
        </p>
        <Link href="/bills" className={buttonClasses("secondary", "sm")}>
          Set up bills and income
        </Link>
      </div>
    );
  }
  const left = plan.leftToAssignFils;
  const sinkingAndSavings = plan.sinkingFundsFils + plan.savingsFils;
  const steps: { label: string; fils: number; sign: "" | "−" | "="; hint?: string }[] = [
    { label: "Expected income", fils: plan.expectedIncomeFils, sign: "", hint: plan.hasIncome ? "From your income streams" : "No expected income set" },
    {
      label: "Commitments",
      fils: plan.commitmentsFils,
      sign: "−",
      hint: plan.committedShare != null ? `${formatPercent(plan.committedShare)} of income with sinking funds` : "Bills, loans, subscriptions",
    },
    { label: "Set aside", fils: sinkingAndSavings, sign: "−", hint: "Sinking funds and savings" },
    { label: "Flexible spending", fils: plan.flexibleFils, sign: "−", hint: "Category limits below" },
    { label: left < 0 ? "Over-assigned" : "Left to assign", fils: Math.abs(left), sign: "=", hint: left === 0 ? "Every dirham has a job" : left > 0 ? "Give it a job" : "Cut limits or bills" },
  ];
  const overlap = plan.overlapCategoryIds.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean);

  return (
    <Panel
      title="Zero-based plan"
      description="Give every dirham a job: income, minus what's committed, minus what you plan to spend, should leave zero."
      actions={
        <Link href="/bills" className={buttonClasses("ghost", "sm")}>
          Bills
        </Link>
      }
      flush
    >
      <dl className="grid grid-cols-2 gap-px bg-line xl:grid-cols-5">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <div
              key={s.label}
              className={cn(
                "flex min-w-0 flex-col gap-0.5 bg-surface px-4 py-3 md:px-5",
                last && "col-span-2 xl:col-span-1",
                last && "bg-surface-2",
              )}
            >
              <dt className="truncate text-meta text-ink-2">{s.label}</dt>
              <dd className={cn("tabular truncate text-xl font-semibold sm:text-2xl", last && left < 0 ? "text-danger" : last && left > 0 ? "text-accent" : "text-ink")}>
                {s.sign ? <span className="mr-1 font-normal text-ink-2">{s.sign}</span> : null}
                <Money fils={s.fils} noDecimals tone={last && left < 0 ? "danger" : undefined} />
              </dd>
              {s.hint ? <dd className="text-xs text-ink-2">{s.hint}</dd> : null}
            </div>
          );
        })}
      </dl>
      {plan.commitmentsByKind.length || plan.sinkingFunds.length ? (
        <p className="border-t border-line px-4 py-2.5 text-xs text-ink-2 md:px-5">
          {[
            ...plan.commitmentsByKind.map((k) => `${BILL_KIND_GROUP[k.kind]} ${formatFils(k.amountFils, "AED", { noDecimals: true })}`),
            ...plan.sinkingFunds.map((s) => `${s.name} ${formatFils(s.monthlyFils, "AED", { noDecimals: true })} a month`),
            ...(plan.savingsFils ? [`Savings ${formatFils(plan.savingsFils, "AED", { noDecimals: true })}`] : []),
          ].join("; ")}
        </p>
      ) : null}
      {left > 0 && plan.suggestedGoal ? (
        <p className="flex items-start gap-2 border-t border-line px-4 py-2.5 text-meta text-ink md:px-5">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-2" aria-hidden />
          <span>
            Put the <Money fils={left} noDecimals className="font-semibold" /> left toward {plan.suggestedGoal.name}, or raise a category limit.{" "}
            <Link href="/plan?tab=goals" className="text-accent underline-offset-2 hover:underline">
              Savings goals
            </Link>
          </span>
        </p>
      ) : null}
      {overlap.length ? (
        <p className="flex items-start gap-2 border-t border-line px-4 py-2.5 text-meta text-ink md:px-5">
          <Info className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          <span>
            {overlap.join(", ")} {overlap.length === 1 ? "has" : "have"} a category limit and recurring payments, so {overlap.length === 1 ? "it may be" : "they may be"} counted
            twice. Lower the limit to the extra you expect beyond the bills.
          </span>
        </p>
      ) : null}
    </Panel>
  );
}
