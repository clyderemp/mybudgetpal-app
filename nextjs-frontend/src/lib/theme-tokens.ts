// Design tokens — single TS source for the MUI theme and charts. MUST stay in sync with
// the CSS variables in src/app/globals.css (:root / .dark). Tailwind utilities use the
// CSS variables (bg-canvas, bg-surface, border-line, text-ink, text-ink-2, text-accent...).

export const tokens = {
  light: {
    canvas: "#F6F7F9",
    surface: "#FFFFFF",
    surface2: "#F1F3F6",
    line: "#E3E6EB",
    lineStrong: "#CDD2DA",
    ink: "#14213D",
    ink2: "#4A5568",
    ink3: "#7A8496",
    /** Text on an ink (primary button) background. */
    inkFg: "#FFFFFF",
    accent: "#0F766E",
    accentFg: "#FFFFFF",
    accentSoft: "#E6F2F1",
    danger: "#B42318",
    dangerSoft: "#FDECEA",
    warn: "#B54708",
    warnSoft: "#FEF0E3",
    sidebar: "#0E1A2F",
    sidebarInk: "#C9D1DE",
    sidebarActive: "#FFFFFF",
    sidebarActiveBg: "#1B2A44",
    sidebarLine: "#1E2C45",

    // Legacy aliases (pre-redesign names, still used by pages).
    bg: "#F6F7F9",
    border: "#E3E6EB",
    fg: "#14213D",
    muted: "#4A5568",
    primary: "#0F766E",
    primaryFg: "#FFFFFF",
    primarySoft: "#E6F2F1",
    success: "#0F766E",
    warning: "#B54708",
    info: "#4A5568",
  },
  dark: {
    canvas: "#0B1220",
    surface: "#111A2B",
    surface2: "#16213A",
    line: "#22304A",
    lineStrong: "#2E3F5E",
    ink: "#E7ECF3",
    ink2: "#A9B4C6",
    ink3: "#7D8AA0",
    inkFg: "#0B1220",
    accent: "#2BB3A3",
    accentFg: "#04201D",
    accentSoft: "#0F2B2C",
    danger: "#F0645A",
    dangerSoft: "#3A1A1F",
    warn: "#F5A35C",
    warnSoft: "#33220F",
    sidebar: "#08101D",
    sidebarInk: "#C9D1DE",
    sidebarActive: "#FFFFFF",
    sidebarActiveBg: "#16223A",
    sidebarLine: "#16213A",

    bg: "#0B1220",
    border: "#22304A",
    fg: "#E7ECF3",
    muted: "#A9B4C6",
    primary: "#2BB3A3",
    primaryFg: "#04201D",
    primarySoft: "#0F2B2C",
    success: "#2BB3A3",
    warning: "#F5A35C",
    info: "#A9B4C6",
  },
} as const;

export type ColorMode = keyof typeof tokens;

/** Font stack (Public Sans loaded via next/font in the root layout). */
export const FONT_STACK = "var(--font-public-sans), ui-sans-serif, system-ui, sans-serif";

/** The single shadow token — menus, popovers and dialogs only. */
export const SHADOW_POPOVER = "0 8px 24px -6px rgb(10 20 40 / 0.18), 0 2px 6px -2px rgb(10 20 40 / 0.10)";
