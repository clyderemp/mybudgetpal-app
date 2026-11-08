"use client";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTransactionDialog } from "@/components/transactions/TransactionDialogProvider";
import { Avatar, Badge, Button, ConfirmDialog, DetailDrawer, DetailRow, Money, notify } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { useDeleteTransaction } from "@/lib/queries";
import type { Transaction } from "@/lib/types";
import { CategoryLabel } from "./CategoryDot";
import { accountName, TYPE_LABEL, txnCategory, txnCurrency, txnFlow, txnTitle, type TxnLookups } from "./format";

/** Right drawer with a transaction's details plus Edit and Delete. */
export function TransactionDetailDrawer({
  transaction,
  lookups,
  onClose,
}: {
  transaction: Transaction | null;
  lookups: TxnLookups;
  onClose: () => void;
}) {
  const { openEdit } = useTransactionDialog();
  const deleteM = useDeleteTransaction();
  const [confirm, setConfirm] = useState(false);
  const t = transaction;

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
            <div className="mb-5 flex min-w-0 flex-col gap-2 border-b border-line pb-5">
              <Badge tone={t.type === "income" ? "accent" : "neutral"} className="self-start">
                {TYPE_LABEL[t.type]}
              </Badge>
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
                      <Avatar name={t.createdByName} size="xs" />
                    </span>
                    {t.createdByName}
                  </span>
                ) : (
                  "—"
                )}
              </DetailRow>
              <DetailRow label="Source">{t.source === "import" ? "Imported" : "Entered manually"}</DetailRow>
            </dl>
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
