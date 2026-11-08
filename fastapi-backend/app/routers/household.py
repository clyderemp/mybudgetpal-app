from __future__ import annotations

from datetime import timedelta

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Response, status

from app.config import Settings
from app.errors import AppError, not_found
from app.models import Household, Invite, as_utc, utcnow
from app.routers.auth import build_household_out
from app.schemas.auth import HouseholdOut
from app.schemas.household import HouseholdPatch, InviteOut, InviteSummaryOut
from app.security.deps import CurrentUser, get_app_settings, get_current_user
from app.security.tokens import hash_token, new_opaque_token

router = APIRouter(prefix="/household", tags=["household"])


def require_owner(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Only the household owner manages invites (members can't mint or revoke codes)."""
    if current.role != "owner":
        raise AppError(403, "owner_only", "Only the household owner can manage invites")
    return current


@router.get("", response_model=HouseholdOut)
async def get_household(current: CurrentUser = Depends(get_current_user)) -> HouseholdOut:
    return await build_household_out(current.household_id)


@router.patch("", response_model=HouseholdOut)
async def patch_household(
    body: HouseholdPatch, current: CurrentUser = Depends(get_current_user)
) -> HouseholdOut:
    household = await Household.get(current.household_id)
    if household is None:
        raise not_found("Household")
    household.name = body.name
    household.touch()
    await household.save()
    return await build_household_out(current.household_id)


@router.post("/invites", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
async def create_invite(
    current: CurrentUser = Depends(require_owner), settings: Settings = Depends(get_app_settings)
) -> InviteOut:
    code = new_opaque_token(12)  # 16 url-safe chars
    invite = Invite(
        household_id=current.household_id,
        code_hash=hash_token(code),
        created_by=current.user_id,
        expires_at=utcnow() + timedelta(days=settings.invite_days),
    )
    await invite.insert()
    return InviteOut(code=code, expires_at=invite.expires_at)


@router.get("/invites", response_model=list[InviteSummaryOut])
async def list_invites(current: CurrentUser = Depends(require_owner)) -> list[InviteSummaryOut]:
    now = utcnow()
    invites = (
        await Invite.find({"household_id": current.household_id, "used_by": None})
        .sort("+created_at")
        .to_list()
    )
    return [
        InviteSummaryOut(
            id=str(i.id), created_by=str(i.created_by), created_at=i.created_at, expires_at=i.expires_at
        )
        for i in invites
        if as_utc(i.expires_at) > now
    ]


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite(invite_id: str, current: CurrentUser = Depends(require_owner)) -> Response:
    if not PydanticObjectId.is_valid(invite_id):
        raise not_found("Invite")
    res = await Invite.find(
        {"_id": PydanticObjectId(invite_id), "household_id": current.household_id, "used_by": None}
    ).delete()
    if not res or res.deleted_count != 1:
        raise not_found("Invite")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
