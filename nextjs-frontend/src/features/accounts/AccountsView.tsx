"use client";
import { ChevronRight, Plus, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  InlineError,
  Money,
  PageHeader,
  Panel,
  SkeletonList,
  StatBand,
  StatBandItem,
  notify,
} from "@/components/ui";
import { formatFils } from "@/lib/money";
import { useArchiveAccount } from "@/lib/queries";
import type { Account, AccountType, Transaction } from "@/lib/types";
import { TransactionDetailDrawer } from "@/features/transactions/TransactionDetailDrawer";
import { useTxnLookups } from "@/features/transactions/useTxnLookups";
import { AccountDetailDrawer } from "./AccountDetailDrawer";
import { AccountFormDialog } from "./AccountFormDialog";
import { ACCOUNT_GROUP_LABEL, ACCOUNT_TYPE_ICON, ACCOUNT_TYPES, isLiability } from "./accountMeta";

export function AccountsView() {
  const { lookups, accountsQ } = useTxnLookups();
  const archiveM = useArchiveAccount();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Account | null>(null);
  const [txn, setTxn] = useState<Transaction | null>(null);

  const accounts = useMemo(() => (accountsQ.data ?? []).filter((a) => !a.archived), [accountsQ.data]);
  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  const summary = useMemo(() => {
    const aed = accounts.filter((a) => a.currency === "AED");
    const sum = (types: AccountType[]) => aed.filter((a) => types.includes(a.type)).reduce((s, a) => s + a.balanceFils, 0);
    const count = (types: AccountType[]) => aed.filter((a) => types.includes(a.type)).length;
    const owed = aed.filter((a) => isLiability(a.type) && a.balanceFils < 0).reduce((s, a) => s - a.balanceFils, 0);
    return {
      net: aed.reduce((s, a) => s + a.balanceFils, 0),
      cash: sum(["bank", "cash"]),
      cashCount: count(["bank", "cash"]),
      savings: sum(["savings", "investment"]),
      savingsCount: count(["savings", "investment"]),
      hasInvestments: aed.some((a) => a.type === "investment"),
      owed,
      owedCount: count(["credit_card", "loan"]),
      aedCount: aed.length,
      foreign: accounts.filter((a) => a.currency !== "AED"),
    };
  }, [accounts]);

  const groups = useMemo(
    () =>
      ACCOUNT_TYPES.map((t) => [t, accounts.filter((a) => a.type === t).sort((a, b) => a.name.localeCompare(b.name))] as const).filter(
        ([, list]) => list.length > 0,
      ),
    [accounts],
  );

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

  let body;
  if (accountsQ.isPending) {
    body = (
      <div role="status" aria-label="Loading accounts" className="flex flex-col gap-5">
        <StatBand>
          {["Net worth", "Cash and bank", "Savings", "Credit owed"].map((l) => (
            <StatBandItem key={l} label={l} value="" loading />
          ))}
        </StatBand>
        <Panel flush>
          <div className="h-9 border-b border-line bg-surface-2" />
          <SkeletonList rows={6} className="px-4" />
        </Panel>
      </div>
    );
  } else if (accountsQ.isError) {
    body = (
      <InlineError error={accountsQ.error} onRetry={() => void accountsQ.refetch()} retrying={accountsQ.isFetching} title="Couldn't load accounts" />
    );
  } else if (accounts.length === 0) {
    body = (
      <Panel>
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add your bank accounts, cards and cash so balances and net worth add up."
          action={
            <Button onClick={openAdd}>
              <Plus /> Add account
            </Button>
          }
        />
      </Panel>
    );
  } else {
    body = (
      <div className="flex flex-col gap-5">
        <StatBand aria-label="Balances in AED">
          <StatBandItem
            label="Net worth"
            value={formatFils(summary.net, "AED", { noDecimals: true })}
            tone={summary.net < 0 ? "negative" : "neutral"}
            hint={`Across ${plural(summary.aedCount, "AED account")}`}
          />
          <StatBandItem label="Cash and bank" value={formatFils(summary.cash, "AED", { noDecimals: true })} hint={plural(summary.cashCount, "account")} />
          <StatBandItem
            label="Savings"
            value={formatFils(summary.savings, "AED", { noDecimals: true })}
            hint={summary.hasInvestments ? "Includes investments" : plural(summary.savingsCount, "account")}
          />
          <StatBandItem
            label="Credit owed"
            value={formatFils(summary.owed, "AED", { noDecimals: true })}
            tone={summary.owed > 0 ? "negative" : "neutral"}
            hint={
              summary.owedCount === 0 ? "No cards or loans" : `On ${summary.owedCount} ${summary.owedCount === 1 ? "card or loan" : "cards or loans"}`
            }
          />
        </StatBand>

        {summary.foreign.length > 0 ? (
          <p className="text-meta text-ink-2">
            {summary.foreign.length === 1 ? "1 account is" : `${summary.foreign.length} accounts are`} held in{" "}
            {[...new Set(summary.foreign.map((a) => a.currency))].join(", ")}. {summary.foreign.length === 1 ? "It is" : "They are"} shown
            in {summary.foreign.length === 1 ? "its" : "their"} own currency and left out of the AED totals.
          </p>
        ) : null}

        {/* Desktop: one dense table grouped by type. */}
        <Panel flush className="hidden md:block">
          <table className="w-full table-fixed border-collapse text-sm">
            <caption className="sr-only">Accounts grouped by type</caption>
            <colgroup>
              <col />
              <col className="w-[24%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
              <col className="w-10" />
            </colgroup>
            <thead>
              <tr className="h-9 border-b border-line bg-surface-2 text-left text-meta text-ink-2">
                <th scope="col" className="px-4 font-medium">
                  Account
                </th>
                <th scope="col" className="px-3 font-medium">
                  Institution
                </th>
                <th scope="col" className="px-3 font-medium">
                  Number
                </th>
                <th scope="col" className="px-3 text-right font-medium">
                  Balance
                </th>
                <th scope="col" className="px-2">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            {groups.map(([type, list]) => {
              const aedList = list.filter((a) => a.currency === "AED");
              const subtotal = aedList.reduce((s, a) => s + a.balanceFils, 0);
              const Icon = ACCOUNT_TYPE_ICON[type];
              return (
                <tbody key={type} className="border-b border-line last:border-b-0">
                  <tr className="h-9 border-b border-line">
                    <th scope="rowgroup" colSpan={3} className="px-4 text-left font-semibold text-ink">
                      <span className="flex items-center gap-2">
                        <Icon className="size-4 text-ink-3" aria-hidden />
                        {ACCOUNT_GROUP_LABEL[type]}
                        <span className="tabular font-normal text-ink-2">{list.length}</span>
                      </span>
                    </th>
                    <td className="px-3 text-right font-semibold">
                      {aedList.length > 0 ? (
                        <Money fils={subtotal} tone={isLiability(type) && subtotal < 0 ? "danger" : undefined} />
                      ) : null}
                    </td>
                    <td />
                  </tr>
                  {list.map((a) => (
                    <tr key={a.id} className="group relative h-10 border-b border-line last:border-b-0 hover:bg-surface-2">
                      <td className="truncate px-4 pl-10">
                        <button
                          type="button"
                          onClick={() => setSelectedId(a.id)}
                          className="max-w-full truncate text-left font-medium text-ink after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
                        >
                          {a.name}
                        </button>
                        {a.currency !== "AED" ? <span className="ml-2 text-xs text-ink-2">{a.currency}</span> : null}
                      </td>
                      <td className="truncate px-3 text-ink-2">{a.institution || "—"}</td>
                      <td className="tabular truncate px-3 text-ink-2">{a.last4 ? `•••• ${a.last4}` : "—"}</td>
                      <td className="px-3 text-right font-medium">
                        <Money fils={a.balanceFils} currency={a.currency} tone={isLiability(a.type) && a.balanceFils < 0 ? "danger" : undefined} />
                      </td>
                      <td className="px-2 text-ink-3">
                        <ChevronRight className="size-4" aria-hidden />
                      </td>
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </Panel>

        {/* Phones: list rows grouped by type. */}
        <div className="flex flex-col gap-4 md:hidden">
          {groups.map(([type, list]) => {
            const aedList = list.filter((a) => a.currency === "AED");
            const subtotal = aedList.reduce((s, a) => s + a.balanceFils, 0);
            return (
              <section key={type} aria-label={ACCOUNT_GROUP_LABEL[type]} className="overflow-hidden rounded-container border border-line bg-surface">
                <div className="flex h-9 items-center justify-between gap-3 border-b border-line bg-surface-2 px-4">
                  <h2 className="truncate text-meta font-semibold text-ink">{ACCOUNT_GROUP_LABEL[type]}</h2>
                  {aedList.length > 0 ? (
                    <Money fils={subtotal} tone={isLiability(type) && subtotal < 0 ? "danger" : undefined} className="text-meta font-semibold" />
                  ) : null}
                </div>
                <ul className="divide-y divide-line">
                  {list.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(a.id)}
                        className="flex min-h-14 w-full min-w-0 items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{a.name}</span>
                          <span className="flex min-w-0 gap-2 text-xs text-ink-2">
                            <span className="truncate">{a.institution || "No institution"}</span>
                            {a.last4 ? <span className="tabular shrink-0">•••• {a.last4}</span> : null}
                          </span>
                        </span>
                        <Money
                          fils={a.balanceFils}
                          currency={a.currency}
                          tone={isLiability(a.type) && a.balanceFils < 0 ? "danger" : undefined}
                          className="shrink-0 text-sm font-semibold"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Balances across banks, cards and cash."
        actions={
          accounts.length > 0 ? (
            <Button onClick={openAdd}>
              <Plus /> Add account
            </Button>
          ) : null
        }
      />
      {body}
      <AccountDetailDrawer
        account={selected}
        lookups={lookups}
        onClose={() => setSelectedId(null)}
        onEdit={(a) => {
          setSelectedId(null);
          setEditing(a);
          setFormOpen(true);
        }}
        onArchive={(a) => {
          setSelectedId(null);
          setArchiving(a);
        }}
        onOpenTransaction={(t) => {
          setSelectedId(null);
          setTxn(t);
        }}
      />
      <AccountFormDialog open={formOpen} onOpenChange={setFormOpen} account={editing} />
      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Archive ${archiving?.name ?? "account"}?`}
        description="It will be hidden from lists and pickers. Its transactions stay in your history."
        confirmLabel="Archive account"
        onConfirm={async () => {
          if (!archiving) return;
          await archiveM.mutateAsync(archiving.id);
          notify.success(`${archiving.name} archived`);
        }}
      />
      <TransactionDetailDrawer transaction={txn} lookups={lookups} onClose={() => setTxn(null)} />
    </>
  );
}

