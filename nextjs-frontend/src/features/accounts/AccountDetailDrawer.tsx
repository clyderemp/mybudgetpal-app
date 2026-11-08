"use client";
import Link from "next/link";
import { Archive, Pencil, Plus } from "lucide-react";
import { useTransactionDialog } from "@/components/transactions/TransactionDialogProvider";
import { Button, buttonClasses, DetailDrawer, DetailRow, EmptyState, InlineError, Money, SkeletonList } from "@/components/ui";
import { useTransactions } from "@/lib/queries";
import type { Account, Transaction } from "@/lib/types";
import { TransactionRowButton } from "@/features/transactions/TransactionCardList";
import type { TxnLookups } from "@/features/transactions/format";
import { ACCOUNT_TYPE_LABEL, isLiability, last4Label } from "./accountMeta";

export function AccountDetailDrawer({
  account,
  lookups,
  onClose,
  onEdit,
  onArchive,
  onOpenTransaction,
}: {
  account: Account | null;
  lookups: TxnLookups;
  onClose: () => void;
  onEdit: (a: Account) => void;
  onArchive: (a: Account) => void;
  onOpenTransaction: (t: Transaction) => void;
}) {
  const { openCreate } = useTransactionDialog();
  const txQ = useTransactions({ accountId: account?.id, page: 1, pageSize: 10, sort: "-date" }, { enabled: Boolean(account) });
  const a = account;
  const items = txQ.data?.items ?? [];

  return (
    <DetailDrawer
      open={Boolean(a)}
      onOpenChange={(o) => !o && onClose()}
      title={a?.name ?? "Account"}
      description={a ? [ACCOUNT_TYPE_LABEL[a.type], a.institution, last4Label(a.last4)].filter(Boolean).join(", ") : undefined}
      actions={
        a ? (
          <>
            <Button variant="ghost" className="mr-auto" onClick={() => onArchive(a)}>
              <Archive /> Archive
            </Button>
            <Button variant="secondary" onClick={() => onEdit(a)}>
              <Pencil /> Edit
            </Button>
            <Button
              onClick={() => {
                onClose();
                openCreate({ accountId: a.id });
              }}
            >
              <Plus /> Add transaction
            </Button>
          </>
        ) : null
      }
    >
      {a ? (
        <>
          <div className="mb-5 border-b border-line pb-5">
            <p className="text-meta text-ink-2">Current balance</p>
            <Money
              fils={a.balanceFils}
              currency={a.currency}
              tone={isLiability(a.type) && a.balanceFils < 0 ? "danger" : undefined}
              className="mt-1 block text-[32px] leading-10 font-semibold whitespace-normal break-words"
            />
          </div>
          <dl className="mb-6">
            <DetailRow label="Type">{ACCOUNT_TYPE_LABEL[a.type]}</DetailRow>
            <DetailRow label="Institution">{a.institution || "—"}</DetailRow>
            <DetailRow label="Card or account number">
              <span className="tabular">{a.last4 ? `•••• ${a.last4}` : "—"}</span>
            </DetailRow>
            <DetailRow label="Currency">{a.currency}</DetailRow>
            <DetailRow label="Opening balance">
              <Money fils={a.openingBalanceFils} currency={a.currency} />
            </DetailRow>
          </dl>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">Recent transactions</h3>
            <Link
              href={`/transactions?accountId=${encodeURIComponent(a.id)}&range=all`}
              className={buttonClasses("ghost", "sm")}
              onClick={onClose}
            >
              View all
            </Link>
          </div>
          {txQ.isPending ? (
            <SkeletonList rows={5} />
          ) : txQ.isError ? (
            <InlineError error={txQ.error} onRetry={() => void txQ.refetch()} retrying={txQ.isFetching} title="Couldn't load transactions" />
          ) : items.length === 0 ? (
            <EmptyState
              className="rounded-container border border-line py-6"
              title="No transactions on this account"
              description="Add a transaction to start tracking its balance."
            />
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-container border border-line">
              {items.map((t) => (
                <li key={t.id}>
                  <TransactionRowButton t={t} lookups={lookups} onOpen={onOpenTransaction} showDate />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </DetailDrawer>
  );
}
