from datetime import datetime

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import HouseholdDocument


class Session(HouseholdDocument):
    user_id: PydanticObjectId
    token_hash: str
    expires_at: datetime
    revoked_at: datetime | None = None
    replaced_by: PydanticObjectId | None = None
    user_agent: str | None = None

    class Settings:
        name = "sessions"
        indexes = [
            IndexModel([("token_hash", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING)]),
        ]
