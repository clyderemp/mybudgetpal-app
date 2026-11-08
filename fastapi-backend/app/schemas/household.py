from datetime import datetime

from app.schemas.base import ApiModel, InputModel, Name


class HouseholdPatch(InputModel):
    name: Name


class InviteOut(ApiModel):
    code: str
    expires_at: datetime


class InviteSummaryOut(ApiModel):
    """Outstanding invite (the plain code is only ever shown once, at creation)."""

    id: str
    created_by: str
    created_at: datetime
    expires_at: datetime
