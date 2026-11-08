# MyBudgetPal API (FastAPI + Beanie)

Contract: `../docs/spec.md`.

## Run

```bash
cd fastapi-backend
cp .env.example .env            # then set JWT_SECRET (>= 32 bytes)
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
