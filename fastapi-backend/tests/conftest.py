from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from typing import Any

import httpx
import pytest

from app.config import Settings
from app.main import create_app

ORIGIN = "http://localhost:3000"
PASSWORD = "correct-horse-battery"


def make_settings(**overrides: Any) -> Settings:
    base: dict[str, Any] = dict(
        _env_file=None,
        mongodb_uri="mongomock://test",
        mongodb_db="mbp_test",
        jwt_secret="t" * 48,
        app_origin=ORIGIN,
        cookie_secure=False,
        allow_registration=False,
    )
    base.update(overrides)
    return Settings(**base)




def _client(app) -> httpx.AsyncClient:  # type: ignore[no-untyped-def]
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver")

    async def add_csrf(request: httpx.Request) -> None:
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            token = client.cookies.get("mbp_csrf")
            if token and "X-CSRF-Token" not in request.headers:
                request.headers["X-CSRF-Token"] = token

    client.event_hooks["request"].append(add_csrf)
    return client


@pytest.fixture
def settings_overrides() -> dict[str, Any]:
    return {}


@pytest.fixture
async def app(settings_overrides: dict[str, Any]) -> AsyncIterator[Any]:
    application = create_app(make_settings(**settings_overrides))
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
def new_client(app) -> Callable[[], httpx.AsyncClient]:  # type: ignore[no-untyped-def]
    return lambda: _client(app)


@pytest.fixture
async def client(new_client) -> AsyncIterator[httpx.AsyncClient]:  # type: ignore[no-untyped-def]
    async with new_client() as c:
        yield c


async def register(c: httpx.AsyncClient, email: str = "clyde@example.com", household: str = "Home") -> dict:
    r = await c.post(
        "/api/v1/auth/register",
        json={"name": "Clyde", "email": email, "password": PASSWORD, "householdName": household},
    )
    assert r.status_code == 201, r.text
    return r.json()["user"]


@pytest.fixture
async def owner(client: httpx.AsyncClient) -> httpx.AsyncClient:
    await register(client)
    return client


async def first_category(c: httpx.AsyncClient, name: str) -> dict:
    r = await c.get("/api/v1/categories")
    return next(x for x in r.json()["items"] if x["name"] == name)


async def make_account(c: httpx.AsyncClient, name: str = "Mashreq", opening: int = 0, **kw: Any) -> dict:
    r = await c.post(
        "/api/v1/accounts", json={"name": name, "type": "bank", "openingBalanceFils": opening, **kw}
    )
    assert r.status_code == 201, r.text
    return r.json()
