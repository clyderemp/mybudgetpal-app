from __future__ import annotations

import datetime as dt

from app.errors import validation_error
from app.schemas.base import MONTH_RE


def parse_month(value: str, field: str = "month") -> str:
    if not MONTH_RE.match(value):
        raise validation_error({field: "must be YYYY-MM"})
    return value


def month_bounds(month: str) -> tuple[dt.date, dt.date]:
    """First and last calendar day of a "YYYY-MM" month."""
    year, mon = int(month[:4]), int(month[5:7])
    start = dt.date(year, mon, 1)
    nxt = dt.date(year + (mon == 12), 1 if mon == 12 else mon + 1, 1)
    return start, nxt - dt.timedelta(days=1)
