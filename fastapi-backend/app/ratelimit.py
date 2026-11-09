from __future__ import annotations

import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

AUTH_LIMITED_PATHS = {
    "/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/join", "/api/v1/auth/password",
}


class FixedWindowLimiter:
    """Simple in-memory fixed-window limiter (single process; fine for a 2-user app)."""

    def __init__(self, window_seconds: int = 60) -> None:
        self.window = window_seconds
        self._hits: dict[tuple[str, str, int], int] = defaultdict(int)
        self._last_sweep = 0

    def hit(self, bucket: str, key: str, limit: int, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        slot = int(now // self.window)
        if slot != self._last_sweep:
            self._hits = defaultdict(int, {k: v for k, v in self._hits.items() if k[2] == slot})
            self._last_sweep = slot
        self._hits[(bucket, key, slot)] += 1
        return self._hits[(bucket, key, slot)] <= limit


def client_key(request: Request, ip_header: str = "") -> str:
    """Rate-limit key for a request.

    By default the socket peer (``request.client.host``). X-Forwarded-For is NOT read here:
    uvicorn must run with ``--no-proxy-headers`` (see README / ``python -m app``) because the
    Next.js /api rewrite forwards client-supplied XFF untouched. When a trusted edge proxy
    overwrites a header with the real IP, name it in ``RATE_LIMIT_CLIENT_IP_HEADER``; the
    right-most value is used (the one the nearest proxy appended).
    """
    if ip_header:
        value = request.headers.get(ip_header, "")
        last = value.split(",")[-1].strip()
        if last:
            return last
    return request.client.host if request.client else "unknown"


class LoginFailureTracker:
    """Per-account (email) failed-login counter: sliding window, in memory.

    Limits password guessing against one account even when the IP key is shared or wrong.
    """

    MAX_KEYS = 10_000

    def __init__(self, max_failures: int, window_seconds: int) -> None:
        self.max_failures = max_failures
        self.window = window_seconds
        self._fails: dict[str, deque[float]] = {}

    def _prune(self, key: str, now: float) -> deque[float] | None:
        q = self._fails.get(key)
        if q is None:
            return None
        while q and q[0] <= now - self.window:
            q.popleft()
        if not q:
            del self._fails[key]
            return None
        return q

    def is_locked(self, email: str, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        q = self._prune(email.lower(), now)
        return q is not None and len(q) >= self.max_failures

    def record_failure(self, email: str, now: float | None = None) -> None:
        now = time.time() if now is None else now
        key = email.lower()
        if key not in self._fails and len(self._fails) >= self.MAX_KEYS:
            for k in list(self._fails):
                self._prune(k, now)
            if len(self._fails) >= self.MAX_KEYS:  # still full: drop the oldest entry
                self._fails.pop(next(iter(self._fails)))
        self._fails.setdefault(key, deque()).append(now)

    def reset(self, email: str) -> None:
        self._fails.pop(email.lower(), None)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(  # type: ignore[no-untyped-def]
        self, app, auth_per_min: int, generic_per_min: int, client_ip_header: str = ""
    ) -> None:
        super().__init__(app)
        self.limiter = FixedWindowLimiter()
        self.auth_per_min = auth_per_min
        self.generic_per_min = generic_per_min
        self.client_ip_header = client_ip_header

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path.rstrip("/")
        if path.startswith("/api/"):
            ip = client_key(request, self.client_ip_header)
            ok = self.limiter.hit("generic", ip, self.generic_per_min)
            if ok and request.method == "POST" and path in AUTH_LIMITED_PATHS:
                ok = self.limiter.hit("auth", ip, self.auth_per_min)
            if not ok:
                return JSONResponse(
                    status_code=429,
                    content={"error": {"code": "rate_limited", "message": "Too many requests"}},
                    headers={"Retry-After": "60"},
                )
        return await call_next(request)
