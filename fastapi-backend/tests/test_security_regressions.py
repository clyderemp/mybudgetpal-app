"""Regression tests for review findings (rate limiting, sessions, invites, input bounds)."""
from __future__ import annotations

from datetime import timedelta

import pytest
from starlette.requests import Request

from app.models import Invite, Session, User, utcnow
from app.ratelimit import LoginFailureTracker, client_key
from app.security.tokens import create_access_token
from tests.conftest import PASSWORD, make_account, register


async def _login(c, email="clyde@example.com", password=PASSWORD, **headers):
    return await c.post("/api/v1/auth/login", json={"email": email, "password": password}, headers=headers)


# --- rate limiting / brute force -------------------------------------------------------


@pytest.mark.parametrize("settings_overrides", [{"rate_limit_auth_per_min": 3}])
async def test_spoofed_xff_does_not_bypass_auth_limit(client):
    codes = []
    for i in range(5):
        r = await _login(client, "nobody@example.com", "wrong-password-x", **{"X-Forwarded-For": f"9.9.9.{i}"})
        codes.append(r.status_code)
    assert codes[:3] == [401, 401, 401]
    assert codes[3:] == [429, 429]


def _req(headers: dict[str, str], peer: str = "127.0.0.1") -> Request:
    return Request(
        {
            "type": "http",
            "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
            "client": (peer, 1234),
        }
    )


def test_client_key_ignores_xff_unless_configured():
    req = _req({"X-Forwarded-For": "9.9.9.9", "X-Real-IP": "1.2.3.4, 5.6.7.8"})
    assert client_key(req) == "127.0.0.1"
    # Configured trusted-edge header: right-most value (appended by the nearest proxy).
    assert client_key(req, "X-Real-IP") == "5.6.7.8"
    assert client_key(_req({}), "X-Real-IP") == "127.0.0.1"


def test_python_m_app_disables_proxy_headers():
    import pathlib

    src = (pathlib.Path(__file__).parents[1] / "app" / "__main__.py").read_text()
    assert "proxy_headers=False" in src


@pytest.mark.parametrize(
    "settings_overrides", [{"rate_limit_enabled": False, "login_max_failures": 3}]
)
async def test_per_account_login_lockout(owner, new_client):
    async with new_client() as attacker:
        for _ in range(3):
            assert (await _login(attacker, password="wrong-password-x")).status_code == 401
        r = await _login(attacker)  # even the right password is refused while locked
        assert r.status_code == 429 and r.json()["error"]["code"] == "too_many_attempts"
        # Other accounts are unaffected.
        assert (await _login(attacker, "other@example.com", "wrong-password-x")).status_code == 401


def test_login_failure_tracker_window_and_reset():
    t = LoginFailureTracker(max_failures=2, window_seconds=900)
    t.record_failure("A@x.com", now=0)
    t.record_failure("a@x.com", now=1)
    assert t.is_locked("a@x.com", now=2)
    assert not t.is_locked("a@x.com", now=902)  # window slid past both failures
    t.record_failure("a@x.com", now=1000)
    t.reset("a@x.com")
    assert not t.is_locked("a@x.com", now=1001)


@pytest.mark.parametrize(
    "settings_overrides", [{"rate_limit_enabled": False, "login_max_failures": 3}]
)
async def test_successful_login_resets_failures(owner, new_client):
    async with new_client() as c:
        for _ in range(2):
            await _login(c, password="wrong-password-x")
        assert (await _login(c)).status_code == 200
        for _ in range(2):
            await _login(c, password="wrong-password-x")
        assert (await _login(c)).status_code == 200


# --- input bounds -----------------------------------------------------------------------


async def test_huge_money_values_are_422_not_500(owner):
    r = await owner.post(
        "/api/v1/accounts", json={"name": "X", "type": "bank", "openingBalanceFils": 10**30}
    )
    assert r.status_code == 422, r.text
    r = await owner.post(
        "/api/v1/accounts", json={"name": "X", "type": "bank", "openingBalanceFils": -(10**30)}
    )
    assert r.status_code == 422
    acct = await make_account(owner, opening=10**15)
    assert acct["openingBalanceFils"] == 10**15
    r = await owner.post(
        "/api/v1/goals", json={"name": "G", "targetFils": 10**20}
    )
    assert r.status_code == 422
    r = await owner.put(
        "/api/v1/plan",
        json={"strategy": "avalanche", "monthlyDebtBudgetFils": 10**20, "monthlySavingsFils": 0},
    )
    assert r.status_code == 422
    r = await owner.post(
        "/api/v1/debts",
        json={"name": "D", "kind": "other", "balanceFils": 10**20, "aprBps": 0, "minPaymentFils": 0, "dueDay": 1},
    )
    assert r.status_code == 422


async def test_huge_page_is_422(owner):
    r = await owner.get("/api/v1/transactions", params={"page": 10**18})
    assert r.status_code == 422
    assert (await owner.get("/api/v1/transactions", params={"page": 100_000})).status_code == 200


# --- refresh rotation grace window -----------------------------------------------------------


async def test_concurrent_refresh_same_browser_does_not_revoke(owner):
    old = owner.cookies.get("mbp_refresh")
    assert (await owner.post("/api/v1/auth/refresh")).status_code == 200  # tab A wins
    new_refresh, new_access = owner.cookies.get("mbp_refresh"), owner.cookies.get("mbp_access")
    # Tab B raced with the same (now rotated) cookie.
    owner.cookies.set("mbp_refresh", old)
    r = await owner.post("/api/v1/auth/refresh")
    assert r.status_code == 401 and r.json()["error"]["code"] == "refresh_race"
    assert "set-cookie" not in r.headers  # must not wipe the winner's fresh cookies
    live = [s for s in await Session.find_all().to_list() if s.revoked_at is None]
    assert len(live) == 1
    # The winner's session keeps working.
    owner.cookies.set("mbp_refresh", new_refresh)
    owner.cookies.set("mbp_access", new_access)
    assert (await owner.get("/api/v1/auth/me")).status_code == 200


@pytest.mark.parametrize("settings_overrides", [{"refresh_reuse_grace_seconds": 0}])
async def test_reuse_outside_grace_still_revokes(owner):
    old = owner.cookies.get("mbp_refresh")
    assert (await owner.post("/api/v1/auth/refresh")).status_code == 200
    s = await Session.find_one({"replaced_by": {"$ne": None}})
    s.revoked_at = utcnow() - timedelta(seconds=5)
    await s.save()
    owner.cookies.set("mbp_refresh", old)
    r = await owner.post("/api/v1/auth/refresh")
    assert r.status_code == 401 and r.json()["error"]["code"] == "refresh_reused"
    assert all(s.revoked_at is not None for s in await Session.find_all().to_list())


# --- access tokens bound to sessions ---------------------------------------------------------


async def test_access_token_dies_with_revoke_all(owner):
    stolen_refresh = owner.cookies.get("mbp_refresh")
    assert (await owner.post("/api/v1/auth/refresh")).status_code == 200
    access = owner.cookies.get("mbp_access")
    csrf = owner.cookies.get("mbp_csrf")
    owner.cookies.set("mbp_refresh", stolen_refresh)
    r = await owner.post("/api/v1/auth/refresh", headers={"X-CSRF-Token": csrf, "User-Agent": "attacker"})
    assert r.json()["error"]["code"] == "refresh_reused"
    owner.cookies.set("mbp_access", access)
    assert (await owner.get("/api/v1/auth/me")).status_code == 401


async def test_access_token_dies_with_logout(owner, new_client):
    access = owner.cookies.get("mbp_access")
    assert (await owner.post("/api/v1/auth/logout")).status_code == 204
    async with new_client() as thief:
        thief.cookies.set("mbp_access", access)
        assert (await thief.get("/api/v1/auth/me")).status_code == 401


async def test_access_token_without_sid_rejected(owner, app):
    user = await User.find_one({})
    import jwt

    token = jwt.encode(
        {"sub": str(user.id), "hid": str(user.household_id), "iat": 0, "exp": 2**31, "jti": "x"},
        app.state.settings.jwt_secret,
        algorithm="HS256",
    )
    owner.cookies.set("mbp_access", token)
    assert (await owner.get("/api/v1/auth/me")).status_code == 401
    # A token pointing at a revoked session is rejected too.
    s = await Session.find_one({})
    s.revoked_at = utcnow()
    await s.save()
    owner.cookies.set(
        "mbp_access",
        create_access_token(str(user.id), str(user.household_id), app.state.settings.jwt_secret, 15, str(s.id)),
    )
    assert (await owner.get("/api/v1/auth/me")).status_code == 401


# --- invites -----------------------------------------------------------------------------


async def _join(c, code, email="wife@example.com"):
    return await c.post(
        "/api/v1/auth/join",
        json={"name": "Wife", "email": email, "password": PASSWORD, "inviteCode": code},
    )


async def test_member_cannot_mint_or_list_invites(owner, new_client):
    code = (await owner.post("/api/v1/household/invites")).json()["code"]
    async with new_client() as member:
        assert (await _join(member, code)).status_code == 201
        r = await member.post("/api/v1/household/invites")
        assert r.status_code == 403 and r.json()["error"]["code"] == "owner_only"
        assert (await member.get("/api/v1/household/invites")).status_code == 403


async def test_owner_lists_and_revokes_invites(owner, new_client):
    code = (await owner.post("/api/v1/household/invites")).json()["code"]
    items = (await owner.get("/api/v1/household/invites")).json()
    assert len(items) == 1 and set(items[0]) == {"id", "createdBy", "createdAt", "expiresAt"}
    assert (await owner.delete(f"/api/v1/household/invites/{items[0]['id']}")).status_code == 204
    assert (await owner.get("/api/v1/household/invites")).json() == []
    assert (await owner.delete(f"/api/v1/household/invites/{items[0]['id']}")).status_code == 404
    async with new_client() as c:
        assert (await _join(c, code)).status_code == 400


async def test_invite_revoke_is_household_scoped(owner, new_client, app):
    await owner.post("/api/v1/household/invites")
    inv = await Invite.find_one({})
    app.state.settings.allow_registration = True
    async with new_client() as other:
        await register(other, email="other@example.com", household="Other")
        assert (await other.delete(f"/api/v1/household/invites/{inv.id}")).status_code == 404
    assert await Invite.get(inv.id) is not None


async def test_failed_join_insert_does_not_burn_invite(owner, new_client, monkeypatch):
    from app.routers import auth as auth_router

    code = (await owner.post("/api/v1/household/invites")).json()["code"]

    async def _skip(_email: str) -> None:  # simulate the duplicate-email race
        return None

    monkeypatch.setattr(auth_router, "_ensure_email_free", _skip)
    async with new_client() as c:
        r = await _join(c, code, email="clyde@example.com")  # already taken -> unique index
        assert r.status_code == 409
    inv = await Invite.find_one({})
    assert inv.used_by is None
    monkeypatch.undo()
    async with new_client() as c:
        assert (await _join(c, code)).status_code == 201
