// Money is integer fils (1 AED = 100 fils). Never store floats; format for display only.

const formatterCache = new Map<string, Intl.NumberFormat>();

function numberFormat(minFrac: number): Intl.NumberFormat {
  const key = String(minFrac);
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { minimumFractionDigits: minFrac, maximumFractionDigits: 2 });
    formatterCache.set(key, f);
  }
  return f;
}

export interface FormatFilsOptions {
  /** Show "+" for positive values. */
  signed?: boolean;
  /** Drop ".00" decimals (e.g. compact tiles / chart axes). */
  noDecimals?: boolean;
  /** Omit the currency code. */
  hideCurrency?: boolean;
}

/** formatFils(123450) → "AED 1,234.50"; formatFils(-500) → "-AED 5.00". */
export function formatFils(
  fils: number | null | undefined,
  currency = "AED",
  opts: FormatFilsOptions = {},
): string {
  if (fils === null || fils === undefined || Number.isNaN(fils)) return "—";
  const negative = fils < 0;
  const abs = Math.abs(Math.round(fils));
  const value = opts.noDecimals ? Math.round(abs / 100) : abs / 100;
  const num = opts.noDecimals ? numberFormat(0).format(value) : numberFormat(2).format(value);
  const body = opts.hideCurrency ? num : `${currency} ${num}`;
  if (negative) return `-${body}`;
  if (opts.signed && fils > 0) return `+${body}`;
  return body;
}

/** Compact form for charts: 1234500 → "AED 12.3K". */
export function formatFilsCompact(fils: number | null | undefined, currency = "AED"): string {
  if (fils === null || fils === undefined || Number.isNaN(fils)) return "—";
  const f = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const s = f.format(Math.abs(fils) / 100);
  return `${fils < 0 ? "-" : ""}${currency} ${s}`;
}

/**
 * parseToFils("1,234.50") → 123450. Accepts optional currency code/sign, commas,
 * spaces. Returns null for empty/invalid input or more than 2 decimals.
 */
export function parseToFils(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  let s = input.trim().replace(/^[A-Za-z]{3}\s*/, "").replace(/[\s,]/g, "");
  if (!s) return null;
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!/^\d*(\.\d{0,2})?$/.test(s) || s === "" || s === ".") return null;
  const [whole, frac = ""] = s.split(".");
  const fils = Number(whole || "0") * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(fils)) return null;
  return negative ? -fils : fils;
}

/** Fils → plain editable string ("1234.50") for inputs. */
export function filsToInput(fils: number | null | undefined): string {
  if (fils === null || fils === undefined) return "";
  const neg = fils < 0;
  const abs = Math.abs(fils);
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return neg ? `-${s}` : s;
}

/** Basis points → percent string: 2999 → "29.99%". */
export function formatBps(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return "—";
  return `${(bps / 100).toFixed(2)}%`;
}

/** 0.234 → "23%". */
export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}
