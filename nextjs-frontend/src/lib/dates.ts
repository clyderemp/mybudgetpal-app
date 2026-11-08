// Date helpers. Transactions use calendar dates (YYYY-MM-DD) in Asia/Dubai.
// Months are "YYYY-MM". Never use Date#toISOString() for calendar dates (UTC shift).
import dayjs, { type Dayjs } from "dayjs";

export const APP_TZ = "Asia/Dubai";

/** Today's calendar date in Asia/Dubai as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Current month "YYYY-MM" in Asia/Dubai. */
export function currentMonth(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function isMonth(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

/** addMonths("2026-01", -1) → "2025-12". */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function prevMonth(month: string): string {
  return addMonths(month, -1);
}

export function nextMonth(month: string): string {
  return addMonths(month, 1);
}

/** First and last calendar day of a month: ["2026-02-01", "2026-02-28"]. */
export function monthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`];
}

/** "2026-02" → "Feb 2026" (or "February 2026" with long). */
export function formatMonth(month: string | null | undefined, long = false): string {
  if (!month) return "—";
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { month: long ? "long" : "short", year: "numeric", timeZone: "UTC" });
}

/** "2026-02-14" → "14 Feb 2026" (or "14 Feb" when short). */
export function formatDate(date: string | null | undefined, short = false): string {
  if (!date) return "—";
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(short ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}

/** Relative label for list grouping: Today / Yesterday / 14 Feb 2026. */
export function formatDayLabel(date: string, today: string = todayISO()): string {
  if (date === today) return "Today";
  const y = dayjs(today).subtract(1, "day").format("YYYY-MM-DD");
  if (date === y) return "Yesterday";
  return formatDate(date);
}

/** Dayjs <-> ISO date string (for MUI date pickers). */
export function toDayjs(date: string | null | undefined): Dayjs | null {
  if (!date) return null;
  const d = dayjs(date);
  return d.isValid() ? d : null;
}

export function fromDayjs(d: Dayjs | null | undefined): string | null {
  return d && d.isValid() ? d.format("YYYY-MM-DD") : null;
}
