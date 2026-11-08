from typing import Literal

from beanie import PydanticObjectId
from pymongo import ASCENDING, IndexModel

from app.models.base import HouseholdDocument

DebtKind = Literal["credit_card", "personal_loan", "car_loan", "mortgage", "bnpl", "other"]


class Debt(HouseholdDocument):
    name: str
    kind: DebtKind
    balance_fils: int
    apr_bps: int
    min_payment_fils: int
    due_day: int
    account_id: PydanticObjectId | None = None
    archived: bool = False

    class Settings:
        name = "debts"
        indexes = [IndexModel([("household_id", ASCENDING)])]
