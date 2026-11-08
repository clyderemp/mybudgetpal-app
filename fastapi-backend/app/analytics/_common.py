"""Shared helpers for the pure analytics package (no DB, no I/O, no clock)."""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Iterable

INCOME = "income"
EXPENSE = "expense"
TRANSFER = "transfer"


def get(obj: Any, key: str, default: Any = None) -> Any:
    """Read ``key`` from a dict or an attribute-style object (dataclass/model)."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def round_half_up(value: Decimal | int | float | str) -> int:
    """Round to an integer using half-up (away from zero for .5)."""
    return int(Decimal(str(value)).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def txn_date(t: Any) -> date:
    d = get(t, "date")
    if isinstance(d, date):
        return d
    return date.fromisoformat(str(d)[:10])


def month_of(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def txn_month(t: Any) -> str:
    return month_of(txn_date(t))


def parse_month(month: str) -> tuple[int, int]:
    y, m = month.split("-")
    yi, mi = int(y), int(m)
    if not 1 <= mi <= 12:
        raise ValueError(f"invalid month: {month!r}")
    return yi, mi


def add_months(month: str, n: int) -> str:
    y, m = parse_month(month)
    idx = y * 12 + (m - 1) + n
    return f"{idx // 12:04d}-{idx % 12 + 1:02d}"


def month_range(end_month: str, months: int) -> list[str]:
    """``months`` consecutive months ending at ``end_month`` (inclusive), oldest first."""
    return [add_months(end_month, -i) for i in range(months - 1, -1, -1)]


def txn_type(t: Any) -> str:
    return str(get(t, "type"))


def amount(t: Any) -> int:
    return int(get(t, "amount_fils"))


def spending_txns(txns: Iterable[Any]) -> list[Any]:
    """Income and expense transactions only (transfers are ignored everywhere)."""
    return [t for t in txns if txn_type(t) in (INCOME, EXPENSE)]


def format_aed(fils: int) -> str:
    sign = "-" if fils < 0 else ""
    whole, frac = divmod(abs(int(fils)), 100)
    return f"{sign}AED {whole:,}.{frac:02d}"
