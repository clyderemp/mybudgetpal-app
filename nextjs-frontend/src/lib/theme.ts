"use client";
import { createTheme } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";
import { FONT_STACK, SHADOW_POPOVER, tokens, type ColorMode } from "./theme-tokens";

function palette(mode: ColorMode) {
  const t = tokens[mode];
  return {
    mode,
    primary: { main: t.accent, contrastText: t.accentFg },
    secondary: { main: t.ink, contrastText: t.inkFg },
    error: { main: t.danger },
    warning: { main: t.warn },
    success: { main: t.accent },
    info: { main: t.ink2 },
    background: { default: t.canvas, paper: t.surface },
    text: { primary: t.ink, secondary: t.ink2, disabled: t.ink3 },
    divider: t.line,
    action: { hover: t.surface2, selected: t.accentSoft },
  } as const;
}

/**
 * MUI theme with CSS variables + class-based color schemes (".light"/".dark" on <html>)
 * so MUI and Tailwind's `dark:` variant switch together. Mirrors globals.css tokens.
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: { light: { palette: palette("light") }, dark: { palette: palette("dark") } },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: FONT_STACK,
    fontSize: 14,
    htmlFontSize: 16,
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: "none" } },
      defaultProps: { elevation: 0 },
    },
    MuiPopover: { styleOverrides: { paper: { boxShadow: SHADOW_POPOVER, border: "1px solid var(--color-line)" } } },
    MuiMenu: { styleOverrides: { paper: { boxShadow: SHADOW_POPOVER, border: "1px solid var(--color-line)" } } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: "var(--color-ink)", color: "var(--color-ink-fg)", fontSize: 12, borderRadius: 4 },
      },
    },
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiDataGrid: {
      defaultProps: {
        rowHeight: 40,
        columnHeaderHeight: 36,
        disableRowSelectionOnClick: true,
      },
      styleOverrides: {
        root: {
          border: "none",
          fontVariantNumeric: "tabular-nums",
          fontSize: 14,
          color: "var(--color-ink)",
          "--DataGrid-containerBackground": "var(--color-surface-2)",
          "--DataGrid-rowBorderColor": "var(--color-line)",
          "--unstable_DataGrid-radius": "0px",
        },
        columnHeaders: { borderBottom: "1px solid var(--color-line)" },
        columnHeader: {
          backgroundColor: "var(--color-surface-2)",
          color: "var(--color-ink-2)",
          fontSize: 13,
          fontWeight: 600,
          "&:focus, &:focus-within": { outline: "none" },
          "&:focus-visible": { outline: "2px solid var(--color-accent)", outlineOffset: -2 },
        },
        columnHeaderTitle: { fontWeight: 600 },
        columnSeparator: { color: "var(--color-line)" },
        cell: {
          borderColor: "var(--color-line)",
          "&:focus, &:focus-within": { outline: "none" },
          "&:focus-visible": { outline: "2px solid var(--color-accent)", outlineOffset: -2 },
        },
        row: {
          "&:hover": { backgroundColor: "var(--color-surface-2)" },
          "&.Mui-selected, &.Mui-selected:hover": { backgroundColor: "var(--color-accent-soft)" },
        },
        footerContainer: { borderTop: "1px solid var(--color-line)", minHeight: 44 },
        overlay: { backgroundColor: "transparent" },
      },
    },
  },
});
