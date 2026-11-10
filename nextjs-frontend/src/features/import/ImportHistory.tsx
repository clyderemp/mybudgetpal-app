"use client";
import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, ConfirmDialog, EmptyState, InlineError, Panel, SkeletonList, notify } from "@/components/ui";
import { useImports, useRollbackImport } from "@/lib/queries";
import type { ImportSummary } from "@/lib/types";
import { IMPORT_STATUS, formatTimestamp, periodLabel, plural } from "./importMeta";

/** Past uploads, newest first: open, roll back (committed) or discard (draft). */
export function ImportHistory() {
  const q = useImports();
  const rollback = useRollbackImport();
  const [target, setTarget] = useState<ImportSummary | null>(null);

  const items = q.data?.items ?? [];

  let body;
  if (q.isPending) body = <SkeletonList rows={4} className="px-4" />;
  else if (q.isError)
    body = (
      <InlineError
        className="m-4"
        error={q.error}
        onRetry={() => void q.refetch()}
        retrying={q.isFetching}
        title="Couldn't load your imports"
      />
    );
  else if (items.length === 0)
    body = (
      <EmptyState
        icon={FileText}
        title="No statements imported yet"
        description="Upload a PDF or CSV statement above. You review every row before anything is added."
      />
    );
  else
    body = (
      <ul className="divide-y divide-line">
        {items.map((imp) => (
          <HistoryRow key={imp.id} imp={imp} onRollback={() => setTarget(imp)} />
        ))}
      </ul>
    );

  const committed = target?.status === "committed";
  const created = target?.commitResult?.createdCount ?? 0;

  return (
    <>
      <Panel flush title="Import history" description={q.data ? plural(q.data.total, "import") : undefined}>
        {body}
      </Panel>
      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(o) => !o && setTarget(null)}
        title={committed ? `Roll back ${target?.filename ?? "import"}?` : `Discard ${target?.filename ?? "draft"}?`}
        description={
          committed
            ? `This removes the ${plural(created, "transaction")} this import added. Transactions you recorded yourself are not touched.`
            : "The uploaded rows and your edits are discarded. Nothing has been added to your transactions."
        }
        confirmLabel={committed ? "Roll back import" : "Discard draft"}
        onConfirm={async () => {
          if (!target) return;
          await rollback.mutateAsync(target.id);
          notify.success(committed ? "Import rolled back" : "Draft discarded");
        }}
      />
    </>
  );
}

function HistoryRow({ imp, onRollback }: { imp: ImportSummary; onRollback: () => void }) {
  const status = IMPORT_STATUS[imp.status];
  const c = imp.counts;
  const created = imp.commitResult?.createdCount;
  return (
    <li className="flex min-w-0 flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            href={`/import?id=${encodeURIComponent(imp.id)}`}
            className="min-w-0 truncate text-sm font-semibold text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {imp.filename}
          </Link>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="mt-0.5 flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-meta text-ink-2">
          <span>{imp.bank || "Unknown bank"}</span>
          <span className="tabular">{periodLabel(imp.periodFrom, imp.periodTo)}</span>
          <span>
            Uploaded {formatTimestamp(imp.createdAt)}
            {imp.createdByName ? ` by ${imp.createdByName}` : ""}
          </span>
        </p>
        <p className="mt-0.5 flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-2 tabular">
          <span>{plural(c.total, "row")}</span>
          {imp.status === "committed" && created !== undefined ? (
            <span>{plural(created, "transaction")} added</span>
          ) : (
            <>
              <span>{c.new} new</span>
              <span>{c.recorded} already recorded</span>
              {c.review ? <span>{c.review} to review</span> : null}
            </>
          )}
          {imp.status === "rolled_back" && imp.rolledBackAt ? <span>Rolled back {formatTimestamp(imp.rolledBackAt)}</span> : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {imp.status === "committed" ? (
          <Button variant="ghost" size="sm" onClick={onRollback}>
            Roll back
          </Button>
        ) : imp.status === "draft" ? (
          <Button variant="ghost" size="sm" onClick={onRollback}>
            Discard
          </Button>
        ) : null}
        <Link
          href={`/import?id=${encodeURIComponent(imp.id)}`}
          className="inline-flex h-8 items-center gap-1 rounded-control border border-line-strong bg-surface px-2.5 text-meta font-semibold text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent pointer-coarse:h-10"
        >
          {imp.status === "draft" ? "Continue review" : "Open"}
          <span className="sr-only"> {imp.filename}</span>
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </li>
  );
}
