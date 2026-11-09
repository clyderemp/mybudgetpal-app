"""Username sign-in, password change and avatar/profile updates."""

from __future__ import annotations

import pytest

from tests.conftest import PASSWORD


@pytest.mark.parametrize("settings_overrides", [{"allow_registration": True}])
async def test_username_login_and_profile(new_client):
    async with new_client() as c:
        r = await c.post("/api/v1/auth/register", json={
            "name": "Clyde", "email": "c@example.com", "username": "Clyde", "password": PASSWORD,
            "householdName": "Home"})
        assert r.status_code == 201, r.text
        user = r.json()["user"]
        assert user["username"] == "clyde"
        assert user["avatarStyle"] == "notionists" and user["avatarSeed"] == "clyde"

        # duplicate username is refused
        r = await c.post("/api/v1/auth/register", json={
            "name": "X", "email": "x@example.com", "username": "clyde", "password": PASSWORD,
            "householdName": "H2"})
        assert r.status_code == 409 and "username" in r.json()["error"]["fields"]

    async with new_client() as c:
        assert (await c.post("/api/v1/auth/login", json={"username": "CLYDE", "password": PASSWORD})).status_code == 200
        assert (await c.post("/api/v1/auth/login", json={"username": "c@example.com", "password": PASSWORD})).status_code == 200
        assert (await c.post("/api/v1/auth/login", json={"email": "c@example.com", "password": PASSWORD})).status_code == 200
        assert (await c.post("/api/v1/auth/login", json={"username": "clyde", "password": "nope"})).status_code == 401
        assert (await c.post("/api/v1/auth/login", json={"password": PASSWORD})).status_code == 422

        r = await c.patch("/api/v1/auth/me", json={"avatarStyle": "bottts", "avatarSeed": "robo", "name": "Clyde R"})
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert (u["avatarStyle"], u["avatarSeed"], u["name"]) == ("bottts", "robo", "Clyde R")
        assert (await c.patch("/api/v1/auth/me", json={"avatarStyle": "not-a-style"})).status_code == 422
        me = (await c.get("/api/v1/auth/me")).json()
        assert me["household"]["members"][0]["avatarStyle"] == "bottts"


async def test_change_password_signs_out_other_devices(new_client, owner):
    other = new_client()
    async with other:
        assert (await other.post("/api/v1/auth/login", json={"email": "clyde@example.com", "password": PASSWORD})).status_code == 200
        assert (await other.get("/api/v1/auth/me")).status_code == 200

        r = await owner.post("/api/v1/auth/password", json={"currentPassword": "wrong", "newPassword": "brand-new-pass-1"})
        assert r.status_code == 400 and "currentPassword" in r.json()["error"]["fields"]
        r = await owner.post("/api/v1/auth/password", json={"currentPassword": PASSWORD, "newPassword": "short"})
        assert r.status_code == 422
        r = await owner.post("/api/v1/auth/password", json={"currentPassword": PASSWORD, "newPassword": PASSWORD})
        assert r.status_code == 422
        r = await owner.post("/api/v1/auth/password", json={"currentPassword": PASSWORD, "newPassword": "brand-new-pass-1"})
        assert r.status_code == 200, r.text

        # this device keeps working (fresh session), the other device is signed out
        assert (await owner.get("/api/v1/auth/me")).status_code == 200
        other.cookies.delete("mbp_access")
        assert (await other.post("/api/v1/auth/refresh")).status_code == 401

    async with new_client() as c:
        assert (await c.post("/api/v1/auth/login", json={"email": "clyde@example.com", "password": PASSWORD})).status_code == 401
        assert (await c.post("/api/v1/auth/login", json={"email": "clyde@example.com", "password": "brand-new-pass-1"})).status_code == 200


@pytest.mark.parametrize("settings_overrides", [{"allow_registration": True, "rate_limit_enabled": False}])
async def test_lockout_is_per_account_not_per_name(new_client, app):
    async with new_client() as c:
        await c.post("/api/v1/auth/register", json={
            "name": "Clyde", "email": "c@example.com", "username": "clyde", "password": PASSWORD,
            "householdName": "Home"})
    limit = app.state.login_failures.max_failures
    async with new_client() as c:
        for i in range(limit):  # alternate the two names for the same account
            name = "clyde" if i % 2 else "c@example.com"
            await c.post("/api/v1/auth/login", json={"username": name, "password": "wrong"})
        for name in ("clyde", "c@example.com"):
            r = await c.post("/api/v1/auth/login", json={"username": name, "password": PASSWORD})
            assert r.status_code == 429 and r.json()["error"]["code"] == "too_many_attempts", (name, r.text)
