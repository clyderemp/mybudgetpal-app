from typing import Literal

from pymongo import ASCENDING, IndexModel

from app.models.base import HouseholdDocument


class User(HouseholdDocument):
    email: str
    # Short sign-in name (lowercase). Optional: older accounts sign in with their email.
    username: str | None = None
    name: str
    password_hash: str
    role: Literal["owner", "member"] = "member"
    # DiceBear avatar choice; None -> the frontend's default style seeded by username/name.
    avatar_style: str | None = None
    avatar_seed: str | None = None

    class Settings:
        name = "users"
        indexes = [
            IndexModel([("email", ASCENDING)], unique=True),
            IndexModel([("username", ASCENDING)], unique=True, sparse=True),
            IndexModel([("household_id", ASCENDING)]),
        ]
