from __future__ import annotations


async def test_csrf_missing_header_rejected(owner):
    r = await owner.post(
        "/api/v1/accounts", json={"name": "A", "type": "bank"}, headers={"X-CSRF-Token": ""}
    )
    assert r.status_code == 403 and r.json()["error"]["code"] == "csrf_failed"


async def test_csrf_wrong_token_rejected(owner):
    r = await owner.post("/api/v1/accounts", json={"name": "A", "type": "bank"}, headers={"X-CSRF-Token": "nope"})
    assert r.status_code == 403


async def test_csrf_ok_and_origin_check(owner):
    ok = await owner.post(
        "/api/v1/accounts", json={"name": "A", "type": "bank"}, headers={"Origin": "http://localhost:3000"}
    )
    assert ok.status_code == 201
    bad = await owner.post(
        "/api/v1/accounts", json={"name": "B", "type": "bank"}, headers={"Origin": "https://evil.example"}
    )
    assert bad.status_code == 403


async def test_login_exempt_from_csrf_but_not_origin(client):
    r = await client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "whatever"})
    assert r.status_code == 401  # reached the handler
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": "a@example.com", "password": "whatever"},
        headers={"Origin": "https://evil.example"},
    )
    assert r.status_code == 403


async def test_get_needs_no_csrf(owner):
    assert (await owner.get("/api/v1/accounts", headers={"X-CSRF-Token": ""})).status_code == 200
