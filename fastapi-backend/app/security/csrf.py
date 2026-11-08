from __future__ import annotations

import hmac
import secrets

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

CSRF_COOKIE = "mbp_csrf"
CSRF_HEADER = "X-CSRF-Token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_EXEMPT_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/join",
}


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def _forbidden(message: str) -> JSONResponse:
    return JSONResponse(status_code=403, content={"error": {"code": "csrf_failed", "message": message}})


class CSRFMiddleware(BaseHTTPMiddleware):
    """Double-submit cookie CSRF + Origin check for unsafe /api/* requests."""

    def __init__(self, app, app_origin: str) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.app_origin = app_origin.rstrip("/")

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        if request.method not in SAFE_METHODS and path.startswith("/api/"):
            origin = request.headers.get("origin")
            if origin is not None and origin.rstrip("/") != self.app_origin:
                return _forbidden("Origin not allowed")
            if path.rstrip("/") not in CSRF_EXEMPT_PATHS:
                cookie = request.cookies.get(CSRF_COOKIE) or ""
                header = request.headers.get(CSRF_HEADER) or ""
                if not cookie or not header or not hmac.compare_digest(cookie, header):
                    return _forbidden("Missing or invalid CSRF token")
        return await call_next(request)
