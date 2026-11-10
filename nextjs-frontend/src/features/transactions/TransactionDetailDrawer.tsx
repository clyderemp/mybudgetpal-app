"use client";
import { MemberAvatar } from "@/components/members/MemberAvatar";
import { Check, ChevronRight, Flag, ListPlus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { fromDrafts, ItemsEditor, ItemsList, toDrafts, type ItemDraft } from "@/components/transactions/ItemsEditor";
import { useTransactionDialog } from "@/components/transactions/TransactionDialogProvider";
import { Badge, Button, ConfirmDialog, DetailDrawer, DetailRow, Dropdown, Input, Money, notify, type DropdownOption } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { useDeleteTransaction, useUpdateTransaction } from "@/lib/queries";
import type { Transaction, TransactionUpdate } from "@/lib/types";
import { CategoryLabel } from "./CategoryDot";
import { accountName, TYPE_LABEL, txnCategory, txnCurrency, txnFlow, txnTitle, type TxnLookups } from "./format";
import { ReviewBadge, reviewReasonLabel } from "./review";

/**
 * Right drawer with a transaction's details plus Edit and Delete. Flagged rows get a review box
 * (fix the name/category, "Mark reviewed", then on to the next one); any row can be flagged.
 */
export function TransactionDetailDrawer({
  transaction,
  lookups,
  onClose,
  onNext,
  onReviewed,
}: {
  transaction: Transaction | null;
  lookups: TxnLookups;
  onClose: () => void;
  /** Skip to the next flagged transaction (review flow). */
  onNext?: () => void;
  /** Called after "Mark reviewed" saved; default closes the drawer. */
  onReviewed?: () => void;
}) {
  const { openEdit } = useTransactionDialog();
  const deleteM = useDeleteTransaction();
  const updateM = useUpdateTransaction();
  const [confirm, setConfirm] = useState(false);
  const t = transaction;

  async function setFlag(flag: boolean) {
    if (!t) return;
    try {
      await updateM.mutateAsync({ id: t.id, needsReview: flag });
      notify.success(flag ? "Flagged for review" : "Marked as reviewed");
    } catch (err) {
      notify.error(err, "Could not update the review flag");
    }
  }

  return (
    <>
      <DetailDrawer
        open={Boolean(t)}
        onOpenChange={(o) => !o && onClose()}
        title={t ? txnTitle(t, lookups) : "Transaction"}
        description={t ? formatDate(t.date) : undefined}
        actions={
          t ? (
            <>
              <Button variant="ghost" className="mr-auto text-danger hover:text-danger" onClick={() => setConfirm(true)}>
                <Trash2 /> Delete
              </Button>
              {!t.needsReview ? (
                <Button variant="ghost" loading={updateM.isPending} onClick={() => void setFlag(true)}>
                  <Flag /> Flag for review
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  onClose();
                  openEdit(t);
                }}
              >
                <Pencil /> Edit transaction
              </Button>
            </>
          ) : null
        }
      >
        {t ? (
          <>
            {t.needsReview ? (
              <ReviewBox
                key={`${t.id}-${t.updatedAt ?? ""}`}
                t={t}
                lookups={lookups}
                onNext={onNext}
                onReviewed={onReviewed ?? onClose}
              />
            ) : null}
            <div className="mb-5 flex min-w-0 flex-col gap-2 border-b border-line pb-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={t.type === "income" ? "accent" : "neutral"}>{TYPE_LABEL[t.type]}</Badge>
                <ReviewBadge t={t} />
              </div>
              <Money
                fils={t.amountFils}
                currency={txnCurrency(t, lookups)}
                flow={txnFlow(t)}
                className="text-[32px] leading-10 font-semibold whitespace-normal break-words"
              />
            </div>
            <dl>
              <DetailRow label="Date">
                <span className="tabular">{formatDate(t.date)}</span>
              </DetailRow>
              {t.type === "transfer" ? (
                <>
                  <DetailRow label="From account">{accountName(t.accountId, lookups)}</DetailRow>
                  <DetailRow label="To account">{accountName(t.toAccountId, lookups)}</DetailRow>
                </>
              ) : (
                <>
                  <DetailRow label={t.type === "income" ? "Payer" : "Merchant"}>{t.merchant || "—"}</DetailRow>
                  <DetailRow label="Category">
                    <CategoryLabel
                      className="justify-end"
                      category={t.categoryId ? lookups.categories.get(t.categoryId) : null}
                      label={txnCategory(t, lookups)}
                    />
                  </DetailRow>
                  <DetailRow label="Account">{accountName(t.accountId, lookups)}</DetailRow>
                </>
              )}
              <DetailRow label="Note">
                <span className="font-normal whitespace-pre-wrap">{t.note || "—"}</span>
              </DetailRow>
              <DetailRow label="Added by">
                {t.createdByName ? (
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden>
                      <MemberAvatar userId={t.createdBy} name={t.createdByName} size="xs" />
                    </span>
                    {t.createdByName}
                  </span>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow label="Source">{t.source === "import" ? "Imported" : "Entered manually"}</DetailRow>
            </dl>
            <ItemsSection key={`items-${t.id}-${t.updatedAt ?? ""}`} t={t} currency={txnCurrency(t, lookups)} />
          </>
        ) : null}
      </DetailDrawer>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this transaction?"
        description="It will be removed from your lists, account balances and budgets."
        confirmLabel="Delete transaction"
        danger
        onConfirm={async () => {
          if (!t) return;
          await deleteM.mutateAsync(t.id);
          notify.success("Transaction deleted");
          onClose();
        }}
      />
    </>
  );
}

/** Quick fix for a flagged row: name + category in place, then "Mark reviewed" (and Next). */
function ReviewBox({
  t,
  lookups,
  onNext,
  onReviewed,
}: {
  t: Transaction;
  lookups: TxnLookups;
  onNext?: () => void;
  onReviewed: () => void;
}) {
  const updateM = useUpdateTransaction();
  const [merchant, setMerchant] = useState(t.merchant ?? "");
  const [categoryId, setCategoryId] = useState(t.categoryId ?? "");
  const isTransfer = t.type === "transfer";
  const options: DropdownOption[] = [...lookups.categories.values()]
    .filter((c) => !c.archived && c.kind === (t.type === "income" ? "income" : "expense"))
    .map((c) => ({ value: c.id, label: c.name }));

  async function markReviewed() {
    const body: TransactionUpdate & { id: string } = { id: t.id, needsReview: false };
    const name = merchant.trim();
    if (!isTransfer && name !== (t.merchant ?? "")) body.merchant = name || null;
    if (!isTransfer && categoryId && categoryId !== t.categoryId) body.categoryId = categoryId;
    try {
      await updateM.mutateAsync(body);
      notify.success("Marked as reviewed");
      onReviewed();
    } catch (err) {
      notify.error(err, "Could not save the review");
    }
  }

  return (
    <section
      aria-label="Review this transaction"
      className="mb-5 flex min-w-0 flex-col gap-3 rounded-container border border-warn/40 bg-warn-soft/60 p-3"
    >
      <p className="flex items-start gap-2 text-meta text-ink">
        <Flag className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <span>
          <span className="font-semibold">Needs review.</span> {reviewReasonLabel(t.reviewReason)}
          {t.reviewReason === "no_name" ? ". Give it a name and a category." : "."}
        </span>
      </p>
      {!isTransfer ? (
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <Input
            aria-label={t.type === "income" ? "Payer" : "Merchant"}
            placeholder={t.type === "income" ? "Payer" : "Merchant name"}
            autoComplete="off"
            maxLength={120}
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void markReviewed();
              }
            }}
          />
          <Dropdown aria-label="Category" options={options} value={categoryId} onChange={setCategoryId} placeholder="Category" />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onNext ? (
          <Button variant="ghost" size="sm" onClick={onNext}>
            Skip <ChevronRight />
          </Button>
        ) : null}
        <Button variant="primary" size="sm" loading={updateM.isPending} onClick={() => void markReviewed()}>
          <Check /> Mark reviewed{onNext ? " & next" : ""}
        </Button>
      </div>
    </section>
  );
}

/** Line items: read-only list with "Edit items", or the inline editor. */
function ItemsSection({ t, currency }: { t: Transaction; currency: string }) {
  const updateM = useUpdateTransaction();
  const items = t.items ?? [];
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<ItemDraft[]>(() => toDrafts(items));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const parsed = fromDrafts(drafts);
    if (parsed.error) return setError(parsed.error);
    try {
      await updateM.mutateAsync({ id: t.id, items: parsed.items });
      notify.success("Items saved");
      setEditing(false);
    } catch (err) {
      notify.error(err, "Could not save items");
    }
  }

  return (
    <section aria-labelledby={`items-${t.id}`} className="mt-5 flex min-w-0 flex-col gap-2 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`items-${t.id}`} className="text-meta font-semibold text-ink">
          Items{items.length ? <span className="tabular font-normal text-ink-2"> {items.length}</span> : null}
        </h3>
        {!editing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDrafts(toDrafts(items));
              setEditing(true);
            }}
          >
            {items.length ? <Pencil /> : <ListPlus />} {items.length ? "Edit items" : "Add items"}
          </Button>
        ) : null}
      </div>
      {editing ? (
        <>
          <ItemsEditor
            value={drafts}
            onChange={(next) => {
              setDrafts(next);
              if (error) setError(null);
            }}
            totalFils={t.amountFils}
            currency={currency}
            error={error}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={updateM.isPending} onClick={() => void save()}>
              Save items
            </Button>
          </div>
        </>
      ) : items.length ? (
        <ItemsList items={items} totalFils={t.amountFils} currency={currency} />
      ) : (
        <p className="text-meta text-ink-2">No items. Add what was bought to see it here and find it by searching.</p>
      )}
    </section>
  );
}
