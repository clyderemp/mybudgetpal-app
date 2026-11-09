"""Tiny in-process TTL cache of validated (session, user) pairs, keyed by session id.

Saves the auth DB round trip on back-to-back requests. Security notes:

* Every revocation path in this process (logout, refresh rotation, revoke-all on refresh
  reuse) invalidates the affected entries, so they take effect immediately here.
* With several worker processes / hosts, a revocation made by *another* process (or a
  direct DB edit) is only seen here once the entry expires: a revoked access token can
  keep working for at most ``ttl`` seconds (default 10s, hard-capped at 30s). The access
  JWT itself is still verified (signature + exp) on every request. Set
  ``AUTH_CACHE_TTL_SECONDS=0`` to disable caching entirely.
"""

from __future__ import annotations

import time
from typing import Any

MAX_TTL_SECONDS = 30.0
MAX_ENTRIES = 10_000


class AuthCache:
    def __init__(self, ttl_seconds: float) -> None:
        self.ttl = max(0.0, min(float(ttl_seconds), MAX_TTL_SECONDS))
        self._entries: dict[str, tuple[float, str, Any]] = {}  # sid -> (expires, user_id, value)

    def get(self, sid: str) -> Any | None:
        entry = self._entries.get(sid)
        if entry is None:
            return None
        if entry[0] <= time.monotonic():
            self._entries.pop(sid, None)
            return None
        return entry[2]

    def put(self, sid: str, user_id: str, value: Any) -> None:
        if self.ttl <= 0:
            return
        if len(self._entries) >= MAX_ENTRIES:
            self._evict_expired()
            if len(self._entries) >= MAX_ENTRIES:
                self._entries.clear()
        self._entries[sid] = (time.monotonic() + self.ttl, user_id, value)

    def invalidate_session(self, sid: str | None) -> None:
        if sid:
            self._entries.pop(str(sid), None)

    def invalidate_user(self, user_id: str | None) -> None:
        if not user_id:
            return
        uid = str(user_id)
        for sid in [s for s, (_, u, _) in self._entries.items() if u == uid]:
            self._entries.pop(sid, None)

    def clear(self) -> None:
        self._entries.clear()

    def _evict_expired(self) -> None:
        now = time.monotonic()
        for sid in [s for s, (exp, _, _) in self._entries.items() if exp <= now]:
            self._entries.pop(sid, None)


def get_auth_cache(app: Any) -> AuthCache | None:
    return getattr(app.state, "auth_cache", None)
