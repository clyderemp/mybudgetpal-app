from typing import Literal

from pymongo import ASCENDING, IndexModel

from app.models.base import HouseholdDocument


class User(HouseholdDocument):
    email: str
    name: str
    password_hash: str
    role: Literal["owner", "member"] = "member"

    class Settings:
        name = "users"
        indexes = [
            IndexModel([("email", ASCENDING)], unique=True),
            IndexModel([("household_id", ASCENDING)]),
        ]
