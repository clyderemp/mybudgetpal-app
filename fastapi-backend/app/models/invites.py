from datetime import datetime

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import HouseholdDocument


class Invite(HouseholdDocument):
    code_hash: str
    created_by: PydanticObjectId
    expires_at: datetime
    used_by: PydanticObjectId | None = None
    used_at: datetime | None = None

    class Settings:
        name = "invites"
        indexes = [
            IndexModel([("code_hash", ASCENDING)], unique=True),
            IndexModel([("household_id", ASCENDING)]),
        ]
