from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "mybudgetpal"
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


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
