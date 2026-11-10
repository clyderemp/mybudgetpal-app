"use client";
import { CheckCircle2, MoreHorizontal, Plus, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { ActionMenu, Badge, Button, Dropdown, Money, Spinner, type ActionMenuItem } from "@/components/ui";
import { useMediaQuery } from "@/features/transactions/useMediaQuery";
import type { ImportRow, ImportSection } from "@/lib/types";
import { canBulkInclude, periodLabel, plural, sectionTitle } from "./importMeta";
import { useReview } from "./ReviewContext";
import { RowsCards, RowsTable } from "./SectionRows";

const PAGE = 100;

export function SectionPanel({
  section,
  rows,
  filteredRows,
  onPickAccount,
  pickingAccount,
  onCreateAccount,
  error,
}: {
  section: ImportSection;
  /** All rows of this section (bulk actions). */
  rows: ImportRow[];
  /** Rows passing the current filter (displayed). */
  filteredRows: ImportRow[];
  onPickAccount: (accountId: string) => void;
  pickingAccount: boolean;
  onCreateAccount: () => void;
  /** Commit validation message for this section. */
  error?: string;
}) {
  const { accounts, readOnly, patchRows } = useReview();
  const wide = useMediaQuery("(min-width: 1024px)");
  const [limit, setLimit] = useState(PAGE);
  const title = sectionTitle(section);
  const needsAccount = !section.accountId && section.counts.toImport > 0;

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a) => !a.archived)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({
          value: a.id,
          label: a.name,
          description: [a.institution, a.last4 ? `..${a.last4}` : null, a.currency !== section.currency ? a.currency : null].filter(Boolean).join(", ") || undefined,
        })),
    [accounts, section.currency],
  );

  const bulk: ActionMenuItem[] = useMemo(() => {
    const include = rows.filter((r) => canBulkInclude(r) && r.action !== "import");
    const skip = rows.filter((r) => r.action !== "skip");
    const review = rows.filter((r) => r.needsReview);
    return [
      {
        label: `Include all (${include.length})`,
        disabled: include.length === 0,
        onSelect: () => patchRows(include.map((r) => ({ id: r.id, action: "import" as const }))),
      },
      {
        label: `Skip all (${skip.length})`,
        disabled: skip.length === 0,
        onSelect: () => patchRows(skip.map((r) => ({ id: r.id, action: "skip" as const }))),
      },
      {
        label: `Mark all reviewed (${review.length})`,
        disabled: review.length === 0,
        onSelect: () => patchRows(review.map((r) => ({ id: r.id, needsReview: false }))),
      },
    ];
  }, [rows, patchRows]);

  const rec = section.reconciliation;
  const shown = filteredRows.slice(0, limit);
  const headingId = `import-section-${section.index}`;

  return (
    <section aria-labelledby={headingId} className="min-w-0 rounded-container border border-line bg-surface">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 md:px-5">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 id={headingId} className="truncate text-sm font-semibold text-ink">
              {title}
            </h2>
            <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-meta text-ink-2">
              <span>{section.bank}</span>
              <span className="tabular">{periodLabel(section.periodFrom, section.periodTo)}</span>
              <span>{plural(section.rowCount, "row")}</span>
              <span>{section.counts.toImport} to import</span>
            </p>
          </div>
          {!readOnly ? (
            <ActionMenu
              items={bulk}
              label="This account's rows"
              trigger={
                <Button variant="secondary" size="sm" aria-label={`Bulk actions for ${title}`}>
                  <MoreHorizontal /> Bulk actions
                </Button>
              }
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          {readOnly ? (
            <p className="text-meta text-ink-2">
              Imported into <span className="font-medium text-ink">{section.accountName ?? "no account"}</span>
            </p>
          ) : (
            <div className="flex min-w-0 flex-wrap items-end gap-2">
              <Dropdown
                className="w-full min-w-0 sm:w-72"
                label={
                  <span className="flex items-center gap-2">
                    Import into {pickingAccount ? <Spinner className="size-3.5" /> : null}
                  </span>
                }
                options={accountOptions}
                value={section.accountId}
                placeholder="Choose an account"
                disabled={pickingAccount}
                error={error}
                onChange={(v) => v && v !== section.accountId && onPickAccount(v)}
              />
              <Button variant="secondary" onClick={onCreateAccount} disabled={pickingAccount}>
                <Plus /> Create account
              </Button>
              {needsAccount && !error ? (
                <Badge tone="warn" className="mb-2">
                  Unknown account, pick or create one
                </Badge>
              ) : null}
            </div>
          )}
          <Reconciliation section={section} />
        </div>
        {!rec.ok && rec.messages.length > 0 ? (
          <ul className="list-disc pl-5 text-xs text-ink-2">
            {rec.messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {filteredRows.length === 0 ? (
        <p className="px-4 py-6 text-center text-meta text-ink-2">No rows in this account match the filter.</p>
      ) : wide ? (
        <RowsTable rows={shown} caption={`Statement rows for ${title}`} />
      ) : (
        <RowsCards rows={shown} />
      )}
      {filteredRows.length > shown.length ? (
        <div className="flex justify-center border-t border-line px-4 py-3">
          <Button variant="secondary" size="sm" onClick={() => setLimit(filteredRows.length)}>
            Show all {filteredRows.length.toLocaleString("en-US")} rows
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function Reconciliation({ section }: { section: ImportSection }) {
  const rec = section.reconciliation;
  return (
    <div className="flex min-w-0 flex-col gap-1 lg:items-end">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-2">
        <span>Statement</span>
        <Money fils={section.openingFils} currency={section.currency} className="text-ink" />
        <span>to</span>
        <Money fils={section.closingFils} currency={section.currency} className="text-ink" />
      </span>
      {rec.ok ? (
        <Badge tone="accent">
          <CheckCircle2 aria-hidden /> Balances add up
        </Badge>
      ) : (
        <Badge tone="danger">
          <TriangleAlert aria-hidden /> Balances don&apos;t add up
        </Badge>
      )}
    </div>
  );
}
