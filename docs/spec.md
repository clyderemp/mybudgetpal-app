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
- `accounts`: `name`, `institution?` (e.g. "Mashreq Neo", "Emirates NBD"), `type` (`bank|savings|credit_card|cash|loan|investment`), `currency="AED"`, `opening_balance_fils` (int, may be negative for credit), `last4?`, `color?`, `archived=false`, `purpose` (`household|business`, default household). A **business** account (e.g. Sessions DXB) holds money that isn't the household's: see "Business accounts" in §6.
- `categories`: `name`, `kind` (`income|expense`), `group` (`essentials|lifestyle|debt|savings|income|other`), `icon?` (lucide name), `color?`, `archived=false`. Seed defaults on household creation (Salary, Other income; Rent, Utilities, Groceries, Transport, Fuel, Telecom, Insurance, Dining, Shopping, Entertainment, Health, Education, Travel, Gifts, Subscriptions, Fees, Debt payment, Other).
- `transactions`: `account_id`, `date` (date), `amount_fils` (int **> 0**), `type` (`income|expense|transfer`), `category_id?` (required unless transfer), `to_account_id?` (required for transfer), `merchant?`, `note?`, `created_by` (user id), `source` (`manual|import`), `deleted_at?`, `items: [{name, amount_fils?, quantity?}]` (optional line items; `amount_fils` is the line total), `needs_review` (bool) + `review_reason?` (`no_name` = bank row without a payee name, `manual` = flagged by a person), `source_ref?`, `import_batch?`, `bill_id?`. Index: `(household_id, date desc)`, `(household_id, category_id)`, `(household_id, needs_review)`.
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
- `POST /auth/login` `{username, password}` (username or email; legacy `{email}` key accepted) → 200 `{user}` + cookies
- `PATCH /auth/me` `{name?, avatarStyle?, avatarSeed?}` → `{user}` (DiceBear style ids: see `AVATAR_STYLES`)
- `POST /auth/password` `{currentPassword, newPassword}` → `{user}`; revokes every other session and re-issues this one's cookies
- `POST /auth/refresh` → 200 `{user}` + rotated cookies
- `POST /auth/logout` → 204, clears cookies, revokes session
- `GET /auth/me` → `{user: {id, name, email, username, role, avatarStyle, avatarSeed}, household: {id, name, baseCurrency, members: [same shape]}}`
- `GET /auth/status` → `{registrationOpen: bool}` (public; true when no users exist or ALLOW_REGISTRATION)

Household
- `PATCH /household` `{name}`
- `POST /household/invites` → `{code, expiresAt}` (plain code shown once)

Accounts: `GET /accounts` (each with `balanceFils`), `POST /accounts`, `PATCH /accounts/{id}`, `POST /accounts/{id}/archive`
Categories: `GET /categories`, `POST /categories`, `PATCH /categories/{id}`, `POST /categories/{id}/archive`
Transactions:
- `GET /transactions?from=&to=&accountId=&categoryId=&type=&q=&needsReview=true|false&page=1&pageSize=50&sort=date|-date|amount|-amount` → `{items, total}`; `createdBy` included (member name as `createdByName`). `q` matches merchant, note and item names (case-insensitive).
- `GET /transactions/review-count` → `{count}`: non-deleted transactions with `needsReview` (nav badges).
- `POST /transactions`, `PATCH /transactions/{id}`, `DELETE /transactions/{id}` (soft delete) → 204. Both accept `items` (PATCH replaces the list; `[]` clears it). PATCH `needsReview: true` flags any row (reason `manual` unless it already has one); `needsReview: false` marks it reviewed (reason cleared). Changing the merchant to a new non-empty name clears a `no_name` flag; editing anything else keeps it.
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
Insights (every endpoint below takes `includeBusiness=true` to count business accounts as household money; default false, see §6 "Business accounts"):
- `GET /insights/summary?month=YYYY-MM` → `monthly_summary` for that month + previous month deltas
- `GET /insights/trends?months=12&end=YYYY-MM` → `monthly_series` (`end` defaults to the current month)
- `GET /insights/forecast` → `forecast_next_month`
- `GET /insights/anomalies?month=` → `detect_anomalies`
- `GET /insights/health` → `financial_health`
- `GET /insights/explore` → `analytics/explore.py` (Insights page). Query: `from`, `to` (default: last
  12 months from the 1st), `flow` (`expense`|`income`), `granularity` (`day`|`week`|`month`; default by
  range: ≤45 days daily, ≤200 weekly, else monthly), `groupBy` (`category`|`group`|`account`|`member`|
  `merchant`|`weekday`), filters `categories`/`accounts`/`members` (comma-separated ids; `none` =
  uncategorised) and `merchant` (case-insensitive substring), `horizon` (1–12 forecast periods). Range ≤ 5
  years. Returns totals and the same totals for the previous equal-length range, a zero-filled series
  (with the previous range aligned by position and a running net), the breakdown, the breakdown stacked
  per period (top 6 + Other), weekday averages, daily amounts, top merchants, largest items, the pace of
  the current period, and a forecast: per complete period before today's, leading/trailing empty periods
  dropped, point = ½·EWMA(α 0.5) + ½·max(0, linear trend), 80% band = ±1.2816·residual sd·√h (sd ≥ 10% of
  the mean); confidence low when stale (nothing in the latest complete period) or < 4 periods, medium 4–5,
  high ≥ 6. Transfers never count.
- `GET /dashboard` → `{summary, health, budget (current month), upcomingDebtPayments: [{debtId, name, dueDate, minPaymentFils}], recentTransactions (10), accounts}`

- `POST /receipts/read` `{text}` (OCR text, 1–8000 chars; the image never reaches the server) → `{merchant, amountFils, currency, date, categoryId, accountId (card last 4 matched to an account), cardLast4, vatFils, items: [{name, amountFils}], source: "ai"|"text", aiUnavailable}`. Long numbers are redacted to their last 4 digits before the text goes to OpenRouter (free models only, `OPENROUTER_MODEL`, tried in order with a per-model time limit); a local parser fills missing fields, and a date printed on the receipt beats the AI's. Without `OPENROUTER_API_KEY` only the local parser runs. Saves nothing. Rate limit `RATE_LIMIT_RECEIPTS_PER_MIN` (20) per IP.

Bills and expected income (zero-based budgeting, "give every dirham a job"; pure logic in `analytics/bills.py`):
- Collections: `bills` (`name`, `kind` `bill|subscription|loan|bnpl|debt_payment|savings|other`, `amount_fils`, `amount_mode` `fixed|estimate`, `cadence` `monthly|quarterly|yearly`, `due_day_from`/`due_day_to` (1–31, clamped to the month), `account_id?`, `category_id?`, `match_text[]`, `amount_tolerance_pct` (10), `start_month`, `end_month?`, `instalments_total?`/`instalments_paid`, `debt_id?`, `purpose` `household|business`, `active`, `notes?`, `skipped_months[]`, `ignored_transaction_ids[]`, `archived`) and `income_streams` (`name`, `member_id?`, `account_id?`, `parts: [{id, label, kind salary|cash_deposit|transfer|other, amount_fils, amount_min_fils?, amount_max_fils?, day_from, day_to, match_text[]}]`, `active`, `notes?`, `archived`). `transactions.bill_id` marks a transaction as paying a bill.
- Schedule: due in month M when `start_month` ≤ M ≤ last month and M is a whole number of cadence periods after `start_month`. Instalment plans end after `instalments_total − instalments_paid` instalments counted from `start_month` (auto-complete). Monthly share = amount / months in the cadence (yearly 1,200 → 100), used as a sinking fund.
- Matching, per month, one transaction to at most one bill or income part: (1) transactions with `bill_id` belong to that bill in the month whose payment window holds the date (window of M = 10 days before the due date in M up to the day before the next window, so an early payment counts for the month it pays); (2) otherwise rules: merchant or note contains a `match_text` (default the bill name), expense/transfer for bills, income or a transfer into the stream's account for income, date in the window (income: its day range ± 3 days), amount within tolerance ("high") or within 50% ("medium", shown as a price change for fixed bills / "check match"). Paid from another account than the bill's demotes high to medium. Greedy, best first. `estimate` bills expect the average of the last 3 payments in the previous 3 months (else `amount_fils`).
- Statuses: bills `paid|skipped|overdue|due_soon` (from 3 days before the due range) `|upcoming`; income `received|overdue` (after day_to + 3) `|due_soon|upcoming`.
- High-confidence rule matches for the current or past months are stored as `transactions.bill_id` (never overwriting a link) when the month or overview is read; unlinking adds the transaction to `ignored_transaction_ids` so rules never re-match it.
- Safe to spend = household (non-business) AED bank + cash balances − unpaid household bills due to start on or before the next expected salary (today when the salary is late; end of month without a salary stream) + other income expected before then, at its lowest amount.
- Zero-based plan for M: expected income (all active parts) − commitments (household monthly bills due in M, not skipped, every kind except savings) − sinking funds (household quarterly/yearly bills running in M, monthly share) − savings (monthly bills of kind savings) − flexible (the month's budget limits) = left to assign (goal 0). `overlapCategoryIds`: categories with both a limit and bills. Leftover is suggested toward the first unfinished savings goal by priority.
- `GET /bills?includeArchived=`, `POST /bills`, `GET|PATCH /bills/{id}` (cross-field rules re-checked on the merged result), `POST /bills/{id}/archive`, `POST /bills/{id}/skip` `{month, skipped=true}`, `POST /bills/{id}/links` `{transactionId}` → transaction, `DELETE /bills/{id}/links/{transactionId}` → 204. Responses add `monthlyFils`, `lastMonth`, `instalmentsRemaining`, `remainingFils`, `completed`.
- `GET /bills/month/{month}` → `{month, today, items: [{billId, name, kind, purpose, cadence, accountId, categoryId, amountMode, dueFrom, dueTo, expectedFils, paidFils, differenceFils, status, priceChanged, needsConfirmation, instalmentNumber, instalmentsTotal, matches: [{transactionId, date, amountFils, merchant, accountId, confidence linked|high|medium}]}], income: [{streamId, partId, streamName, memberId, label, kind, accountId, dueFrom, dueTo, expectedFils, minFils, maxFils, receivedFils, status, needsConfirmation, matches}], totals}`.
- `GET /bills/overview` (dashboard) → `{month, today, safeToSpend: {cashFils, billsDueFils, incomeExpectedFils, safeToSpendFils, until, nextSalary, bills, income, accounts}, waitingFor (this month's income not received), upcomingBills (unpaid household bills due within 14 days, overdue included), totals, hasBills, hasIncome}`.
- `GET /bills/suggestions` → `{items, total}`: same merchant (lowercase words, tokens with digits dropped, first 3) in ≥ 2 distinct months of the last 6, ≤ 1.5 a month, gaps 20–40 days, similar amount (clusters within 15%), last paid within 45 days, not already linked or matched by an active bill. Opt-in; nothing is created automatically.
- `GET /income-streams`, `POST /income-streams`, `PATCH /income-streams/{id}` (parts keep their ids when sent back), `POST /income-streams/{id}/archive`. Responses add `monthlyFils`.
- `GET|PUT /budgets/{month}` and copy add `plan` (the zero-based plan above); the dashboard's budget has `plan: null`.
- Dev only: `scripts/seed_bills_dev.py --user <username> [--apply|--remove]` adds the household's known bills and income to the development database.

Statement import (staged, reversible; `app/services/statements/`, `app/services/imports.py`):
- `POST /imports` multipart `file` (PDF or CSV, ≤ `IMPORT_MAX_BYTES` 4 MB; rate limit `RATE_LIMIT_IMPORTS_PER_MIN` 10/IP) → 201 draft `StatementImport`: bank + format detected (Emirates NBD account statements, Mashreq NEO consolidated / single-account statements, generic CSV), one **section** per account (bank, product, last4, period, opening/closing, reconciliation: opening + credits − debits = closing and the row-by-row running balance; mismatches reported, never fatal), and one proposal per row. Errors: `unsupported_file`, `file_too_large` (413), `unreadable_statement`. Saves no transactions.
- Sections map to accounts by bank + `last4`; unknown → `accountId: null` and the review screen asks (pick or create).
- Row proposal (`status`): `recorded` (same `sourceRef`, or same account/amount/direction within ±2 days, best merchant match first, one-to-one → skipped), `transfer` (between own accounts: printed own IBAN/account last4, Mashreq account-to-account, IPP to/from the holder's own name, credit-card payment to a household card, Tabby/Tamara → BNPL account, ATM/cash deposit ↔ cash account; both legs in one upload → one record, the credit leg linked and skipped; a leg recorded from an earlier upload → recorded), `new` (income/expense, category from merchant rules, else a built-in hint, else Other), `review` (`needsReview`, `reviewReason` `no_name` when the bank printed no merchant/payee — merchant becomes e.g. "Card purchase ..1155" / "Transfer to ..5404" — or `unknown_account` for an own-name transfer whose other account isn't in the app). `sourceRef` = bank:last4:date:direction+amount:bank ref (or text hash).
- `GET /imports` (summaries, newest first), `GET /imports/{id}`, `PATCH /imports/{id}` `{sections?: [{index, accountId}], rematch?}` (re-runs matching; edited rows kept), `PATCH /imports/{id}/rows` `{rows: [{id, action?, type?, categoryId?, merchant?, note?, counterAccountId?, needsReview?}]}`.
- `POST /imports/{id}/commit` → inserts `source="import"`, `source_ref`, `import_batch=<import id>`, review flags; never inserts a `sourceRef` that already exists (re-uploading a statement adds nothing; rows skipped in an earlier committed import stay skipped). `commitResult.accounts`: per section the app balance on the statement's end date vs the statement closing (`differenceFils = app − statement`, recomputed live on GET).
- `POST /imports/{id}/rollback` → committed: soft-deletes the batch's transactions; draft: discards it.
- Hardening: uploads are untrusted. Byte cap at the route. PDFs are parsed in a child process (`app/services/statements/sandbox.py`: `python -m` with the file on stdin, JSON rows on stdout) that lowers its own RLIMIT_AS (512 MB) and RLIMIT_CPU (20 s) and is killed by the parent after 20 s wall clock; a timeout, kill, crash or MemoryError → 422 `statement_too_complex`. Where RLIMIT_AS can't be set (macOS) the CPU limit and the kill still apply. Inside the child, cheap first gates: ≤ 80 pages; each page's content streams inflated by us with a 2 MB cap and failing closed (decode error, chained or non-Flate filter → refused); ≤ 20,000 layout objects per page and 300,000 in total; a 20 s budget checked between pages.
- Concurrency: commit claims the import atomically (`draft → committing`, else 409 `import_busy`), inserts unordered and treats a duplicate `(household_id, source_ref)` (unique partial index on string `source_ref`, named `household_source_ref_unique`; it coexists with the earlier non-unique index on the same keys) as already recorded; a failed commit removes its partial inserts and returns to `draft`. Review edits save only while the import is still `draft`. Rollback claims `committed → rolling_back` and moves each row's `source_ref` to `rolled_back_source_ref` so the statement can be imported again; a transaction deleted by hand keeps its `source_ref`, so re-uploads don't bring it back.
- Merchant rules: `GET/POST /merchant-rules`, `PATCH/DELETE /merchant-rules/{id}` (`{pattern, categoryId, merchant?}`; case-insensitive whole-word match on the cleaned merchant + bank text; user rules beat defaults). Defaults are seeded per household on first use (DEWA→Utilities, Etisalat/e&→Telecom, Union Coop/Carrefour/Lulu→Groceries, ENOC/ADNOC/Emarat/EPPCO→Fuel, Spotify/OpenAI/ChatGPT/Netflix/Amazon Prime→Subscriptions, Salik/RTA→Transport, Zero Max→Car payment, TT remittances abroad→Debt payment, salary credits→Salary), creating a missing category by name.

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
- Receipt scanning (new-transaction dialog, "Scan receipt"): Tesseract (tesseract.js, self-hosted in `public/ocr/<version>/` by `scripts/copy-ocr-assets.mjs` on install/dev/build) reads the photo in a Web Worker on the device after canvas preprocessing (EXIF rotation, rescale, grayscale, contrast); the text goes to `POST /receipts/read` and the reply prefills an expense for review. Scanned items fill the items list (prices only when the receipt is in the account's currency); the note keeps VAT and a foreign-currency total.
  - Line items: items editor (name, optional amount, optional qty; sum vs the transaction amount, warning when items exceed it) in the transaction dialog and the detail drawer; "n items" hint in lists.
  - Needs review: amber "Needs review" badge on grid rows, phone cards, dashboard recent list and the drawer; count badge on the Transactions nav item (sidebar and phone tab bar); "Needs review (n)" chip (URL `review=1`, all dates). The drawer's review box edits merchant/category in place, "Mark reviewed & next" / "Skip" walk the flagged rows; "Flag for review" on any row.
  - `/accounts` (cards with balances, add/edit dialog, archive). Account form toggle "Business account — kept out of household totals"; business accounts are grouped separately with their own subtotal and left out of net worth (also on the dashboard accounts panel). Account pickers/filters (transactions, transaction form, Insights) show them under a "Business" heading; Insights has an "Include business accounts" toggle (URL `biz=1`, default off).
  - `/budget` (zero-based plan summary on top, month switcher, per-category progress bars, edit limits, copy last month)
  - `/bills` (tabs: This month checklist with status and expected vs actual, All recurring, Subscriptions with monthly and yearly totals, Income; suggestions; add/edit in dialogs). Dashboard adds Safe to spend, Waiting for and Upcoming bills.
  - `/plan` (tabs: Debts | Savings goals | Payoff plan — strategy toggle, monthly budget input, debt-free date, timeline chart, avalanche vs snowball comparison)
  - `/insights` (income vs expense vs savings chart, category breakdown donut, trend lines, forecast, anomalies, health score)
  - `/settings` (profile, household name, members, create invite code, categories manager, logout)
- Shell: desktop left sidebar; under 768px an app-like layout: compact top bar + bottom tab bar (Home, Transactions, Budget, Plan, More). Floating "+" add-transaction button on phones. Forms open in dialogs (full-screen sheet on phones); details open in a right drawer. Toasts for action feedback. Async buttons disable + spinner. Light/dark via `prefers-color-scheme` with a toggle; design tokens in `@theme` in `globals.css`, MUI theme reads the same palette.
- Design: calm, modern finance look — neutral surfaces, one accent (emerald/teal), red only for overspend/debt, tabular numerals for money, generous spacing. No horizontal scroll at 360px width.

## 6. Analytics (pure functions — `fastapi-backend/app/analytics/`)

Input transactions are plain dicts/dataclasses: `{date: date, amount_fils: int, type: "income"|"expense"|"transfer", category_id: str|None, account_id: str}`. Transfers are ignored by all spending/income maths. Savings = income − expense for a period.

**Business accounts.** `services/analytics_data.py::apply_business_boundary` is the single place business money is kept out; `load_analytics_txns` applies it, so dashboard, budgets, insights (summary, trends, forecast, anomalies, health, explore) and plan/health all see the household view:
- income/expense on a business account → dropped;
- transfer business → household → household **income** on the household account, `category_id = "business:<business account id>"`, merchant "From <business account>";
- transfer household → business → household **expense** on the household account, same synthetic category, merchant "To <business account>";
- business ↔ business → dropped; household ↔ household → neutral transfer as before.
Converted rows carry `business_account_id`, and the explore account filter also matches it (filtering on the business account shows the household's flows with it). Archived business accounts still count as business. Health's liquid balance leaves out business accounts, and debts linked to a business account are left out of health, `/plan/payoff|compare` defaults and dashboard upcoming payments (`GET /debts` still lists them). With `includeBusiness=true` the loader skips the rule (everything counts as recorded, every transfer neutral). Explore labels the synthetic category "From/To <account>" (group "Business"). Account balances and `GET /accounts` are unchanged; the UI groups business accounts and leaves them out of household totals.

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
