import { errorMessage, isApiError } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import type { AccountType, ImportRow, ImportSection, ImportStatus } from "@/lib/types";
import type { BadgeTone } from "@/components/ui/Badge";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ACCEPT = ".pdf,.csv,application/pdf,text/csv";

/** Friendly copy for upload failures (by backend error code / status). */
export function uploadErrorMessage(err: unknown): string {
  if (isApiError(err)) {
    if (err.code === "file_too_large" || err.status === 413) return "This file is larger than 4 MB. Export a shorter period, or use the CSV export.";
    if (err.code === "unsupported_file") return "Only PDF and CSV bank statements can be imported.";
    if (err.code === "unreadable_statement")
      return "We couldn't find transactions in this file. Check it is a bank statement (not a scanned image), or try the bank's CSV export.";
    if (err.status === 429) return "Too many uploads in a short time. Wait a minute and try again.";
  }
  return errorMessage(err, "Couldn't upload the statement");
}

/** Client-side check before uploading. Returns an error message or null. */
export function checkFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf") && !name.endsWith(".csv")) return "Only PDF and CSV bank statements can be imported.";
  if (file.size > MAX_UPLOAD_BYTES) return "This file is larger than 4 MB. Export a shorter period, or use the CSV export.";
  if (file.size === 0) return "This file is empty.";
  return null;
}

export const IMPORT_STATUS: Record<ImportStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "warn" },
  committed: { label: "Imported", tone: "accent" },
  rolled_back: { label: "Rolled back", tone: "neutral" },
};

export type RowFilter = "all" | "new" | "recorded" | "transfer" | "review" | "skipped";

export const FILTER_LABEL: Record<Exclude<RowFilter, "all">, string> = {
  new: "New",
  recorded: "Already recorded",
  transfer: "Transfer",
  review: "Needs review",
  skipped: "Skipped",
};

export function matchesFilter(r: ImportRow, f: RowFilter): boolean {
  if (f === "all") return true;
  if (f === "skipped") return r.action === "skip";
  return r.status === f;
}

/** Status chip for a row. A review row someone has checked shows "Reviewed". */
export function rowStatusChip(r: ImportRow): { label: string; tone: BadgeTone } {
  switch (r.status) {
    case "new":
      return { label: "New", tone: "accent" };
    case "recorded":
      return { label: "Already recorded", tone: "neutral" };
    case "transfer":
      return { label: "Transfer", tone: "outline" };
    case "review":
      return r.needsReview ? { label: "Needs review", tone: "warn" } : { label: "Reviewed", tone: "neutral" };
  }
}

/** Rows that bulk "Include all" may switch on: not already in the app, not the duplicate leg of a transfer pair. */
export function canBulkInclude(r: ImportRow): boolean {
  return r.status !== "recorded" && !(r.pairedRowId && r.action === "skip");
}

export function periodLabel(from: string | null | undefined, to: string | null | undefined): string {
  if (!from && !to) return "Period unknown";
  if (from && to) return `${formatDate(from)} to ${formatDate(to)}`;
  return formatDate(from ?? to);
}

export function sectionTitle(s: ImportSection): string {
  const product = s.product || s.bank || "Account";
  return s.last4 ? `${product} ..${s.last4}` : product;
}

const ACCOUNT_TYPES: AccountType[] = ["bank", "savings", "credit_card", "cash", "loan", "investment"];

/** Map the parser's account type onto an app account type (falls back to bank). */
export function toAccountType(t: string | null | undefined): AccountType {
  const v = (t ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if ((ACCOUNT_TYPES as string[]).includes(v)) return v as AccountType;
  if (v.includes("card")) return "credit_card";
  if (v.includes("saving")) return "savings";
  if (v.includes("loan")) return "loan";
  return "bank";
}

/** "14 Feb 2026, 10:32" in the user's locale for timestamps. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
