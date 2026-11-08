# Frontend guide (for page agents)

Next.js 16.4 (App Router, Turbopack), React 19, Tailwind v4, Radix + MUI v9 (x-data-grid, x-charts), TanStack Query v5, RHF + Zod v4, cmdk.
Contract: `../docs/spec.md`. All deps are installed. **Do not add packages.**

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null
npm run lint && npx tsc --noEmit      # both must be clean
```
A dev server is usually already running on http://localhost:3000. Don't start, stop or restart it.

## Where things live
- Pages: `src/app/(app)/<route>/page.tsx` → views in `src/features/<area>/`. Pages are client components (`"use client"`).
- Foundation (owned by the shell; don't edit without coordinating): `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/**`, `src/components/shell/**`, `src/lib/**`.
- Next 16: `middleware.ts` is now **`src/proxy.ts`**.

---

## Design rules (binding)

Enterprise and institutional, in the spirit of private-banking or treasury software. Dense but calm. **Not** a consumer card kit.

### Colour tokens (Tailwind classes; light and dark are automatic)
| Token | Use |
|---|---|
| `bg-canvas` | page background |
| `bg-surface` | panels, top bar, dialogs |
| `bg-surface-2` | table header band, hover, subtle fills |
| `border-line` / `border-line-strong` | panel borders and rules / control borders |
| `text-ink` | primary text, primary buttons (`bg-ink text-ink-fg`) |
| `text-ink-2` | secondary text, labels, meta |
| `text-ink-3` | **icons, placeholders, disabled only.** It is below AA for body text on white |
| `text-accent` / `bg-accent-soft` | positive values, inflows, links, focus ring, selected state |
| `text-danger` / `bg-danger-soft` | **overspend, debt and destructive actions only** |
| `text-warn` / `bg-warn-soft` | near limit (85–100%), cautions |
| `bg-sidebar`… | shell only |

Legacy names still resolve to the new palette (`bg-bg`, `border-border`, `text-fg`, `text-muted`, `text-primary`, `bg-primary-soft`, `text-success`, `text-warning`, `text-info`). **New code uses the canonical names above.**
MUI uses the same palette: `primary` = accent, `secondary` = ink, `error` = danger, `warning` = warn, `text.secondary` = ink-2, `divider` = line.

### Type
Public Sans for everything; the app base size is 14px.
- Scale: `text-xs` 12 · `text-meta` 13 · `text-sm` 14 · `text-base` 16 · `text-title` 20 · `text-2xl` 24 · `text-kpi` 26 · `text-[32px]` 32.
- Page title 20/600 (`PageHeader` does it). Panel titles 14/600. KPI figures `text-kpi font-semibold`.
- **All money and number cells use the `tabular` class** (`<Money>` and `DataTable` apply it already).
- **Forbidden:** all-caps labels, `uppercase`, `tracking-*` eyebrows, monospace labels, "→" in button text, and middle-dot meta strings such as `Fuel · ENBD · Today`. Put each fact in its own column or element, or separate with a comma.

### Surfaces and shape
- Panels: `bg-surface border border-line rounded-container`, **no shadow**. Use `<Panel>`.
- Radius: containers `rounded-container` (8px), controls `rounded-control` (6px), chips `rounded-chip` (4px).
- No gradients. No drop shadows except menus, popovers and dialogs (`shadow-pop`, the only shadow token).

### Density
- Table rows 40px. Controls 32–36px (`Button` md = 36, sm = 32). Panel padding 16–20px (`p-4 md:p-5`).
- Page gutter: 24px on desktop and 16px on phones (the shell already applies both). Gaps between panels: `gap-4` or `gap-5`.

### Money display
- Right-aligned in tables (`align: "right", headerAlign: "right"`).
- Outflows in **ink with a leading minus** and inflows in **accent with "+"**: `<Money fils flow="out" | "in" />`.
- Never red except overspend or debt (`tone="danger"`).

### Copy
- Sentence case everywhere. Plain verbs.
- Buttons say exactly what happens: "Save budget", "Record payment", "Add account". Avoid bare "Submit" or "OK".
- Empty states tell the user what to do next, with one action.
- Errors say what happened and how to fix it (`<InlineError onRetry>` for queries, `notify.error(err, "Couldn't save budget")` for actions).

### Accessibility
- Visible accent focus ring on every interactive element (kit components have it, and the global `:focus-visible` covers the rest).
- Every control has a label. Icon-only buttons need `aria-label`.
- `prefers-reduced-motion` is respected globally. Text must meet AA contrast in both themes (see the ink-3 rule above).

---

## Shell (done; don't rebuild)
- Desktop: a dark navy sidebar (248px, collapsible to a 64px rail) with nav groups Overview (Dashboard, Insights), Money (Transactions, Accounts, Budget) and Planning (Plan). Settings and the user menu are pinned at the bottom.
- The top bar is 56px. It holds breadcrumbs, then the **period selector** (on `/`, `/insights`, `/transactions` and `/budget`), Search (⌘K/Ctrl+K command palette), the **New** menu (transaction, account, debt, goal), the theme menu and the avatar menu.
- Phone (<768px): compact top bar (title, search, avatar), bottom tabs (Dashboard, Transactions, Budget, Plan, More) and a floating add button. The shell pads for these.
- **Your page starts with `<PageHeader>`.** Breadcrumbs are already shown above it, so don't repeat a "Home / Page" trail.

### Shell hooks
- `usePeriod()` from `@/lib/period` returns `{ month, thisMonth, isCurrent, range: [from, to], label, setMonth, prev, next, canNext }`.
  - It is backed by the URL `?month=YYYY-MM`. **Month-scoped pages (Dashboard, Insights, Transactions, Budget) must read the month from this hook** and drop their own month pickers.
  - On phones the top bar has no period selector, so render `<PeriodSelector />` (from `@/components/shell/PeriodSelector`) in your PageHeader actions inside `md:hidden`.
- `useCreate()` from `@/components/shell/CreateProvider` opens the global create dialogs with `create("transaction" | "account" | "debt" | "goal")`.
- `useTransactionDialog()` from `@/components/transactions/TransactionDialogProvider` provides `openCreate(defaults?)` and `openEdit(txn)`. Don't build another transaction form.
- `useCommandPalette()` opens ⌘K.

---

## UI kit: `import { … } from "@/components/ui"`

| Component | Notes |
|---|---|
| `Button` | Variants: `primary` (ink, one per view), `secondary` (outline; `outline` is an alias), `ghost`, `danger`, `accent` (rare). Sizes: `sm` 32, `md` 36, `lg` 40, `icon` 36, `icon-sm` 32. `loading`, `fullWidth`. `buttonClasses(variant, size)` styles a `<Link>`. |
| `ActionButton` | `onAction={async () => …}` handles the spinner and `aria-busy`, toasts errors, and takes an optional `successMessage`. |
| `Panel` | `{title, description, actions, flush, bodyClassName}` gives an optional header row (title on the left, actions on the right) above a rule. Use `flush` for tables and lists that run edge to edge. `PanelHeader` is exported on its own. `Card`, `CardHeader` and `CardContent` remain as legacy aliases. |
| `PageHeader` | `{title, description, actions}`. Title is 20/600 and the description is 13px ink-2. |
| `StatBand` + `StatBandItem` | **The dashboard centrepiece.** One full-width panel split by vertical 1px rules. Item props: `{label, value, delta: {label, tone, direction, context}, spark: number[], sparkTone, tone, loading}`. Columns: 4 at ≥1280px, 2 at ≥640px, stacked below that. |
| `StatTile` | A single KPI in its own panel. Use it sparingly and never in a row of four (that's what the band is for). |
| `DeltaText` | `{delta}` renders the arrow, tabular label and context ("vs Oct"). Tones: `positive` accent, `warning` warn, `negative` danger (overspend or debt only), `neutral` ink-2. |
| `Sparkline` | `{data, tone: "ink" \| "accent" \| "danger" \| "muted", height, label}`. MUI SparkLineChart without axes. |
| `Money` | `{fils, currency?, flow: "in" \| "out" \| "neutral", tone?: "danger" \| "muted" \| "accent", noDecimals, hideCurrency}`. **All money display goes through this.** |
| `DataTable` | MUI DataGrid with 40px rows, a 36px header on a surface-2 band, line rules and tabular numerals. Put it in `<Panel flush>`. Use it on desktop only (`hidden md:block`) and render list rows on phones. `numericColumn` spreads `align`/`headerAlign: "right"`. |
| `Field`, `Input`, `Textarea` | Labels sit above fields. `invalid`. `labelClasses` and `inputClasses` are exported. |
| `FormDialog` | `{open, onOpenChange, title, description, onSubmit, submitLabel, submitting, submitDisabled, submitVariant, footerStart, size: "sm" \| "md" \| "lg"}`. **All forms go here.** It is centred on desktop and becomes a full-height sheet on phones, and it autofocuses the first field. |
| `FormGrid`, `FormSection` | 2-column grid on desktop and 1 column on phones. Full-width fields take `className="md:col-span-2"`. See `TransactionFormDialog` for the reference form. |
| `ConfirmDialog` | `{title, description, confirmLabel, onConfirm, danger}`. Uses the `sm` width. confirmLabel must name the action ("Archive account"). |
| `DetailDrawer` + `DetailRow` | A 440px right drawer for viewing records (wrap rows in `<dl>`). |
| `Dropdown` | Select: `options [{value, label, description?, group?, icon?}]`, single or `multiple`, `clearLabel`. `appearance="chip"` is the filter-bar style (32px). |
| `ActionMenu` | Row "More actions" menu: `items [{label, onSelect, icon, danger, shortcut} \| {separator: true}]`. Low-level parts: `Menu`, `MenuTrigger`, `MenuContent`, `MenuItem`, `MenuRadioGroup`, `MenuRadioItem`, `MenuLabel`, `MenuSeparator`. |
| `MoneyInput` | `{value: fils \| null, onChange}`. Shows an AED prefix and right-aligned tabular digits, and accepts "1,234.50". Use it via RHF `<Controller>` with `z.number().int().positive()`. |
| `DateField` | `{value: "YYYY-MM-DD" \| null, onChange}` (native picker). |
| `SegmentedControl` | `{options, value, onChange, aria-label, size, fullWidth}` for type toggles, strategy toggles and view switches. |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Underline tabs (ink indicator). |
| `ProgressBar` | `{value, max, label, size, invertColors}`. Accent below 85%, warn from 85% to 100%, danger when over. `invertColors` for goals (never red). |
| `Badge` / `Chip` | `tone: neutral \| accent \| danger \| warn \| ink \| outline`. 20px tall with a 4px radius. |
| `Avatar`, `AvatarStack`, `initials()` | Initials with a stable colour per name. |
| `Tip` | Tooltip: `{content, side}`. |
| `EmptyState` | `{icon, title, description, action}`. |
| `Skeleton`, `SkeletonList` | SkeletonList draws 40px rows. |
| `InlineError` | `{error, title, onRetry, retrying}`. The query-failure block. |
| `notify` | `notify("msg")`, `notify.success(msg)`, `notify.error(err, title?)`. **All action feedback goes through this.** |

## Charts (MUI x-charts)
- `import { useChartColors, CHART_DEFAULTS, filsAxisFormatter, CATEGORICAL } from "@/lib/chart-theme"`.
  - Series colours: `income` = accent, `expense` = ink (ink-2 in dark mode), `net` = blue, `debt` = danger.
  - `categorical[]` is a fixed order that never cycles and never uses red. `other` is the neutral "Other" bucket.
- Gridlines, axis lines and tabular 12px tick labels are styled globally for both themes. Turn on `grid={{ horizontal: true }}` (in `CHART_DEFAULTS`) and use `valueFormatter: filsAxisFormatter` on money axes.
- Keep charts quiet: no legends when a single series is labelled by its panel title, no area gradients, and 2px lines.
- `@/features/common/chart-theme` still works but is legacy. Prefer `@/lib/chart-theme`.

## Data hooks: `import { … } from "@/lib/queries"`
| Area | Queries | Mutations |
|---|---|---|
| Auth | `useMe()` (user and household, with `household.members`), `useAuthStatus()` | `useLogin`, `useRegister`, `useJoin`, `useLogout` |
| Household | n/a | `useUpdateHousehold`, `useCreateInvite` |
| Accounts | `useAccounts()` | `useCreateAccount`, `useUpdateAccount`, `useArchiveAccount` |
| Categories | `useCategories()` | `useCreateCategory`, `useUpdateCategory`, `useArchiveCategory` |
| Transactions | `useTransactions(query, {enabled})` returns `{items, total}`. Query fields: `from`, `to`, `accountId`, `categoryId`, `type`, `q`, `page`, `pageSize`, `sort` | `useCreateTransaction`, `useUpdateTransaction`, `useDeleteTransaction` |
| Budget | `useBudget(month)` | `usePutBudget(month)`, `useCopyBudget(month)(fromMonth)` |
| Debts | `useDebts()` | `useCreateDebt`, `useUpdateDebt`, `useArchiveDebt`, `useDebtPayment` |
| Goals | `useGoals()` | `useCreateGoal`, `useUpdateGoal`, `useArchiveGoal`, `useGoalContribution` |
| Plan | `usePlan()`, `usePayoff()`, `useCompare()` | `usePutPlan` |
| Insights | `useInsightsSummary(month)`, `useInsightsTrends(months)`, `useInsightsForecast()`, `useInsightsAnomalies(month)`, `useInsightsHealth()` | n/a |
| Dashboard | `useDashboard()` | n/a |

Mutations already invalidate their dependent caches. Types live in `@/lib/types`. The low-level client is `api` from `@/lib/api`, and `errorMessage(err)` turns any error into friendly text.

## Conventions
- **Money**: integer fils everywhere. Display with `<Money>`, or `formatFils` / `formatFilsCompact` plus `tabular`. Non-AED accounts show their own currency and are excluded from AED totals with a note.
- **Dates** (`@/lib/dates`): `todayISO()`, `currentMonth()`, `addMonths`, `monthRange`, `formatDate`, `formatMonth`. Never use `toISOString()` for calendar dates.
- **Responsive**: below `md` (768px) render list rows instead of DataTable. There must be no horizontal scroll at 360px, so use `min-w-0`, `truncate` and `flex-wrap`.
- **Forms**: RHF + `zodResolver` with `noValidate`. Map server errors with `applyApiErrors` (`@/lib/form-errors`).
- **States**: every query shows Skeleton while loading, EmptyState when empty, and InlineError with retry on failure.
- No `localStorage` for data (UI preferences only, inside try/catch). No `window.location` navigation; use `next/link` or `useRouter`.
- `cn()` (`@/lib/utils`) understands the custom tokens (`text-meta`, `rounded-control`, `shadow-pop`…), so merging works correctly.
