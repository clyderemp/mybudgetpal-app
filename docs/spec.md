# MyBudgetPal — Rebuild Spec & Contract

Personal household finance app for Clyde and his wife. **Not a public website**: private web app, two users today, a family household later. Everything in a household is fully shared (no private records). Goal: help the household make financial decisions — budget, see spending vs income vs savings, plan and pay off debt, reach financial freedom.

This file is the **contract** every part of the build follows. If code and this file disagree, fix the code (or update this file deliberately).

## 1. Layout

```
mybudgetpal-app/
  nextjs-frontend/   Next.js (App Router, TypeScript, Tailwind v4, Radix UI + MUI)
  fastapi-backend/   FastAPI (Python 3.14), MongoDB via Beanie, numpy/pandas/scikit-learn analytics
  docs/              this spec
  legacy/            old Vite/Firebase app, reference only — never import from it
```

## 2. Global rules

- **Money is integer fils** (1 AED = 100 fils). Field names end in `_fils` (backend) / `Fils` (frontend). Never floats for stored money. Format for display only (`AED 1,234.50`).
- Base currency AED. Each account has a `currency` field (default `"AED"`); v1 does no FX conversion — non-AED accounts are shown in their own currency and excluded from AED totals with a note.
- Dates: transactions use calendar `date` (`YYYY-MM-DD`, Asia/Dubai). Timestamps are UTC ISO-8601. Months are `"YYYY-MM"`.
- Inject "today"/"now" into pure logic (parameters), never call `datetime.now()` inside analytics functions.
- **Tenant isolation:** every domain document has `household_id`. The household always comes from the authenticated session, never from the request body/query. Every read/write filters by it. Accessing another household's id returns 404.
- **No hard deletes** of transactions/accounts/debts/goals: soft delete with `deleted_at` (transactions) or `archived: true` (accounts, debts, goals, categories). Lists exclude them by default.
- Validate everything with Pydantic models (backend) and Zod (frontend forms). Reject unknown fields (`extra="forbid"`) on request bodies.

## 3. Security

- Passwords: argon2id (`argon2-cffi`). Min length 10.
- Sessions: FastAPI issues an **access JWT (15 min)** and an opaque **refresh token (30 days, rotating, stored hashed with sha256 in `sessions` collection, reuse ⇒ revoke all sessions of that user)**. Both are cookies: `mbp_access`, `mbp_refresh`; `HttpOnly`, `SameSite=Lax`, `Secure` when `COOKIE_SECURE=true`, `Path=/`. JWT secret from env `JWT_SECRET` (≥32 bytes, app refuses to start otherwise). HS256, claims `sub` (user id), `hid` (household id), `exp`, `iat`, `jti`.
- CSRF: double-submit. On login/refresh the backend also sets readable cookie `mbp_csrf` (random). Every non-GET/HEAD/OPTIONS request to `/api/*` except `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/join` must send header `X-CSRF-Token` equal to the cookie, AND `Origin` (if present) must equal `APP_ORIGIN`. Else 403.
- Rate limit: login/register/join 10/min per IP (slowapi or simple in-memory limiter), generic 300/min.
- Security headers on backend responses (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`). Frontend `next.config` sets CSP, HSTS (prod), frame-ancestors none.
- Registration is **closed** except: (a) `POST /auth/register` works only when there are zero users (bootstrap the first household) OR env `ALLOW_REGISTRATION=true`; (b) `POST /auth/join` with a valid invite code. Invite codes: 10+ random url-safe chars, single use, expire in 7 days, stored hashed.
- Errors: JSON `{"error": {"code": "string", "message": "string", "fields"?: {field: msg}}}`. Never leak stack traces. Generic "invalid email or password".
- CORS: not needed (frontend proxies `/api/*` to backend via Next.js rewrites → same origin). Backend CORS allows only `APP_ORIGIN` anyway.
- Secrets only in env files ignored by git; ship `.env.example` with placeholders.

## 4. Backend

Python 3.14, FastAPI, Uvicorn, Beanie 1.30 (Motor; venv already at `fastapi-backend/.venv`, deps in requirements.txt — do not recreate it), pydantic-settings, argon2-cffi, PyJWT, numpy, pandas, scikit-learn. Tests: pytest + pytest-asyncio + httpx `AsyncClient`, against **mongomock-motor** or a real Mongo at `MONGODB_URI_TEST` if reachable (local mongod may not be running — tests must pass with the mock).

Env (`fastapi-backend/.env.example`): `APP_ENV=development`, `MONGODB_URI`, `MONGODB_DB` (optional, derived; see Dev/prod database separation in `fastapi-backend/README.md`), `JWT_SECRET`, `APP_ORIGIN=http://localhost:3000`, `COOKIE_SECURE=false`, `ALLOW_REGISTRATION=false`. If `MONGODB_URI` starts with `mongomock://` use `mongomock_motor.AsyncMongoMockClient` (local dev/e2e only; refuse at startup when `COOKIE_SECURE=true`).

Package layout:
```
fastapi-backend/
  pyproject.toml  requirements.txt  .env.example  README.md
  app/
    main.py            create_app(), lifespan init_beanie, routers under /api/v1, error handlers, middleware
    config.py          Settings
    db.py              init_db(), document_models list
    security/          passwords.py, tokens.py, csrf.py, deps.py (get_current_user -> CurrentUser{user_id, household_id})
    models/            Beanie documents (one module per collection)
    schemas/           Pydantic request/response models
    routers/           auth.py, household.py, accounts.py, categories.py, transactions.py, budgets.py, debts.py, goals.py, insights.py, plan.py
    services/          db-facing glue (e.g. load transactions for analytics)
    analytics/         PURE functions, no DB, no I/O (see §6)
  tests/
```

### 4.1 Collections (Beanie documents)

All have `id` (ObjectId, serialized as string `id`), `household_id`, `created_at`, `updated_at`.

- `users`: `email` (unique, lowercased), `name`, `password_hash`, `household_id`, `role` (`owner|member`).
- `households`: `name`, `base_currency="AED"`, `owner_id`.
- `invites`: `code_hash`, `created_by`, `expires_at`, `used_by?`, `used_at?`.
- `sessions`: `user_id`, `token_hash`, `expires_at`, `revoked_at?`, `replaced_by?`, `user_agent?`.
- `accounts`: `name`, `institution?` (e.g. "Mashreq Neo", "Emirates NBD"), `type` (`bank|savings|credit_card|cash|loan|investment`), `currency="AED"`, `opening_balance_fils` (int, may be negative for credit), `last4?`, `color?`, `archived=false`.
- `categories`: `name`, `kind` (`income|expense`), `group` (`essentials|lifestyle|debt|savings|income|other`), `icon?` (lucide name), `color?`, `archived=false`. Seed defaults on household creation (Salary, Other income; Rent, Utilities, Groceries, Transport, Fuel, Telecom, Insurance, Dining, Shopping, Entertainment, Health, Education, Travel, Gifts, Subscriptions, Fees, Debt payment, Other).
- `transactions`: `account_id`, `date` (date), `amount_fils` (int **> 0**), `type` (`income|expense|transfer`), `category_id?` (required unless transfer), `to_account_id?` (required for transfer), `merchant?`, `note?`, `created_by` (user id), `source` (`manual|import`), `deleted_at?`. Index: `(household_id, date desc)`, `(household_id, category_id)`.
- `budgets`: one per household per month: `month` ("YYYY-MM", unique with household), `lines: [{category_id, limit_fils}]`, `note?`.
- `debts`: `name`, `kind` (`credit_card|personal_loan|car_loan|mortgage|bnpl|other`), `balance_fils`, `apr_bps` (annual rate in basis points, 2999 = 29.99%), `min_payment_fils`, `due_day` (1–28), `account_id?`, `archived=false`.
- `goals` (savings goals): `name`, `target_fils`, `saved_fils`, `target_date?`, `priority` (1 = highest), `account_id?`, `archived=false`.
- `plans`: one per household: `strategy` (`avalanche|snowball`), `monthly_debt_budget_fils` (total money for debt each month, ≥ sum of minimums), `monthly_savings_fils`, `emergency_fund_months` (default 3).

Account balance = `opening_balance_fils` + income − expense ± transfers (transfer subtracts from `account_id`, adds to `to_account_id`), computed by the API (`balance_fils` in responses).

### 4.2 API (prefix `/api/v1`, JSON, camelCase on the wire)

Responses use **camelCase** (Pydantic `alias_generator=to_camel`, `populate_by_name=True`). IDs are strings. Lists return `{ "items": [...], "total": n }`.

Auth
- `POST /auth/register` `{name, email, password, householdName}` → 201 `{user}` + cookies (bootstrap only, see §3)
- `POST /auth/join` `{name, email, password, inviteCode}` → 201 `{user}` + cookies
- `POST /auth/login` `{email, password}` → 200 `{user}` + cookies
- `POST /auth/refresh` → 200 `{user}` + rotated cookies
- `POST /auth/logout` → 204, clears cookies, revokes session
- `GET /auth/me` → `{user: {id, name, email, role}, household: {id, name, baseCurrency, members: [{id, name, email, role}]}}`
- `GET /auth/status` → `{registrationOpen: bool}` (public; true when no users exist or ALLOW_REGISTRATION)

Household
- `PATCH /household` `{name}`
- `POST /household/invites` → `{code, expiresAt}` (plain code shown once)

Accounts: `GET /accounts` (each with `balanceFils`), `POST /accounts`, `PATCH /accounts/{id}`, `POST /accounts/{id}/archive`
Categories: `GET /categories`, `POST /categories`, `PATCH /categories/{id}`, `POST /categories/{id}/archive`
Transactions:
- `GET /transactions?from=&to=&accountId=&categoryId=&type=&q=&page=1&pageSize=50&sort=date|-date|amount|-amount` → `{items, total}`; `createdBy` included (member name as `createdByName`).
- `POST /transactions`, `PATCH /transactions/{id}`, `DELETE /transactions/{id}` (soft delete) → 204
Budgets:
- `GET /budgets/{month}` → `{month, lines: [{categoryId, categoryName, group, limitFils, spentFils, remainingFils}], totalLimitFils, totalSpentFils, incomeFils, unbudgetedSpentFils}` (404-free: returns empty lines if none)
- `PUT /budgets/{month}` `{lines: [{categoryId, limitFils}], note?}`
- `POST /budgets/{month}/copy-from/{fromMonth}`
Debts: `GET /debts`, `POST /debts`, `PATCH /debts/{id}`, `POST /debts/{id}/archive`, `POST /debts/{id}/payments` `{amountFils, date, accountId}` → `{debt, transaction}`; reduces `balance_fils` (floored at 0) and records the money movement:
- Debt linked to a **`credit_card` or `loan` account** (that account is the debt; card purchases are already expenses on it): a **transfer** from `accountId` to the linked account (no category), so spending is not double-counted. Paying from the linked account itself → 422 (`fields.accountId`).
- Debt **not linked, or linked to any other account type** (e.g. the bank account it is usually paid from): an **expense** in category "Debt payment".
- `accountId` must belong to the household (422 otherwise).
- Debt responses include `linkedAccountBalanceFils`: the linked account's current `balanceFils` (same computation as `GET /accounts`), `null` when unlinked — lets the UI show "card balance" next to the debt balance.
Goals: `GET /goals`, `POST /goals`, `PATCH /goals/{id}`, `POST /goals/{id}/archive`, `POST /goals/{id}/contributions` `{amountFils}` (adjusts `saved_fils`).
Plan:
- `GET /plan` → plan settings; `PUT /plan` settings
- `GET /plan/payoff?strategy=&monthlyBudgetFils=` → result of `simulate_payoff` (§6) for current debts; defaults from saved plan
- `GET /plan/compare?monthlyBudgetFils=` → `{avalanche: PayoffResult, snowball: PayoffResult}`
Insights:
- `GET /insights/summary?month=YYYY-MM` → `monthly_summary` for that month + previous month deltas
- `GET /insights/trends?months=12` → `monthly_series`
- `GET /insights/forecast` → `forecast_next_month`
- `GET /insights/anomalies?month=` → `detect_anomalies`
- `GET /insights/health` → `financial_health`
- `GET /dashboard` → `{summary, health, budget (current month), upcomingDebtPayments: [{debtId, name, dueDate, minPaymentFils}], recentTransactions (10), accounts}`

Health check: `GET /api/health` → `{ok: true}` (no auth).

## 5. Frontend

Next.js (latest stable, App Router, TypeScript strict, `src/` dir), Tailwind CSS v4, Radix UI primitives (Dialog, DropdownMenu, Popover, Tooltip, Toast, Tabs, Select-like via DropdownMenu), MUI (`@mui/material`, `@mui/x-data-grid`, `@mui/x-charts`, `@mui/x-date-pickers` with dayjs) using `@mui/material-nextjs` `AppRouterCacheProvider` with `enableCssLayer: true` so Tailwind utilities win. TanStack Query for data. React Hook Form + Zod for forms. lucide-react icons. Node 22 (`source ~/.nvm/nvm.sh && nvm use 22`).

- `next.config.ts`: rewrites `/api/:path*` → `${BACKEND_URL}/api/:path*` (env `BACKEND_URL=http://127.0.0.1:8000`), security headers (CSP, frame-ancestors none, nosniff, referrer policy).
- `src/middleware.ts`: if no `mbp_access` and no `mbp_refresh` cookie → redirect to `/login` for app routes; logged-in users hitting `/login` → `/`. (UX only; real auth is the backend.)
- API client `src/lib/api.ts`: `fetch` with `credentials: "include"`, attaches `X-CSRF-Token` from `mbp_csrf` cookie on non-GET; on 401 tries `POST /api/v1/auth/refresh` once then retries, else redirects to `/login`. Throws `ApiError {status, code, message, fields}`.
- Types `src/lib/types.ts` mirror §4.2 exactly (camelCase).
- Money helpers `src/lib/money.ts`: `formatFils(fils, currency="AED")`, `parseToFils("1,234.50") → 123450`.
- Routes (route group `(app)` with shared shell; `(auth)` for login/join/setup):
  - `/login`, `/join` (invite code), `/setup` (first-run register, only if `registrationOpen`)
  - `/` Dashboard
  - `/transactions` (filters, table on desktop via MUI DataGrid, card list on phones, add/edit in dialog)
  - `/accounts` (cards with balances, add/edit dialog, archive)
  - `/budget` (month switcher, per-category progress bars, edit limits, copy last month)
  - `/plan` (tabs: Debts | Savings goals | Payoff plan — strategy toggle, monthly budget input, debt-free date, timeline chart, avalanche vs snowball comparison)
  - `/insights` (income vs expense vs savings chart, category breakdown donut, trend lines, forecast, anomalies, health score)
  - `/settings` (profile, household name, members, create invite code, categories manager, logout)
- Shell: desktop left sidebar; under 768px an app-like layout: compact top bar + bottom tab bar (Home, Transactions, Budget, Plan, More). Floating "+" add-transaction button on phones. Forms open in dialogs (full-screen sheet on phones); details open in a right drawer. Toasts for action feedback. Async buttons disable + spinner. Light/dark via `prefers-color-scheme` with a toggle; design tokens in `@theme` in `globals.css`, MUI theme reads the same palette.
- Design: calm, modern finance look — neutral surfaces, one accent (emerald/teal), red only for overspend/debt, tabular numerals for money, generous spacing. No horizontal scroll at 360px width.

## 6. Analytics (pure functions — `fastapi-backend/app/analytics/`)

Input transactions are plain dicts/dataclasses: `{date: date, amount_fils: int, type: "income"|"expense"|"transfer", category_id: str|None, account_id: str}`. Transfers are ignored by all spending/income maths. Savings = income − expense for a period.

`summary.py`
- `monthly_summary(txns, month: str) -> dict`: `{month, incomeFils, expenseFils, netFils, savingsRate (float 0–1 or null), byCategory: [{categoryId, expenseFils, share}] sorted desc}`
- `monthly_series(txns, end_month: str, months: int) -> list[dict]`: one entry per month `{month, incomeFils, expenseFils, netFils}` (zero-filled).

`forecast.py`
- `forecast_next_month(txns, today: date, history_months=6) -> dict`: per expense category and total, forecast next month spending using exponentially weighted mean of the last N full months (alpha 0.5) blended with a linear trend (sklearn LinearRegression) when ≥4 months of data; clamp ≥0. Returns `{month, totalExpenseFils, totalIncomeFils, byCategory: [{categoryId, forecastFils, trend: "up"|"down"|"flat"}], confidence: "low"|"medium"|"high"}` (low < 3 months data, high ≥ 6). `trend` = direction of the category's `forecastFils` vs its spend in the most recent full month (`last`): `|forecast − last| < 5% of last` → `"flat"`, else `"up"`/`"down"`; if `last` is 0, `"up"` when forecast > 0 else `"flat"`. (Not the regression slope — a long-run decline can coexist with a forecast above last month.)

`anomalies.py`
- `detect_anomalies(txns, month: str, lookback_months=6) -> list[dict]`: categories whose month spend exceeds mean + 2·std of lookback (and ≥ 20% above mean and ≥ AED 100), plus single transactions > 3× the category median. Items: `{kind: "category_spike"|"large_transaction", categoryId, transactionId?, amountFils, baselineFils, message}`.

`debt.py`
- `simulate_payoff(debts: list[{id, name, balance_fils, apr_bps, min_payment_fils}], monthly_budget_fils: int, strategy: "avalanche"|"snowball", start_month: str, max_months=600) -> dict`
  - Monthly: interest = balance × apr/12 (round half-up to fils), added first; pay minimums on all (capped at balance); leftover budget goes to the target debt (avalanche: highest APR, tie → smallest balance; snowball: smallest balance, tie → highest APR); freed minimums roll over.
  - If budget < sum of minimums → `{feasible: false, reason: "budget_below_minimums", shortfallFils}`. If any debt never shrinks (payment ≤ interest) → `feasible:false, reason:"negative_amortization"`.
  - Returns `{feasible, strategy, months, debtFreeMonth, totalInterestFils, totalPaidFils, order: [debtId…], schedule: [{month, payments: [{debtId, paymentFils, interestFils, balanceFils}], totalBalanceFils}], perDebt: [{debtId, payoffMonth, interestFils}]}`.
- `compare_strategies(...)` → both + `interestSavedFils`, `monthsSaved` of avalanche vs snowball.

`health.py`
- `financial_health(monthly: list[summary], liquid_balance_fils, total_debt_fils, monthly_min_payments_fils) -> dict`: `{score 0–100, savingsRate, emergencyFundMonths, debtToIncome, tips: [str]}` with documented weights (savings rate 35, emergency fund 35, debt-to-income 30).

All analytics functions have unit tests with hand-checked numbers (e.g. debt simulation against a 2-debt worked example).

## 7. Non-goals (v1)

Bank connections (Mashreq Neo / Emirates NBD) — later; design leaves `source: "import"` and `institution` ready. FX conversion. Firebase data migration (separate script later). Mobile native app. Email sending.
