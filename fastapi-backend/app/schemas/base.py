from __future__ import annotations

import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel

MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


class ApiModel(BaseModel):
    """Response model: camelCase on the wire."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class InputModel(BaseModel):
    """Request body: camelCase, unknown fields rejected."""

    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid", str_strip_whitespace=True
    )


def _check_month(v: str) -> str:
    if not MONTH_RE.match(v):
        raise ValueError("must be YYYY-MM")
    return v


def _check_object_id(v: str) -> str:
    if not re.fullmatch(r"[0-9a-fA-F]{24}", v):
        raise ValueError("invalid id")
    return v.lower()


Month = Annotated[str, AfterValidator(_check_month)]
ObjectIdStr = Annotated[str, AfterValidator(_check_object_id)]
Name = Annotated[str, StringConstraints(min_length=1, max_length=100)]
ShortText = Annotated[str, StringConstraints(max_length=200)]
LongText = Annotated[str, StringConstraints(max_length=1000)]
Currency = Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")]
Color = Annotated[str, StringConstraints(max_length=32)]
Icon = Annotated[str, StringConstraints(max_length=64)]

# Money bounds: 10^15 fils = AED 10 trillion. Keeps every stored value well inside
# Mongo's signed 64-bit int (unbounded ints raise OverflowError in BSON -> 500).
MAX_FILS = 10**15
Fils = Annotated[int, Field(ge=-MAX_FILS, le=MAX_FILS)]
NonNegFils = Annotated[int, Field(ge=0, le=MAX_FILS)]
PosFils = Annotated[int, Field(gt=0, le=MAX_FILS)]


class ListResponse[T](ApiModel):
    items: list[T]
    total: int
