import datetime as dt

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import HouseholdDocument


class Goal(HouseholdDocument):
    name: str
    target_fils: int
    saved_fils: int = 0
    target_date: dt.date | None = None
    priority: int = 1
    account_id: PydanticObjectId | None = None
    archived: bool = False

    class Settings:
        name = "goals"
        indexes = [IndexModel([("household_id", ASCENDING)])]
