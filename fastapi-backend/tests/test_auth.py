from __future__ import annotations

import pytest

from app.models import Session
from tests.conftest import PASSWORD, register


async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "referrer-policy" in r.headers


async def test_bootstrap_register_only_when_no_users(client, new_client):
    assert (await client.get("/api/v1/auth/status")).json() == {"registrationOpen": True}
    user = await register(client)
    assert user["role"] == "owner" and user["email"] == "clyde@example.com"
    for name in ("mbp_access", "mbp_refresh", "mbp_csrf"):
        assert client.cookies.get(name)
    async with new_client() as other:
        assert (await other.get("/api/v1/auth/status")).json() == {"registrationOpen": False}
        r = await other.post(
            "/api/v1/auth/register",
            json={"name": "X", "email": "x@example.com", "password": PASSWORD, "householdName": "H"},
        )
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "registration_closed"


@pytest.mark.parametrize("settings_overrides", [{"allow_registration": True}])
async def test_allow_registration_env(client, new_client):
    await register(client)
    async with new_client() as other:
        await register(other, email="other@example.com", household="Other")


async def test_register_validation(client):
    r = await client.post(
        "/api/v1/auth/register",
        json={"name": "C", "email": "c@example.com", "password": "short", "householdName": "H", "x": 1},
    )
    assert r.status_code == 422
    body = r.json()["error"]
    assert body["code"] == "validation_error"
    assert "password" in body["fields"] and "x" in body["fields"]


async def test_me_and_seeded_categories(owner):
    me = (await owner.get("/api/v1/auth/me")).json()
    assert me["user"]["name"] == "Clyde"
    assert me["household"]["baseCurrency"] == "AED"
    assert [m["email"] for m in me["household"]["members"]] == ["clyde@example.com"]
    cats = (await owner.get("/api/v1/categories")).json()
    names = {c["name"] for c in cats["items"]}
    assert {"Salary", "Rent", "Groceries", "Debt payment", "Other"} <= names
    assert cats["total"] == 20


async def test_unauthenticated(client):
    r = await client.get("/api/v1/accounts")
    assert r.status_code == 401
    assert r.json() == {"error": {"code": "unauthorized", "message": "Not authenticated"}}


async def test_join_with_invite(owner, new_client):
    r = await owner.post("/api/v1/household/invites")
    assert r.status_code == 201
    code = r.json()["code"]
    assert len(code) >= 10 and r.json()["expiresAt"]
    async with new_client() as wife:
        r = await wife.post(
            "/api/v1/auth/join",
            json={"name": "Wife", "email": "Wife@Example.com", "password": PASSWORD, "inviteCode": code},
        )
        assert r.status_code == 201, r.text
        assert r.json()["user"] == {**r.json()["user"], "role": "member", "email": "wife@example.com"}
        me = (await wife.get("/api/v1/auth/me")).json()
        assert len(me["household"]["members"]) == 2
    # single use
    async with new_client() as third:
        r = await third.post(
            "/api/v1/auth/join",
            json={"name": "T", "email": "t@example.com", "password": PASSWORD, "inviteCode": code},
        )
        assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_invite"


async def test_login(owner, new_client):
    async with new_client() as c:
        r = await c.post("/api/v1/auth/login", json={"email": "CLYDE@example.com", "password": PASSWORD})
        assert r.status_code == 200 and r.json()["user"]["name"] == "Clyde"
        assert (await c.get("/api/v1/auth/me")).status_code == 200
    async with new_client() as c:
        bad1 = await c.post("/api/v1/auth/login", json={"email": "clyde@example.com", "password": "wrong-password"})
        bad2 = await c.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "wrong-password"})
        assert bad1.status_code == bad2.status_code == 401
        assert bad1.json() == bad2.json()
        assert bad1.json()["error"]["message"] == "Invalid email or password"


async def test_refresh_rotation(owner):
    old_refresh = owner.cookies.get("mbp_refresh")
    old_access = owner.cookies.get("mbp_access")
    r = await owner.post("/api/v1/auth/refresh")
    assert r.status_code == 200, r.text
    assert owner.cookies.get("mbp_refresh") != old_refresh
    assert owner.cookies.get("mbp_access") != old_access
    sessions = await Session.find_all().to_list()
    assert len(sessions) == 2
    old = next(s for s in sessions if s.revoked_at is not None)
    assert old.replaced_by is not None
    # refresh tokens are stored hashed
    assert all(s.token_hash != owner.cookies.get("mbp_refresh") for s in sessions)
    assert (await owner.get("/api/v1/auth/me")).status_code == 200


async def test_refresh_reuse_revokes_all(owner):
    stolen = owner.cookies.get("mbp_refresh")
    assert (await owner.post("/api/v1/auth/refresh")).status_code == 200
    current = owner.cookies.get("mbp_refresh")
    csrf = owner.cookies.get("mbp_csrf")
    # attacker replays the old token (different browser -> outside the two-tab grace window)
    owner.cookies.set("mbp_refresh", stolen)
    r = await owner.post("/api/v1/auth/refresh", headers={"X-CSRF-Token": csrf, "User-Agent": "attacker"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "refresh_reused"
    assert all(s.revoked_at is not None for s in await Session.find_all().to_list())
    # legitimate (latest) token is now dead too
    owner.cookies.set("mbp_refresh", current)
    owner.cookies.set("mbp_csrf", csrf)
    r = await owner.post("/api/v1/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 401


async def test_logout(owner):
    csrf = owner.cookies.get("mbp_csrf")
    refresh = owner.cookies.get("mbp_refresh")
    r = await owner.post("/api/v1/auth/logout")
    assert r.status_code == 204
    assert owner.cookies.get("mbp_access") is None
    assert (await owner.get("/api/v1/auth/me")).status_code == 401
    owner.cookies.set("mbp_refresh", refresh)
    owner.cookies.set("mbp_csrf", csrf)
    assert (await owner.post("/api/v1/auth/refresh")).status_code == 401


@pytest.mark.parametrize("settings_overrides", [{"rate_limit_auth_per_min": 3}])
async def test_login_rate_limited(client):
    codes = [
        (await client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "x"})).status_code
        for _ in range(4)
    ]
    assert codes[:3] == [401, 401, 401] and codes[3] == 429
