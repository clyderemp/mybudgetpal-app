from typing import Literal

from beanie import PydanticObjectId
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel

from app.models.base import HouseholdDocument

BillKind = Literal["bill", "subscription", "loan", "bnpl", "debt_payment", "savings", "other"]
BillCadence = Literal["monthly", "quarterly", "yearly"]
AmountMode = Literal["fixed", "estimate"]
IncomeKind = Literal["salary", "cash_deposit", "transfer", "other"]


class Bill(HouseholdDocument):
    """A recurring commitment: bill, subscription, loan or BNPL instalment, debt payment, set-aside."""

    name: str
    kind: BillKind = "bill"
    amount_fils: int
    # estimate: expect the average of the last 3 payments (amount_fils until there are any).
    amount_mode: AmountMode = "fixed"
    cadence: BillCadence = "monthly"
    due_day_from: int
    due_day_to: int
    account_id: PydanticObjectId | None = None
    category_id: PydanticObjectId | None = None
    # Merchant/note contains any of these (case-insensitive); empty -> the bill name.
    match_text: list[str] = Field(default_factory=list)
    amount_tolerance_pct: int = 10
    start_month: str
    end_month: str | None = None
    instalments_total: int | None = None
    instalments_paid: int = 0
    debt_id: PydanticObjectId | None = None
    purpose: Literal["household", "business"] = "household"
    active: bool = True
    notes: str | None = None
    skipped_months: list[str] = Field(default_factory=list)
    # Transactions a person unlinked from this bill: rules never match them again.
    ignored_transaction_ids: list[str] = Field(default_factory=list)
    archived: bool = False

    class Settings:
        name = "bills"
        indexes = [IndexModel([("household_id", ASCENDING)])]


class IncomePart(BaseModel):
    id: str
    label: str
    kind: IncomeKind = "salary"
    amount_fils: int
    amount_min_fils: int | None = None
    amount_max_fils: int | None = None
    day_from: int
    day_to: int
    match_text: list[str] = Field(default_factory=list)


class IncomeStream(HouseholdDocument):
    """Expected income, e.g. a salary (one part) or a salary paid as an advance plus the remainder."""

    name: str
    member_id: PydanticObjectId | None = None
    account_id: PydanticObjectId | None = None
    parts: list[IncomePart] = Field(default_factory=list)
    active: bool = True
    notes: str | None = None
    archived: bool = False

    class Settings:
        name = "income_streams"
        indexes = [IndexModel([("household_id", ASCENDING)])]
