from __future__ import annotations

import asyncio
from dataclasses import dataclass

from beanie import PydanticObjectId
from fastapi import Depends, Request

from app.config import Settings
from app.errors import AppError
from app.models import Session, User
from app.security.auth_cache import get_auth_cache
from app.security.tokens import ACCESS_COOKIE, decode_access_token


@dataclass(frozen=True)
class CurrentUser:
    user_id: PydanticObjectId
    household_id: PydanticObjectId
    name: str
    email: str
    role: str


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


def _unauthorized() -> AppError:
    return AppError(401, "unauthorized", "Not authenticated")


async def get_current_user(
    request: Request, settings: Settings = Depends(get_app_settings)
) -> CurrentUser:
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise _unauthorized()
    claims = decode_access_token(token, settings.jwt_secret)
    if (
        claims is None
        or not PydanticObjectId.is_valid(claims.user_id)
        or not PydanticObjectId.is_valid(claims.session_id)
    ):
        raise _unauthorized()
    # The access JWT is bound to its session: once the session is revoked (logout,
    # rotation, refresh-reuse theft detection) the access token stops working at once.
    cache = get_auth_cache(request.app)
    cached = cache.get(claims.session_id) if cache is not None else None
    if cached is not None:
        if str(cached.user_id) != claims.user_id or str(cached.household_id) != claims.household_id:
            raise _unauthorized()
        return cached
    # Both ids come from the signed JWT, so load session and user in one concurrent round trip.
    session, user = await asyncio.gather(
        Session.get(PydanticObjectId(claims.session_id)),
        User.get(PydanticObjectId(claims.user_id)),
    )
    if session is None or session.revoked_at is not None or str(session.user_id) != claims.user_id:
        raise _unauthorized()
    if user is None or str(user.household_id) != claims.household_id:
        raise _unauthorized()
    current = CurrentUser(
        user_id=user.id,  # type: ignore[arg-type]
        household_id=user.household_id,
        name=user.name,
        email=user.email,
        role=user.role,
    )
    if cache is not None:
        cache.put(claims.session_id, claims.user_id, current)
    return current
