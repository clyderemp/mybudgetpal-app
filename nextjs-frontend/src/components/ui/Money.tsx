import { formatFils } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Money display (tabular). Flow colouring per design rules:
 * - flow="in"  → accent with "+"
 * - flow="out" → ink with leading "−"
 * - tone="danger" only for overspend / debt.
 * Without `flow`, the sign of `fils` is used as-is in ink.
 */
export function Money({
  fils,
  currency = "AED",
  flow,
  tone,
  noDecimals,
  hideCurrency,
  className,
}: {
  fils: number | null | undefined;
  currency?: string;
  flow?: "in" | "out" | "neutral";
  tone?: "default" | "muted" | "danger" | "accent";
  noDecimals?: boolean;
  hideCurrency?: boolean;
  className?: string;
}) {
  let text: string;
  if (fils === null || fils === undefined) text = "—";
  else if (flow === "in") text = formatFils(Math.abs(fils), currency, { signed: true, noDecimals, hideCurrency });
  else if (flow === "out") text = formatFils(-Math.abs(fils), currency, { noDecimals, hideCurrency }).replace(/^-/, "−");
  else text = formatFils(fils, currency, { noDecimals, hideCurrency }).replace(/^-/, "−");
  const color =
    tone === "danger"
      ? "text-danger"
      : tone === "accent" || (flow === "in" && tone !== "muted")
        ? "text-accent"
        : tone === "muted"
          ? "text-ink-2"
          : "text-ink";
  return <span className={cn("tabular whitespace-nowrap", color, className)}>{text}</span>;
}
