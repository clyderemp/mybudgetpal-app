from __future__ import annotations

from dataclasses import dataclass

from beanie import PydanticObjectId
from fastapi import Depends, Request

from app.config import Settings
from app.errors import AppError
from app.models import Session, User
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
    session = await Session.get(PydanticObjectId(claims.session_id))
    if session is None or session.revoked_at is not None or str(session.user_id) != claims.user_id:
        raise _unauthorized()
    user = await User.get(PydanticObjectId(claims.user_id))
    if user is None or str(user.household_id) != claims.household_id:
        raise _unauthorized()
    return CurrentUser(
        user_id=user.id,  # type: ignore[arg-type]
        household_id=user.household_id,
        name=user.name,
        email=user.email,
        role=user.role,
    )
