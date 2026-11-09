# MyBudgetPal API (FastAPI + Beanie)

Contract: `../docs/spec.md`.

## Run

```bash
cd fastapi-backend
cp .env.example .env            # then set MONGODB_URI and JWT_SECRET (>= 32 bytes)
.venv/bin/python -m uvicorn app.main:app --reload --port 8000 --no-proxy-headers
# production-style (proxy headers off, 127.0.0.1:8000; HOST/PORT env override):
.venv/bin/python -m app
```

Always run uvicorn with `--no-proxy-headers` (or `python -m app`). Uvicorn trusts
`X-Forwarded-For` from 127.0.0.1 by default, and the Next.js `/api` rewrite forwards a
client-supplied XFF untouched, so trusting it lets anyone dodge the per-IP rate limits.

- Health: `GET http://127.0.0.1:8000/api/health` -> `{"ok": true}`
- API docs (dev only, hidden when `COOKIE_SECURE=true`): `http://127.0.0.1:8000/api/docs`
- No local Mongo? Set `MONGODB_URI=mongomock://local` (in-memory, data lost on restart).
- First run: `GET /api/v1/auth/status` returns `registrationOpen: true` until the first user registers
  via `POST /api/v1/auth/register`. Further members join with an invite code (`POST /api/v1/household/invites`).

## Dev / prod database separation

One Atlas cluster (`mybudgetpal.nilbypg`) and one `MONGODB_URI` serve two databases,
`development` and `production`. Atlas does not separate them; `app/config.py` does
(`database_for` + `check_environment`, covered by `tests/test_environment.py`).

| Where it runs | `APP_ENV` | Host marker | Database |
|---|---|---|---|
| Laptop (`python -m app`, `.env`) | development | none | `development` |
| Laptop with `APP_ENV=production` in the shell | production | none | **refused** |
| Vercel Preview | any | `VERCEL_ENV=preview` | `development` |
| Vercel Production | production | `VERCEL=1` + `VERCEL_ENV=production` | `production` |
| Other server | production | `MYBUDGETPAL_PRODUCTION_HOST=true` | `production` |

Guards (startup refuses rather than guessing):
- `MONGODB_DB`, if set, must equal the routed database; it never switches silently.
- `APP_ENV=production` needs a host marker; `VERCEL_ENV=production` needs `VERCEL=1`; a production
  marker with `APP_ENV=development` is refused ("refusing to mix environments").
- Production must not read routing keys (`APP_ENV`, `VERCEL*`, the host marker, `MONGODB_URI`,
  `MONGODB_DB`) from the repo `.env`, so a laptop with the dev `.env` can't reach production.
- Production also requires `COOKIE_SECURE=true`, an `https://` `APP_ORIGIN`, real Mongo (no
  mongomock) and `ALLOW_REGISTRATION=false`.
- `scripts/seed_demo.py` only writes to `development` (or mongomock).

Never set `MONGODB_DB=production`, `APP_ENV=production` or a host marker locally. Residual risk:
the shared URI can still write to `production` outside this app (Compass, a script, a leak);
treat it as a production secret, or give production its own Atlas user later.

## Test

```bash
.venv/bin/python -m pytest -q
```

Tests run against mongomock (no Mongo needed).

## Layout

- `app/main.py` - `create_app()`, lifespan (`init_beanie`), middleware (security headers, CORS, rate limit, CSRF/Origin), error handlers
- `app/config.py` - settings (env / `.env`)
- `app/db.py` - client + `document_models`
- `app/security/` - argon2 passwords, JWT + refresh tokens, CSRF middleware, `get_current_user`
- `app/models/` - Beanie documents; `app/schemas/` - camelCase request/response models
- `app/routers/` - auth, household, accounts, categories, transactions, budgets, debts, goals
  (insights, plan, dashboard are auto-included when their modules exist)
- `app/services/` - DB glue (`load_analytics_txns`, balances, sessions, category seeding)
- `app/analytics/` - pure functions (no I/O)

## Security notes

- Cookies `mbp_access` (JWT, 15 min), `mbp_refresh` (opaque, 30 days, rotated, stored sha256-hashed;
  reuse of a rotated token revokes all of the user's sessions), `mbp_csrf` (readable, double-submit).
- Every unsafe `/api/*` request needs `X-CSRF-Token` == `mbp_csrf` cookie (except login/register/join),
  and `Origin`, if sent, must equal `APP_ORIGIN`.
- Rate limits (in-memory, per IP): auth 10/min, everything else 300/min. Behind the Next proxy all
  traffic shares one peer IP unless a trusted edge sets `RATE_LIMIT_CLIENT_IP_HEADER`.
- Per-account login lockout: 10 failed logins per email per 15 min -> 429 `too_many_attempts`
  (trade-off: someone who knows the email can lock that account for up to 15 min).
- Access JWT carries `sid` (session id); `get_current_user` rejects it once the session is revoked
  (logout, rotation, reuse detection).
- Refresh reuse within 30 s from the same user agent (two-tab race) -> 401 `refresh_race`, no
  revocation, cookies untouched; the client retries. Other reuse revokes every session.
- Invites: owner only (`POST/GET /household/invites`, `DELETE /household/invites/{id}`).
- Errors: `{"error": {"code", "message", "fields"?}}`.
