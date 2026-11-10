from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any

from pydantic import Field, StringConstraints, model_validator

from app.models.accounts import AccountPurpose
from app.models.bills import AmountMode, BillCadence, BillKind, IncomeKind
from app.schemas.base import ApiModel, InputModel, LongText, Month, Name, NonNegFils, ObjectIdStr, PosFils

MatchText = Annotated[str, StringConstraints(min_length=1, max_length=80)]
Day = Annotated[int, Field(ge=1, le=31)]
PartId = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{1,24}$")]


class BillCreate(InputModel):
    name: Name
    kind: BillKind = "bill"
    amount_fils: NonNegFils
    amount_mode: AmountMode = "fixed"
    cadence: BillCadence = "monthly"
    due_day_from: Day
    due_day_to: Day | None = None
    account_id: ObjectIdStr | None = None
    category_id: ObjectIdStr | None = None
    match_text: list[MatchText] = Field(default_factory=list, max_length=10)
    amount_tolerance_pct: int = Field(default=10, ge=0, le=100)
    start_month: Month
    end_month: Month | None = None
    instalments_total: int | None = Field(default=None, ge=1, le=600)
    instalments_paid: int = Field(default=0, ge=0, le=600)
    debt_id: ObjectIdStr | None = None
    purpose: AccountPurpose = "household"
    active: bool = True
    notes: LongText | None = None

    @model_validator(mode="after")
    def _rules(self) -> "BillCreate":
        if self.due_day_to is None:
            self.due_day_to = self.due_day_from
        if self.due_day_to < self.due_day_from:
            raise ValueError("dueDayTo must be on or after dueDayFrom")
        if self.end_month is not None and self.end_month < self.start_month:
            raise ValueError("endMonth must be on or after startMonth")
        if self.instalments_total is not None and self.instalments_paid > self.instalments_total:
            raise ValueError("instalmentsPaid can't exceed instalmentsTotal")
        return self


class BillPatch(InputModel):
    name: Name | None = None
    kind: BillKind | None = None
    amount_fils: NonNegFils | None = None
    amount_mode: AmountMode | None = None
    cadence: BillCadence | None = None
    due_day_from: Day | None = None
    due_day_to: Day | None = None
    account_id: ObjectIdStr | None = None
    category_id: ObjectIdStr | None = None
    match_text: list[MatchText] | None = Field(default=None, max_length=10)
    amount_tolerance_pct: int | None = Field(default=None, ge=0, le=100)
    start_month: Month | None = None
    end_month: Month | None = None
    instalments_total: int | None = Field(default=None, ge=1, le=600)
    instalments_paid: int | None = Field(default=None, ge=0, le=600)
    debt_id: ObjectIdStr | None = None
    purpose: AccountPurpose | None = None
    active: bool | None = None
    notes: LongText | None = None


class BillSkipIn(InputModel):
    month: Month
    skipped: bool = True


class BillLinkIn(InputModel):
    transaction_id: ObjectIdStr


class BillOut(ApiModel):
    id: str
    name: str
    kind: str
    amount_fils: int
    amount_mode: str
    cadence: str
    due_day_from: int
    due_day_to: int
    account_id: str | None
    category_id: str | None
    match_text: list[str]
    amount_tolerance_pct: int
    start_month: str
    end_month: str | None
    instalments_total: int | None
    instalments_paid: int
    debt_id: str | None
    purpose: str
    active: bool
    notes: str | None
    skipped_months: list[str]
    archived: bool
    created_at: datetime
    updated_at: datetime
    # Derived
    monthly_fils: int  # monthly share: amount / cadence months (yearly 1,200 -> 100)
    last_month: str | None  # from endMonth or the instalment count
    instalments_remaining: int | None
    remaining_fils: int | None  # instalments left x amount
    completed: bool  # every instalment / the end month is in the past


class IncomePartIn(InputModel):
    id: PartId | None = None
    label: Name
    kind: IncomeKind = "salary"
    amount_fils: PosFils
    amount_min_fils: NonNegFils | None = None
    amount_max_fils: NonNegFils | None = None
    day_from: Day
    day_to: Day | None = None
    match_text: list[MatchText] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def _rules(self) -> "IncomePartIn":
        if self.day_to is None:
            self.day_to = self.day_from
        if self.day_to < self.day_from:
            raise ValueError("dayTo must be on or after dayFrom")
        lo = self.amount_min_fils if self.amount_min_fils is not None else self.amount_fils
        hi = self.amount_max_fils if self.amount_max_fils is not None else self.amount_fils
        if not lo <= self.amount_fils <= hi:
            raise ValueError("amountFils must be between amountMinFils and amountMaxFils")
        return self


class IncomeStreamCreate(InputModel):
    name: Name
    member_id: ObjectIdStr | None = None
    account_id: ObjectIdStr | None = None
    parts: list[IncomePartIn] = Field(min_length=1, max_length=8)
    active: bool = True
    notes: LongText | None = None


class IncomeStreamPatch(InputModel):
    name: Name | None = None
    member_id: ObjectIdStr | None = None
    account_id: ObjectIdStr | None = None
    parts: list[IncomePartIn] | None = Field(default=None, min_length=1, max_length=8)
    active: bool | None = None
    notes: LongText | None = None


class IncomePartOut(ApiModel):
    id: str
    label: str
    kind: str
    amount_fils: int
    amount_min_fils: int | None
    amount_max_fils: int | None
    day_from: int
    day_to: int
    match_text: list[str]


class IncomeStreamOut(ApiModel):
    id: str
    name: str
    member_id: str | None
    account_id: str | None
    parts: list[IncomePartOut]
    active: bool
    notes: str | None
    archived: bool
    monthly_fils: int
    created_at: datetime
    updated_at: datetime


class SuggestionsOut(ApiModel):
    items: list[dict[str, Any]]
    total: int
