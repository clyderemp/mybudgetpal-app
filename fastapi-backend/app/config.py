from __future__ import annotations

import os
import re
from collections.abc import Collection, Mapping
from functools import lru_cache
from pathlib import Path
from typing import Literal

from dotenv import dotenv_values
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE = Path(__file__).resolve().parents[1] / ".env"

Database = Literal["development", "production"]
APP_ENVS = ("development", "production")
VERCEL_ENVS = ("production", "preview", "development")
PRODUCTION_HOST_MARKER = "MYBUDGETPAL_PRODUCTION_HOST"
# Keys that decide which database a process reaches. A production run must get them from the
# host environment, never from the repo .env (so a laptop with the dev .env can't reach prod).
PRODUCTION_HOST_ONLY = ("APP_ENV", "VERCEL", "VERCEL_ENV", PRODUCTION_HOST_MARKER, "MONGODB_URI", "MONGODB_DB")


def database_for(app_env: str, host_env: Mapping[str, str]) -> Database:
    """Route to a database. One Atlas URI serves both; dev and prod differ by database name only.

    APP_ENV=production alone never reaches production. It also needs a host marker: Vercel's
    VERCEL_ENV=production (preview -> development), or MYBUDGETPAL_PRODUCTION_HOST=true elsewhere.
    """
    vercel_env = host_env.get("VERCEL_ENV")
    if vercel_env:
        return "production" if vercel_env == "production" else "development"
    if app_env == "production" and host_env.get(PRODUCTION_HOST_MARKER) == "true":
        return "production"
    return "development"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    mongodb_uri: str = ""
    # Derived from app_env + host markers (database_for). If set, it must match or startup refuses.
    mongodb_db: str = ""
    jwt_secret: str
    app_origin: str = "http://localhost:3000"
    cookie_secure: bool = False
    allow_registration: bool = False

    access_token_minutes: int = 15
    refresh_token_days: int = 30
    invite_days: int = 7

    rate_limit_enabled: bool = True
    rate_limit_auth_per_min: int = 10
    rate_limit_generic_per_min: int = 300
    # Header holding the real client IP, set (overwritten) by a trusted edge proxy, e.g.
    # "X-Real-IP". Empty = use the socket peer. Never point this at a header clients can
    # send straight through (Next's /api rewrite passes client headers unchanged).
    rate_limit_client_ip_header: str = ""
    # Per-account brute-force guard on /auth/login (independent of IP keying).
    login_max_failures: int = 10
    login_failure_window_minutes: int = 15
    # Concurrent refresh from two tabs: the loser presents the just-rotated token. Within
    # this window (same user agent) it gets 401 refresh_race instead of revoke-all.
    refresh_reuse_grace_seconds: int = 30
    # In-process cache of validated (session, user) per access-token sid, saving the auth DB
    # round trip. Revocations in this process apply immediately; revocations made by other
    # processes are seen after at most this many seconds (capped at 30). 0 disables it.
    auth_cache_ttl_seconds: float = 10.0
    # One shared Motor client per process. min pool keeps a few warm connections so
    # concurrent (asyncio.gather) queries don't each pay a TLS + auth handshake.
    mongodb_max_pool_size: int = 50
    mongodb_min_pool_size: int = 4

    @field_validator("jwt_secret")
    @classmethod
    def _secret_len(cls, v: str) -> str:
        if len(v.encode("utf-8")) < 32:
            raise ValueError("JWT_SECRET must be at least 32 bytes")
        return v

    @field_validator("app_origin")
    @classmethod
    def _strip_origin(cls, v: str) -> str:
        return v.rstrip("/")

    @model_validator(mode="after")
    def _no_mock_in_prod(self) -> "Settings":
        if self.uses_mongomock and self.cookie_secure:
            raise ValueError("mongomock:// MONGODB_URI is not allowed when COOKIE_SECURE=true")
        return self

    @property
    def uses_mongomock(self) -> bool:
        return self.mongodb_uri.startswith("mongomock://")


def check_environment(
    settings: Settings,
    host_env: Mapping[str, str],
    env_file_keys: Collection[str],
) -> Settings:
    """Enforce dev/prod database separation. Fills ``mongodb_db`` with the routed database."""
    app_env = settings.app_env
    if app_env not in APP_ENVS:
        raise ValueError(f"APP_ENV must be one of {APP_ENVS}, got {app_env!r}")
    vercel_env = host_env.get("VERCEL_ENV")
    if vercel_env and vercel_env not in VERCEL_ENVS:
        raise ValueError(f"VERCEL_ENV must be one of {VERCEL_ENVS}, got {vercel_env!r}")
    if vercel_env == "production" and host_env.get("VERCEL") != "1":
        raise ValueError("VERCEL_ENV=production outside Vercel (VERCEL=1 missing); refusing to target production.")
    if app_env == "production" and not vercel_env and host_env.get(PRODUCTION_HOST_MARKER) != "true":
        raise ValueError(
            f"APP_ENV=production outside Vercel requires {PRODUCTION_HOST_MARKER}=true in the host "
            "environment; refusing to guess the database."
        )
    expected = database_for(app_env, host_env)
    routed_by = f"VERCEL_ENV={vercel_env}" if vercel_env else f"APP_ENV={app_env}"
    if expected == "production" and app_env != "production":
        raise ValueError(f"{routed_by} targets the production database but APP_ENV={app_env}; refusing to mix environments.")
    if app_env == "production" or expected == "production":
        local = [k for k in PRODUCTION_HOST_ONLY if k in env_file_keys]
        if local:
            raise ValueError(
                f"Production must not use the repo .env (it defines {', '.join(local)}); "
                "set production values in the host environment only."
            )
        if settings.uses_mongomock:
            raise ValueError("mongomock:// is not allowed in production.")
        if not settings.cookie_secure or not settings.app_origin.startswith("https://"):
            raise ValueError("Production requires COOKIE_SECURE=true and an https:// APP_ORIGIN.")
        if settings.allow_registration:
            raise ValueError("ALLOW_REGISTRATION must be false in production.")
    if not settings.mongodb_uri:
        raise ValueError("Set MONGODB_URI (or mongomock://local for an in-memory dev database).")
    if settings.uses_mongomock:
        settings.mongodb_db = settings.mongodb_db or expected
        return settings
    if not re.fullmatch(r"mongodb(\+srv)?://.+", settings.mongodb_uri) or "<db_password>" in settings.mongodb_uri:
        raise ValueError("MONGODB_URI must be a complete MongoDB connection string.")
    db = settings.mongodb_db or expected
    if db != expected:
        raise ValueError(f"{routed_by} requires MONGODB_DB={expected}; refusing to use {db}.")
    settings.mongodb_db = db
    return settings


def env_file_keys(path: Path = ENV_FILE) -> set[str]:
    return set(dotenv_values(path)) if path.is_file() else set()


@lru_cache
def get_settings() -> Settings:
    return check_environment(Settings(), os.environ, env_file_keys())  # type: ignore[call-arg]
