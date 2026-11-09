"""Tiny in-process TTL cache of validated (session, user) pairs, keyed by session id.

Saves the auth DB round trip on back-to-back requests. Security notes:

* Every revocation path in this process (logout, refresh rotation, revoke-all on refresh
  reuse) invalidates the affected entries, so they take effect immediately here.
* With several worker processes / hosts, a revocation made by *another* process (or a
  direct DB edit) is only seen here once the entry expires: a revoked access token can
  keep working for at most ``ttl`` seconds (default 10s, hard-capped at 30s). The access
  JWT itself is still verified (signature + exp) on every request. Set
  ``AUTH_CACHE_TTL_SECONDS=0`` to disable caching entirely.
* Read/revoke race: a request may read a still-live session from the DB, then a concurrent
  logout revokes it and invalidates the cache, then the first request would cache its stale
  "valid" result. To prevent that, callers take a ``begin()`` token BEFORE the DB read, and
  ``put()`` refuses to store anything if the session or user was invalidated after that token
  (revocations are kept as short-lived tombstones).
"""

from __future__ import annotations

import time
from typing import Any

MAX_TTL_SECONDS = 30.0
MAX_ENTRIES = 10_000
TOMBSTONE_SECONDS = 120.0  # must outlive any in-flight auth DB read


class AuthCache:
    def __init__(self, ttl_seconds: float) -> None:
        self.ttl = max(0.0, min(float(ttl_seconds), MAX_TTL_SECONDS))
        self._entries: dict[str, tuple[float, str, Any]] = {}  # sid -> (expires, user_id, value)
        self._epoch = 0
        # ("s", sid) / ("u", user_id) -> (epoch at invalidation, tombstone expiry)
        self._tombstones: dict[tuple[str, str], tuple[int, float]] = {}

    def begin(self) -> int:
        """Token to take BEFORE reading session/user from the DB; pass it to ``put()``."""
        return self._epoch

    def _tombstone(self, kind: str, key: str) -> None:
        self._epoch += 1
        now = time.monotonic()
        self._tombstones[(kind, key)] = (self._epoch, now + TOMBSTONE_SECONDS)
        if len(self._tombstones) > MAX_ENTRIES:
            for k in [k for k, (_, exp) in self._tombstones.items() if exp <= now]:
                self._tombstones.pop(k, None)

    def _invalidated_since(self, kind: str, key: str, token: int) -> bool:
        t = self._tombstones.get((kind, key))
        return t is not None and t[0] > token and t[1] > time.monotonic()

    def get(self, sid: str) -> Any | None:
        entry = self._entries.get(sid)
        if entry is None:
            return None
        if entry[0] <= time.monotonic():
            self._entries.pop(sid, None)
            return None
        return entry[2]

    def put(self, sid: str, user_id: str, value: Any, token: int) -> None:
        if self.ttl <= 0:
            return
        if self._invalidated_since("s", str(sid), token) or self._invalidated_since("u", str(user_id), token):
            return  # revoked while this request was reading the DB: never cache the stale result
        if len(self._entries) >= MAX_ENTRIES:
            self._evict_expired()
            if len(self._entries) >= MAX_ENTRIES:
                self._entries.clear()
        self._entries[sid] = (time.monotonic() + self.ttl, user_id, value)

    def invalidate_session(self, sid: str | None) -> None:
        if sid:
            self._tombstone("s", str(sid))
            self._entries.pop(str(sid), None)

    def invalidate_user(self, user_id: str | None) -> None:
        if not user_id:
            return
        uid = str(user_id)
        self._tombstone("u", uid)
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
