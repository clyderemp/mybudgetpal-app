"use client";
import { ArrowLeft, CheckCheck, FileWarning, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ActionButton,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  InlineError,
  PageHeader,
  Panel,
  Skeleton,
  SkeletonList,
  buttonClasses,
  notify,
} from "@/components/ui";
import { isApiError } from "@/lib/api";
import { useAccounts, useCategories, useCommitImport, useImport, usePatchImport, usePatchImportRows, useRollbackImport } from "@/lib/queries";
import type { Account, ImportRow, ImportRowPatch, ImportSection, StatementImport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CommitResultPanel } from "./CommitResultPanel";
import { CreateAccountDialog } from "./CreateAccountDialog";
import { FILTER_LABEL, IMPORT_STATUS, formatTimestamp, matchesFilter, periodLabel, plural, sectionTitle, type RowFilter } from "./importMeta";
import { MerchantRuleDialog } from "./MerchantRuleDialog";
import { ReviewProvider, type ReviewCtx } from "./ReviewContext";
import { SectionPanel } from "./SectionPanel";

export function ImportReview({ id }: { id: string }) {
  const q = useImport(id);

  if (q.isPending) return <ReviewSkeleton />;
  if (q.isError || !q.data) {
    const notFound = isApiError(q.error) && q.error.status === 404;
    return (
      <>
        <PageHeader title="Import statement" actions={<BackLink />} />
        {notFound ? (
          <Panel>
            <EmptyState
              icon={FileWarning}
              title="This import doesn't exist"
              description="It may have been discarded. Upload the statement again to start over."
              action={
                <Link href="/import" className={buttonClasses("primary")}>
                  Upload a statement
                </Link>
              }
            />
          </Panel>
        ) : (
          <InlineError error={q.error} onRetry={() => void q.refetch()} retrying={q.isFetching} title="Couldn't load this import" />
        )}
      </>
    );
  }
  return <Review imp={q.data} refetch={q.refetch} />;
}

function BackLink() {
  return (
    <Link href="/import" className={buttonClasses("ghost", "sm")}>
      <ArrowLeft /> All imports
    </Link>
  );
}

function ReviewSkeleton() {
  return (
    <div role="status" aria-label="Loading import">
      <div className="mb-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-3 w-64" />
      </div>
      <Panel className="mb-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-28" />
          ))}
        </div>
      </Panel>
      <Panel flush>
        <SkeletonList rows={8} className="px-4" />
      </Panel>
    </div>
  );
}

function Review({ imp, refetch }: { imp: StatementImport; refetch: () => Promise<unknown> }) {
  const router = useRouter();
  const accountsQ = useAccounts();
  const categoriesQ = useCategories();
  const patchImport = usePatchImport(imp.id);
  const patchRowsM = usePatchImportRows(imp.id);
  const commitM = useCommitImport(imp.id);
  const rollbackM = useRollbackImport();

  const [filter, setFilter] = useState<RowFilter>("all");
  const [createFor, setCreateFor] = useState<ImportSection | null>(null);
  const [ruleRow, setRuleRow] = useState<ImportRow | null>(null);
  const [confirmCommit, setConfirmCommit] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pickingSection, setPickingSection] = useState<number | null>(null);

  const isDraft = imp.status === "draft";
  const readOnly = !isDraft || commitM.isPending;
  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);
  const categories = useMemo(() => categoriesQ.data ?? [], [categoriesQ.data]);

  const { mutate: mutateRows } = patchRowsM;
  const patchRows = useCallback(
    (rows: ImportRowPatch[]) => {
      if (rows.length === 0) return;
      // An edit clears that row's commit error.
      setErrors((e) => {
        if (!rows.some((r) => e[r.id])) return e;
        const next = { ...e };
        for (const r of rows) delete next[r.id];
        return next;
      });
      mutateRows(rows, {
        onSuccess: () => {
          if (rows.length > 1) notify.success(`${plural(rows.length, "row")} updated`);
        },
        onError: (err) => notify.error(err, "Couldn't save the change"),
      });
    },
    [mutateRows],
  );

  const ctx: ReviewCtx = useMemo(
    () => ({
      readOnly,
      accounts,
      accountsById: new Map(accounts.map((a) => [a.id, a])),
      categories,
      categoriesById: new Map(categories.map((c) => [c.id, c])),
      sectionsByIndex: new Map(imp.sections.map((s) => [s.index, s])),
      rowErrors: errors,
      patchRows,
      openRuleDialog: setRuleRow,
    }),
    [readOnly, accounts, categories, imp.sections, errors, patchRows],
  );

  const rowsBySection = useMemo(() => {
    const m = new Map<number, ImportRow[]>();
    for (const r of imp.rows) {
      const list = m.get(r.sectionIndex) ?? [];
      list.push(r);
      m.set(r.sectionIndex, list);
    }
    return m;
  }, [imp.rows]);

  // Live counts from the (optimistically updated) rows; server counts are the fallback.
  const counts = useMemo(() => {
    const c = { new: 0, recorded: 0, transfer: 0, review: 0, skipped: 0, toImport: 0 };
    for (const r of imp.rows) {
      if (r.status === "new") c.new++;
      else if (r.status === "recorded") c.recorded++;
      else if (r.status === "transfer") c.transfer++;
      else if (r.status === "review") c.review++;
      if (r.action === "skip" && r.status !== "recorded" && !r.pairedRowId) c.skipped++;
      else c.toImport++;
    }
    return c;
  }, [imp.rows]);

  const toImportBySection = (s: ImportSection) => (rowsBySection.get(s.index) ?? []).filter((r) => r.action === "import").length;
  const missingAccount = imp.sections.filter((s) => !s.accountId && toImportBySection(s) > 0);
  const newToAccept = imp.rows.filter((r) => r.status === "new" && (r.action !== "import" || r.needsReview));
  const reviewOpen = imp.rows.filter((r) => r.needsReview);

  const pickAccount = async (section: ImportSection, accountId: string) => {
    setPickingSection(section.index);
    try {
      await patchImport.mutateAsync({ sections: [{ index: section.index, accountId }] });
      setErrors((e) => {
        const next = { ...e };
        delete next[`sections.${section.index}`];
        return next;
      });
    } catch (err) {
      notify.error(err, "Couldn't link the account");
    } finally {
      setPickingSection(null);
    }
  };

  const commit = async () => {
    try {
      await commitM.mutateAsync();
      setErrors({});
      notify.success("Statement imported");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (isApiError(err) && err.status === 422 && err.fields) {
        setErrors(err.fields);
        notify.error(err, "Some rows need attention before importing");
        return;
      }
      throw err;
    }
  };

  const filterChips: { key: RowFilter; count: number }[] = [
    { key: "new", count: counts.new },
    { key: "recorded", count: counts.recorded },
    { key: "transfer", count: counts.transfer },
    { key: "review", count: counts.review },
    { key: "skipped", count: counts.skipped },
  ];

  const status = IMPORT_STATUS[imp.status];
  const generalErrors = Object.entries(errors).filter(([k]) => !imp.rows.some((r) => r.id === k) && !k.startsWith("sections."));
  const rowErrorCount = Object.keys(errors).filter((k) => imp.rows.some((r) => r.id === k)).length;

  return (
    <ReviewProvider value={ctx}>
      <PageHeader
        title="Import statement"
        description={
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 truncate">{imp.filename}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        }
        actions={
          <>
            <BackLink />
            {isDraft ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDiscard(true)} disabled={commitM.isPending}>
                Discard draft
              </Button>
            ) : null}
            {imp.status === "committed" ? (
              <Button variant="secondary" size="sm" onClick={() => setConfirmRollback(true)}>
                Roll back import
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-col gap-4">
        {imp.status === "committed" && imp.commitResult ? (
          <CommitResultPanel result={imp.commitResult} sections={imp.sections} accountsById={ctx.accountsById} onAdjusted={refetch} />
        ) : null}
        {imp.status === "rolled_back" ? (
          <Notice icon={Info}>
            {imp.committedAt ? "This import was rolled back" : "This draft was discarded"}
            {imp.rolledBackAt ? ` on ${formatTimestamp(imp.rolledBackAt)}` : ""}. Its rows are shown for reference only.
          </Notice>
        ) : null}

        {/* Summary + filters */}
        <Panel>
          <div className="flex flex-col gap-3">
            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-meta">
              <SummaryItem label="Bank">{imp.bank || "Unknown"}</SummaryItem>
              <SummaryItem label="Period">
                <span className="tabular">{periodLabel(imp.periodFrom, imp.periodTo)}</span>
              </SummaryItem>
              <SummaryItem label="Accounts">{imp.sections.length}</SummaryItem>
              <SummaryItem label="Uploaded">
                {formatTimestamp(imp.createdAt)}
                {imp.createdByName ? ` by ${imp.createdByName}` : ""}
              </SummaryItem>
            </dl>
            <div role="group" aria-label="Filter rows" className="flex flex-wrap gap-2">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={imp.rows.length} />
              {filterChips.map((c) => (
                <FilterChip
                  key={c.key}
                  active={filter === c.key}
                  onClick={() => setFilter(filter === c.key ? "all" : c.key)}
                  label={FILTER_LABEL[c.key as Exclude<RowFilter, "all">]}
                  count={c.count}
                />
              ))}
            </div>
            {imp.issues.length > 0 ? (
              <ul className="flex flex-col gap-1 rounded-control bg-warn-soft px-3 py-2 text-meta text-ink">
                {imp.issues.map((m) => (
                  <li key={m} className="flex gap-2">
                    <FileWarning className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
                    <span className="min-w-0">{m}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {isDraft ? (
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  disabled={newToAccept.length === 0 || readOnly}
                  onAction={() =>
                    patchRowsM.mutateAsync(newToAccept.map((r) => ({ id: r.id, action: "import" as const, ...(r.needsReview ? { needsReview: false } : {}) })))
                  }
                  successMessage={`${plural(newToAccept.length, "new row")} accepted`}
                  errorMessage="Couldn't accept the new rows"
                >
                  <CheckCheck /> Accept all new{newToAccept.length ? ` (${newToAccept.length})` : ""}
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  size="sm"
                  disabled={reviewOpen.length === 0 || readOnly}
                  onAction={() => patchRowsM.mutateAsync(reviewOpen.map((r) => ({ id: r.id, needsReview: false })))}
                  successMessage={`${plural(reviewOpen.length, "row")} marked reviewed`}
                  errorMessage="Couldn't mark the rows reviewed"
                >
                  Mark all reviewed{reviewOpen.length ? ` (${reviewOpen.length})` : ""}
                </ActionButton>
              </div>
            ) : null}
          </div>
        </Panel>

        {imp.sections.length === 0 ? (
          <Panel>
            <EmptyState icon={FileWarning} title="No transactions found" description="The statement was read, but it has no rows to import." />
          </Panel>
        ) : (
          imp.sections.map((s) => {
            const rows = rowsBySection.get(s.index) ?? [];
            return (
              <SectionPanel
                key={s.index}
                section={s}
                rows={rows}
                filteredRows={rows.filter((r) => matchesFilter(r, filter))}
                pickingAccount={pickingSection === s.index}
                onPickAccount={(accountId) => void pickAccount(s, accountId)}
                onCreateAccount={() => setCreateFor(s)}
                error={errors[`sections.${s.index}`]}
              />
            );
          })
        )}

        {isDraft ? (
          <CommitBar
            toImport={counts.toImport}
            missing={missingAccount}
            rowErrorCount={rowErrorCount}
            generalErrors={generalErrors.map(([, m]) => m)}
            committing={commitM.isPending}
            onCommit={() => setConfirmCommit(true)}
          />
        ) : null}
      </div>

      <CreateAccountDialog
        section={createFor}
        onOpenChange={(o) => !o && setCreateFor(null)}
        onCreated={(account: Account, section) => pickAccount(section, account.id)}
      />
      <MerchantRuleDialog
        row={ruleRow}
        categories={categories}
        onOpenChange={(o) => !o && setRuleRow(null)}
        onSaved={() => patchImport.mutateAsync({ rematch: true })}
      />
      <ConfirmDialog
        open={confirmCommit}
        onOpenChange={setConfirmCommit}
        danger={false}
        title={`Import ${plural(counts.toImport, "transaction")}?`}
        description={`They are added to ${imp.sections
          .filter((s) => toImportBySection(s) > 0)
          .map((s) => s.accountName ?? sectionTitle(s))
          .join(", ")}. Skipped and already recorded rows are left out. You can roll the import back later.`}
        confirmLabel={`Import ${plural(counts.toImport, "transaction")}`}
        onConfirm={commit}
      />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this draft?"
        description="The uploaded rows and your edits are discarded. Nothing has been added to your transactions."
        confirmLabel="Discard draft"
        onConfirm={async () => {
          await rollbackM.mutateAsync(imp.id);
          notify.success("Draft discarded");
          router.push("/import");
        }}
      />
      <ConfirmDialog
        open={confirmRollback}
        onOpenChange={setConfirmRollback}
        title="Roll back this import?"
        description={`This removes the ${plural(imp.commitResult?.createdCount ?? 0, "transaction")} this import added. Transactions you recorded yourself are not touched.`}
        confirmLabel="Roll back import"
        onConfirm={async () => {
          await rollbackM.mutateAsync(imp.id);
          notify.success("Import rolled back");
        }}
      />
    </ReviewProvider>
  );
}

function SummaryItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-meta font-medium transition-colors pointer-coarse:h-10",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        active ? "border-ink bg-ink text-ink-fg" : "border-line-strong bg-surface text-ink hover:bg-surface-2",
      )}
    >
      {label}
      <span className={cn("tabular", active ? "text-ink-fg/80" : "text-ink-2")}>{count.toLocaleString("en-US")}</span>
    </button>
  );
}

function Notice({ icon: Icon, children }: { icon: typeof Info; children: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-container border border-line bg-surface-2 px-4 py-3 text-meta text-ink">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-2" aria-hidden />
      <p className="min-w-0">{children}</p>
    </div>
  );
}

function CommitBar({
  toImport,
  missing,
  rowErrorCount,
  generalErrors,
  committing,
  onCommit,
}: {
  toImport: number;
  missing: ImportSection[];
  rowErrorCount: number;
  generalErrors: string[];
  committing: boolean;
  onCommit: () => void;
}) {
  const blocked = missing.length > 0 || toImport === 0;
  return (
    <div className="z-10 flex min-w-0 flex-col gap-3 rounded-container border border-line bg-surface p-4 sm:flex-row sm:items-center md:sticky md:bottom-4 md:shadow-pop">
      <div className="min-w-0 flex-1 text-meta" aria-live="polite">
        {missing.length > 0 ? (
          <p className="text-ink">
            Choose an account for {missing.map(sectionTitle).join(", ")} before importing.
          </p>
        ) : toImport === 0 ? (
          <p className="text-ink-2">No rows are included. Tick the rows you want to import.</p>
        ) : (
          <p className="text-ink">
            <span className="font-semibold tabular">{plural(toImport, "transaction")}</span> will be added.
          </p>
        )}
        {rowErrorCount > 0 ? <p className="mt-0.5 text-danger">{plural(rowErrorCount, "row")} need attention (see the messages under each row).</p> : null}
        {generalErrors.map((m) => (
          <p key={m} className="mt-0.5 text-danger">
            {m}
          </p>
        ))}
      </div>
      <Button onClick={onCommit} disabled={blocked} loading={committing} className="sm:shrink-0">
        Import {toImport > 0 ? plural(toImport, "transaction") : "transactions"}
      </Button>
    </div>
  );
}
