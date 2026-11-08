"use client";
import { useColorScheme } from "@mui/material/styles";
import { tokens, type ColorMode } from "@/lib/theme-tokens";

/**
 * Categorical chart palette (fixed order, never cycled). Validated reference palette
 * (dataviz skill): light steps for the light surface, dark steps for the dark surface.
 * Slot 8 (red) is intentionally not used for categories — red is reserved for debt/overspend.
 */
export const CATEGORICAL: Record<ColorMode, string[]> = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"],
};

/** Neutral for an "Other" bucket. */
export const OTHER_COLOR: Record<ColorMode, string> = { light: "#9ca3af", dark: "#64748b" };

/** Resolved light/dark mode (follows the ThemeToggle, incl. "system"). */
export function useChartMode(): ColorMode {
  const { mode, systemMode } = useColorScheme();
  const resolved = mode === "system" ? systemMode : mode;
  return resolved === "dark" ? "dark" : "light";
}

export function useChartColors() {
  const mode = useChartMode();
  const t = tokens[mode];
  return {
    mode,
    categorical: CATEGORICAL[mode],
    other: OTHER_COLOR[mode],
    primary: t.primary,
    danger: t.danger,
    muted: t.muted,
    fg: t.fg,
    border: t.border,
    surface: t.surface,
  };
}
