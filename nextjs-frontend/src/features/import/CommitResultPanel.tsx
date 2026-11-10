"use client";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActionButton, Badge, Money, Panel, buttonClasses } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { useUpdateAccount } from "@/lib/queries";
import type { Account, ImportAccountCheck, ImportCommitResult, ImportSection } from "@/lib/types";
import { plural } from "./importMeta";

/**
 * After commit: per account, the statement's closing balance vs the app's balance on the
 * statement end date. A difference can be fixed by moving the account's opening balance.
 */
export function CommitResultPanel({
  result,
  sections,
  accountsById,
  onAdjusted,
}: {
  result: ImportCommitResult;
  sections: ImportSection[];
  accountsById: Map<string, Account>;
  /** Refetch the import after an opening-balance change. */
  onAdjusted: () => Promise<unknown>;
}) {
  const updateM = useUpdateAccount();
  // Accounts adjusted in this session (guards against a second adjustment if the stored check is stale).
  const [adjusted, setAdjusted] = useState<Set<string>>(() => new Set());

  const adjust = async (check: ImportAccountCheck) => {
    const account = accountsById.get(check.accountId);
    if (!account || check.differenceFils == null) throw new Error("Account not found. Refresh and try again.");
    await updateM.mutateAsync({ id: account.id, openingBalanceFils: account.openingBalanceFils - check.differenceFils });
    setAdjusted((s) => new Set(s).add(check.accountId));
    await onAdjusted().catch(() => undefined);
  };

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-accent" aria-hidden /> Statement imported
        </span>
      }
      description={`${plural(result.createdCount, "transaction")} added, ${plural(result.skippedCount, "row")} skipped.`}
      actions={
        <Link href="/transactions" className={buttonClasses("secondary", "sm")}>
          View transactions
        </Link>
      }
      flush
    >
      <ul className="divide-y divide-line">
        {result.accounts.map((check) => {
          const section = sections.find((s) => s.index === check.sectionIndex);
          const currency = section?.currency ?? accountsById.get(check.accountId)?.currency ?? "AED";
          const diff = check.differenceFils;
          const done = adjusted.has(check.accountId);
          const matches = diff === 0 || done;
          return (
            <li key={`${check.sectionIndex}-${check.accountId}`} className="flex min-w-0 flex-col gap-3 px-4 py-3 md:px-5 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{check.accountName}</p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-meta sm:grid-cols-[auto_auto_auto_auto] sm:justify-start">
                  <dt className="text-ink-2">Statement closing</dt>
                  <dd className="text-right sm:text-left">
                    <Money fils={check.statementClosingFils} currency={currency} />
                  </dd>
                  <dt className="text-ink-2">App balance on {check.periodTo ? formatDate(check.periodTo) : "statement end"}</dt>
                  <dd className="text-right sm:text-left">
                    <Money fils={check.appBalanceFils} currency={currency} />
                  </dd>
                  {diff != null && diff !== 0 && !done ? (
                    <>
                      <dt className="text-ink-2">Difference</dt>
                      <dd className="text-right sm:text-left">
                        <Money fils={diff} currency={currency} tone="danger" />
                      </dd>
                    </>
                  ) : null}
                </dl>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {diff == null ? (
                  <Badge tone="neutral">No closing balance on the statement</Badge>
                ) : matches ? (
                  <Badge tone="accent">{done ? "Opening balance adjusted" : "Matches the statement"}</Badge>
                ) : (
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    onAction={() => adjust(check)}
                    successMessage={`${check.accountName} now matches the statement`}
                    errorMessage="Couldn't update the opening balance"
                  >
                    Set opening balance to match
                  </ActionButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
