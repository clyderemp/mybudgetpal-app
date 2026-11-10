"""Guards against N+1 / sequential DB access (each Atlas round trip is ~0.3–0.9s).

A "round" is a burst of DB operations that are in flight together: a request that awaits
its queries one by one costs one round per query; one that gathers them costs one round.
"""

from __future__ import annotations

import asyncio
import datetime as dt
from collections.abc import Iterator

import mongomock_motor
import pytest

from app.models import Session, utcnow
from app.services.insights import get_today
from tests.conftest import first_category, make_account

TODAY = dt.date(2026, 11, 8)


class RoundCounter:
    def __init__(self) -> None:
        self.ops = 0
        self.rounds = 0
        self._inflight = 0

    def reset(self) -> None:
        self.ops = self.rounds = 0

    def wrap(self, fn):  # type: ignore[no-untyped-def]
        async def wrapper(*args, **kwargs):  # type: ignore[no-untyped-def]
            self.ops += 1
            if self._inflight == 0:
                self.rounds += 1
            self._inflight += 1
            try:
                await asyncio.sleep(0.005)  # simulated network latency
                return await fn(*args, **kwargs)
            finally:
                self._inflight -= 1

        return wrapper


@pytest.fixture
def db_rounds(monkeypatch) -> Iterator[RoundCounter]:  # type: ignore[no-untyped-def]
    counter = RoundCounter()
    targets = [
        (mongomock_motor.AsyncCursor, "to_list"),
        (mongomock_motor.AsyncLatentCommandCursor, "to_list"),
        (mongomock_motor.AsyncMongoMockCollection, "find_one"),
        (mongomock_motor.AsyncMongoMockCollection, "count_documents"),
    ]
    for cls, name in targets:
        monkeypatch.setattr(cls, name, counter.wrap(getattr(cls, name)))
    yield counter


@pytest.fixture
async def seeded(app, owner):  # type: ignore[no-untyped-def]
    app.dependency_overrides[get_today] = lambda: TODAY
    c = owner
    acc = (await make_account(c, "Bank", 100_000))["id"]
    acc2 = (await make_account(c, "Cash", 0, type="cash"))["id"]
    groceries = (await first_category(c, "Groceries"))["id"]
    for date in ("2026-09-03", "2026-10-03", "2026-11-03"):
        r = await c.post(
            "/api/v1/transactions",
            json={"accountId": acc, "date": date, "amountFils": 5_000, "type": "expense", "categoryId": groceries},
        )
        assert r.status_code == 201
    r = await c.post(
        "/api/v1/transactions",
        json={"accountId": acc, "toAccountId": acc2, "date": "2026-11-04", "amountFils": 1_000, "type": "transfer"},
    )
    assert r.status_code == 201
    r = await c.put("/api/v1/budgets/2026-11", json={"lines": [{"categoryId": groceries, "limitFils": 50_000}]})
    assert r.status_code == 200
    r = await c.post(
        "/api/v1/debts",
        json={"name": "Visa", "kind": "credit_card", "balanceFils": 300_000, "aprBps": 2999,
              "minPaymentFils": 15_000, "dueDay": 15},
    )
    assert r.status_code == 201
    assert (await c.get("/api/v1/auth/me")).status_code == 200  # warm the auth cache
    yield c
    app.dependency_overrides.pop(get_today, None)


@pytest.mark.parametrize(
    "path, max_rounds",
    [
        ("/api/v1/dashboard", 1),
        ("/api/v1/accounts", 1),
        ("/api/v1/transactions?pageSize=50", 1),
        ("/api/v1/budgets/2026-11", 1),
        ("/api/v1/insights/summary", 1),
        ("/api/v1/insights/trends", 1),
        ("/api/v1/insights/health", 1),
        ("/api/v1/plan/payoff", 1),
        ("/api/v1/plan", 1),
        ("/api/v1/auth/me", 1),
        ("/api/v1/bills", 1),
        ("/api/v1/bills/month/2026-11", 1),
        ("/api/v1/bills/overview", 1),
        ("/api/v1/income-streams", 1),
    ],
)
async def test_reads_use_one_db_round(seeded, db_rounds, path, max_rounds):  # type: ignore[no-untyped-def]
    db_rounds.reset()
    r = await seeded.get(path)
    assert r.status_code == 200, r.text
    assert db_rounds.rounds <= max_rounds, (path, db_rounds.rounds, db_rounds.ops)


async def test_dashboard_db_ops_bounded(seeded, db_rounds):  # type: ignore[no-untyped-def]
    db_rounds.reset()
    r = await seeded.get("/api/v1/dashboard")
    assert r.status_code == 200
    assert db_rounds.ops <= 9, db_rounds.ops  # 8 + the business-accounts lookup
    body = r.json()
    balances = {a["name"]: a["balanceFils"] for a in body["accounts"]}
    assert balances == {"Bank": 100_000 - 15_000 - 1_000, "Cash": 1_000}
    assert body["budget"]["lines"][0]["spentFils"] == 5_000
    assert body["budget"]["lines"][0]["categoryName"] == "Groceries"


async def test_auth_uncached_is_one_round(app, seeded, db_rounds):  # type: ignore[no-untyped-def]
    app.state.auth_cache.clear()
    db_rounds.reset()
    assert (await seeded.get("/api/v1/categories")).status_code == 200
    assert db_rounds.rounds == 2  # auth (session + user together) + the categories query


# --- auth cache must never outlive an in-process revocation ----------------------------------


async def test_cached_access_token_dies_with_logout(owner, new_client):  # type: ignore[no-untyped-def]
    access = owner.cookies.get("mbp_access")
    assert (await owner.get("/api/v1/auth/me")).status_code == 200  # now cached
    assert (await owner.post("/api/v1/auth/logout")).status_code == 204
    async with new_client() as thief:
        thief.cookies.set("mbp_access", access)
        assert (await thief.get("/api/v1/auth/me")).status_code == 401


async def test_cached_access_token_dies_with_refresh_rotation(owner, new_client):  # type: ignore[no-untyped-def]
    access = owner.cookies.get("mbp_access")
    assert (await owner.get("/api/v1/auth/me")).status_code == 200  # now cached
    assert (await owner.post("/api/v1/auth/refresh")).status_code == 200
    async with new_client() as thief:
        thief.cookies.set("mbp_access", access)
        assert (await thief.get("/api/v1/auth/me")).status_code == 401


async def test_cached_access_token_dies_with_revoke_all(owner):  # type: ignore[no-untyped-def]
    stolen_refresh = owner.cookies.get("mbp_refresh")
    assert (await owner.post("/api/v1/auth/refresh")).status_code == 200
    access = owner.cookies.get("mbp_access")
    assert (await owner.get("/api/v1/auth/me")).status_code == 200  # new session cached
    csrf = owner.cookies.get("mbp_csrf")
    owner.cookies.set("mbp_refresh", stolen_refresh)
    r = await owner.post("/api/v1/auth/refresh", headers={"X-CSRF-Token": csrf, "User-Agent": "attacker"})
    assert r.json()["error"]["code"] == "refresh_reused"
    owner.cookies.set("mbp_access", access)
    assert (await owner.get("/api/v1/auth/me")).status_code == 401


@pytest.mark.parametrize("settings_overrides", [{"auth_cache_ttl_seconds": 0}])
async def test_cache_disabled_sees_out_of_band_revocation(owner):  # type: ignore[no-untyped-def]
    assert (await owner.get("/api/v1/auth/me")).status_code == 200
    s = await Session.find_one({})
    s.revoked_at = utcnow()
    await s.save()  # e.g. revoked by another worker process
    assert (await owner.get("/api/v1/auth/me")).status_code == 401
