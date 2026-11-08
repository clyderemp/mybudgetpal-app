from __future__ import annotations

from datetime import timedelta

from fastapi import Request, Response

from app.config import Settings
from app.models import Session, User, utcnow
from app.security.csrf import CSRF_COOKIE, new_csrf_token
from app.security.tokens import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    create_access_token,
    hash_token,
    new_opaque_token,
)


def _set_cookie(
    response: Response, settings: Settings, key: str, value: str, max_age: int, httponly: bool = True
) -> None:
    response.set_cookie(
        key,
        value,
        max_age=max_age,
        httponly=httponly,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


async def create_session(
    user: User, request: Request, settings: Settings
) -> tuple[Session, str]:
    token = new_opaque_token()
    session = Session(
        household_id=user.household_id,
        user_id=user.id,  # type: ignore[arg-type]
        token_hash=hash_token(token),
        expires_at=utcnow() + timedelta(days=settings.refresh_token_days),
        user_agent=(request.headers.get("user-agent") or "")[:300] or None,
    )
    await session.insert()
    return session, token


def set_auth_cookies(
    response: Response, user: User, session: Session, refresh_token: str, settings: Settings
) -> None:
    access = create_access_token(
        str(user.id),
        str(user.household_id),
        settings.jwt_secret,
        settings.access_token_minutes,
        session_id=str(session.id),
    )
    _set_cookie(response, settings, ACCESS_COOKIE, access, settings.access_token_minutes * 60)
    refresh_age = settings.refresh_token_days * 86400
    _set_cookie(response, settings, REFRESH_COOKIE, refresh_token, refresh_age)
    _set_cookie(response, settings, CSRF_COOKIE, new_csrf_token(), refresh_age, httponly=False)


async def issue_session(user: User, request: Request, response: Response, settings: Settings) -> Session:
    session, token = await create_session(user, request, settings)
    set_auth_cookies(response, user, session, token, settings)
    return session


def clear_auth_cookies(response: Response, settings: Settings) -> None:
    for key, httponly in ((ACCESS_COOKIE, True), (REFRESH_COOKIE, True), (CSRF_COOKIE, False)):
        response.delete_cookie(
            key, path="/", secure=settings.cookie_secure, httponly=httponly, samesite="lax"
        )


async def revoke_all_sessions(user_id) -> None:  # type: ignore[no-untyped-def]
    await Session.find({"user_id": user_id, "revoked_at": None}).update(
        {"$set": {"revoked_at": utcnow()}}
    )
