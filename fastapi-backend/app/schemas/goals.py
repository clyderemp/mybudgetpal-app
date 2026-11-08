from __future__ import annotations

import datetime as dt
from datetime import datetime

from pydantic import Field

from app.schemas.base import ApiModel, Fils, InputModel, Name, NonNegFils, ObjectIdStr, PosFils


class GoalCreate(InputModel):
    name: Name
    target_fils: PosFils
    saved_fils: NonNegFils = 0
    target_date: dt.date | None = None
    priority: int = Field(default=1, ge=1, le=100)
    account_id: ObjectIdStr | None = None


class GoalPatch(InputModel):
    name: Name | None = None
    target_fils: PosFils | None = None
    saved_fils: NonNegFils | None = None
    target_date: dt.date | None = None
    priority: int | None = Field(default=None, ge=1, le=100)
    account_id: ObjectIdStr | None = None


class GoalContributionIn(InputModel):
    amount_fils: Fils  # may be negative (withdrawal); non-zero enforced in router


class GoalOut(ApiModel):
    id: str
    name: str
    target_fils: int
    saved_fils: int
    target_date: dt.date | None
    priority: int
    account_id: str | None
    archived: bool
    created_at: datetime
    updated_at: datetime
