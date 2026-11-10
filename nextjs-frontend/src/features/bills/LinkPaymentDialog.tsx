"use client";
import dayjs from "dayjs";
import { useState } from "react";
import { EmptyState, FormDialog, InlineError, Input, Money, SkeletonList, notify } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { useLinkBillTransaction, useTransactions } from "@/lib/queries";
import type { BillMonthItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Pick the transaction that paid a bill when the rules didn't find it (e.g. an odd bank description). */
export function LinkPaymentDialog({ item, onClose }: { item: BillMonthItem; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const from = dayjs(item.dueFrom).subtract(15, "day").format("YYYY-MM-DD");
  const to = dayjs(item.dueTo).add(15, "day").format("YYYY-MM-DD");
  const txns = useTransactions({ from, to, q: q.trim() || undefined, pageSize: 50, sort: "-date" });
  const linkM = useLinkBillTransaction();
  const rows = (txns.data?.items ?? []).filter((t) => t.type !== "income" && t.billId !== item.billId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) return;
    try {
      await linkM.mutateAsync({ id: item.billId, transactionId: picked });
      notify.success(`Payment linked to ${item.name}`);
      onClose();
    } catch (err) {
      notify.error(err, "Couldn't link the payment");
    }
  };

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Link a payment to ${item.name}`}
      description={`Payments from ${formatDate(from, true)} to ${formatDate(to, true)}. Linked payments always count for this bill.`}
      onSubmit={submit}
      submitLabel="Link payment"
      submitting={linkM.isPending}
      submitDisabled={!picked}
    >
      <label className="sr-only" htmlFor="link-search">
        Search payments
      </label>
      <Input id="link-search" placeholder="Search by merchant or note" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      <div className="mt-3 max-h-[50vh] overflow-y-auto rounded-container border border-line">
        {txns.isPending ? (
          <SkeletonList rows={5} className="px-3" />
        ) : txns.isError ? (
          <InlineError className="border-0" error={txns.error} onRetry={() => txns.refetch()} title="Couldn't load payments" />
        ) : rows.length === 0 ? (
          <EmptyState className="py-8" title="No payments found" description="Try another search, or record the payment first." />
        ) : (
          <fieldset>
            <legend className="sr-only">Payments</legend>
            <ul className="divide-y divide-line">
              {rows.map((t) => (
                <li key={t.id}>
                  <label
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-2",
                      picked === t.id && "bg-accent-soft",
                    )}
                  >
                    <input type="radio" name="txn" value={t.id} checked={picked === t.id} onChange={() => setPicked(t.id)} className="size-4 accent-[var(--color-accent)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-meta font-medium text-ink">{t.merchant || t.note || "No description"}</span>
                      <span className="block text-xs text-ink-2">
                        {formatDate(t.date, true)}
                        {t.billId ? ", linked to another bill" : ""}
                      </span>
                    </span>
                    <Money fils={t.amountFils} flow="out" className="text-meta font-medium" />
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </div>
    </FormDialog>
  );
}
