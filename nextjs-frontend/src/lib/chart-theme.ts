"use client";
import { useColorScheme } from "@mui/material/styles";
import { formatFilsCompact } from "./money";
import { tokens, type ColorMode } from "./theme-tokens";

/**
 * Chart defaults for MUI x-charts. Gridlines, axis lines and tabular tick labels are styled
 * globally in globals.css (both themes) — only colours and props live here.
 *
 * Categorical palette: fixed order, never cycled; validated for light/dark surfaces.
 * Red is NOT a category colour — it is reserved for debt/overspend.
 */
export const CATEGORICAL: Record<ColorMode, string[]> = {
  light: ["#0F766E", "#2A5DB0", "#B7791F", "#7A4BB0", "#2F855A", "#C05621", "#4A5568"],
  dark: ["#2BB3A3", "#6B9BE8", "#E0A84A", "#A98BE0", "#5FC08A", "#EE8A4F", "#A9B4C6"],
};

/** Neutral for an "Other" bucket. */
export const OTHER_COLOR: Record<ColorMode, string> = { light: "#B4BCC8", dark: "#4A5A78" };

/** Resolved light/dark mode (follows the theme toggle, incl. "system"). */
export function useChartMode(): ColorMode {
  const { mode, systemMode } = useColorScheme();
  const resolved = mode === "system" ? systemMode : mode;
  return resolved === "dark" ? "dark" : "light";
}

/** Series colours: income/in-flows = accent, expenses/out-flows = ink, debt/overspend = danger. */
export function useChartColors() {
  const mode = useChartMode();
  const t = tokens[mode];
  return {
    mode,
    categorical: CATEGORICAL[mode],
    other: OTHER_COLOR[mode],
    income: t.accent,
    expense: mode === "dark" ? t.ink2 : t.ink,
    net: mode === "dark" ? "#6B9BE8" : "#2A5DB0",
    debt: t.danger,
    accent: t.accent,
    danger: t.danger,
    warn: t.warn,
    ink: t.ink,
    ink2: t.ink2,
    ink3: t.ink3,
    line: t.line,
    surface: t.surface,
    // legacy keys
    primary: t.accent,
    muted: t.ink2,
    fg: t.ink,
    border: t.line,
  };
}

/** Spread into <LineChart>/<BarChart>: compact margins, no legend chrome, thin grid. */
export const CHART_DEFAULTS = {
  margin: { top: 12, right: 12, bottom: 8, left: 8 },
  grid: { horizontal: true },
} as const;

/** y-axis value formatter for fils values: "AED 12.3K". */
export const filsAxisFormatter = (v: number | null) => (v === null ? "" : formatFilsCompact(v));
