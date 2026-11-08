from typing import Literal

from pymongo import ASCENDING, IndexModel

from app.models.base import HouseholdDocument

AccountType = Literal["bank", "savings", "credit_card", "cash", "loan", "investment"]


class Account(HouseholdDocument):
    name: str
    institution: str | None = None
    type: AccountType
    currency: str = "AED"
    opening_balance_fils: int = 0
    last4: str | None = None
    color: str | None = None
    archived: bool = False

    class Settings:
        name = "accounts"
        indexes = [IndexModel([("household_id", ASCENDING)])]
