from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.config import Settings, get_settings
from app.db import init_db
from app.errors import install_error_handlers
from app.security.auth_cache import AuthCache
from app.ratelimit import LoginFailureTracker, RateLimitMiddleware
from app.routers import (
    accounts,
    auth,
    budgets,
    categories,
    dashboard,
    debts,
    goals,
    household,
    insights,
    plan,
    receipts,
    transactions,
)
from app.security.csrf import CSRF_HEADER, CSRFMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Cache-Control", "no-store")
        return response


def build_api_router() -> APIRouter:
    api = APIRouter(prefix="/api/v1")
    routers = (auth, household, accounts, categories, transactions, budgets, debts, goals, plan, insights, dashboard)
    for mod in (*routers, receipts):
        api.include_router(mod.router)
    return api


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        client = await init_db(settings)
        app.state.mongo_client = client
        try:
            yield
        finally:
            close = getattr(client, "close", None)
            if callable(close):
                close()

    app = FastAPI(
        title="MyBudgetPal API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None if settings.cookie_secure else "/api/docs",
        redoc_url=None,
        openapi_url=None if settings.cookie_secure else "/api/openapi.json",
    )
    app.state.settings = settings
    app.state.login_failures = LoginFailureTracker(
        settings.login_max_failures, settings.login_failure_window_minutes * 60
    )
    app.state.auth_cache = AuthCache(settings.auth_cache_ttl_seconds)
    install_error_handlers(app)

    # Middleware: last added runs first (outermost).
    app.add_middleware(CSRFMiddleware, app_origin=settings.app_origin)
    if settings.rate_limit_enabled:
        app.add_middleware(
            RateLimitMiddleware,
            auth_per_min=settings.rate_limit_auth_per_min,
            generic_per_min=settings.rate_limit_generic_per_min,
            client_ip_header=settings.rate_limit_client_ip_header,
            receipts_per_min=settings.rate_limit_receipts_per_min,
        )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.app_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", CSRF_HEADER],
    )
    app.add_middleware(SecurityHeadersMiddleware)

    @app.get("/api/health", tags=["health"])
    async def health() -> dict[str, bool]:
        return {"ok": True}

    app.include_router(build_api_router())
    return app


def _lazy_app() -> FastAPI:
    return create_app()


# `uvicorn app.main:app` — built lazily so importing this module in tests needs no env.
def __getattr__(name: str) -> FastAPI:
    if name == "app":
        global app
        app = _lazy_app()
        return app
    raise AttributeError(name)
