"use client";
import { Pencil, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge, Button, InlineError, Money, Panel, SkeletonList, notify } from "@/components/ui";
import { currentMonth, formatDate } from "@/lib/dates";
import { useBillSuggestions, useCreateBill } from "@/lib/queries";
import type { BillCreate, BillSuggestion } from "@/lib/types";
import type { BillPrefill } from "./BillFormDialog";
import { BILL_KIND_LABEL, dayRange } from "./labels";

function toCreate(s: BillSuggestion): BillCreate {
  return {
    name: s.name,
    kind: s.kind,
    amountFils: s.amountFils,
    amountMode: s.amountMode,
    cadence: "monthly",
    dueDayFrom: s.dueDayFrom,
    dueDayTo: s.dueDayTo,
    accountId: s.accountId,
    categoryId: s.categoryId,
    matchText: s.matchText,
    amountTolerancePct: s.amountMode === "estimate" ? 25 : 10,
    startMonth: currentMonth(),
  };
}

/** Recurring payments spotted in the last 6 months that aren't on the list yet. Opt-in, one click each. */
export function SuggestionsPanel({ onAdd }: { onAdd: (prefill: BillPrefill) => void }) {
  const q = useBillSuggestions();
  const createM = useCreateBill();
  const [adding, setAdding] = useState<string | null>(null);

  if (q.isPending) {
    return (
      <Panel title="Suggestions" flush>
        <SkeletonList rows={3} className="px-4" />
      </Panel>
    );
  }
  if (q.isError) return <InlineError error={q.error} onRetry={() => q.refetch()} title="Couldn't look for recurring payments" />;
  if (!q.data.length) return null;

  const add = async (s: BillSuggestion) => {
    setAdding(s.key);
    try {
      await createM.mutateAsync(toCreate(s));
      notify.success(`${s.name} added`, "Its past payments are matched automatically.");
    } catch (err) {
      notify.error(err, `Couldn't add ${s.name}`);
    } finally {
      setAdding(null);
    }
  };

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="size-4 text-ink-2" aria-hidden /> Looks recurring
        </span>
      }
      description="Payments that repeat about monthly at a similar amount. Add the ones that are set payments."
      flush
    >
      <ul className="divide-y divide-line">
        {q.data.map((s) => (
          <li key={s.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-5">
            <div className="min-w-0 flex-1 basis-56">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-ink">{s.name}</span>
                <Badge tone="neutral">{BILL_KIND_LABEL[s.kind]}</Badge>
                {s.confidence === "medium" ? <Badge tone="outline">Seen {s.months} months</Badge> : null}
              </div>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-2">
                <span className="tabular">Around the {dayRange(s.dueDayFrom, s.dueDayTo)}</span>
                <span className="tabular">
                  {s.occurrences} payments, last {formatDate(s.lastDate, true)}
                </span>
                {s.amountMode === "estimate" ? <span>Amount varies</span> : null}
              </p>
            </div>
            <Money fils={s.amountFils} className="text-sm font-medium" />
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={`Review ${s.name} before adding`} onClick={() => onAdd(toCreate(s))}>
                <Pencil />
              </Button>
              <Button variant="secondary" size="sm" loading={adding === s.key} disabled={adding !== null} onClick={() => void add(s)} aria-label={`Add ${s.name}`}>
                {adding === s.key ? null : <Plus aria-hidden />} Add
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
