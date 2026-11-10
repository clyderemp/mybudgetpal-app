from __future__ import annotations

import datetime as dt
from typing import Any

from beanie import PydanticObjectId

from app.models import Transaction
from app.services.ids import to_oid

_PROJECTION = {"_id": 1, "date": 1, "amount_fils": 1, "type": 1, "category_id": 1, "account_id": 1, "to_account_id": 1}
# The explorer also filters/groups by who recorded it and by merchant.
_DETAIL_PROJECTION = {**_PROJECTION, "merchant": 1, "created_by": 1}
# Large first batch: the whole range normally arrives in a single round trip (no getMore).
_BATCH_SIZE = 10_000


def _as_date(value: Any) -> dt.date:
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    return dt.date.fromisoformat(str(value)[:10])


async def load_analytics_txns(
    household_id: str | PydanticObjectId, start: dt.date | None, end: dt.date | None, *, detail: bool = False
) -> list[dict[str, Any]]:
    """Non-deleted household transactions in [start, end] (inclusive) as plain dicts (spec §6).

    Shape: {id, date: date, amount_fils: int, type, category_id: str|None, account_id: str,
    to_account_id: str|None}. Sorted by date ascending.
    """
    query: dict[str, Any] = {"household_id": to_oid(household_id), "deleted_at": None}
    date_q: dict[str, Any] = {}
    if start is not None:
        date_q["$gte"] = dt.datetime.combine(start, dt.time.min)
    if end is not None:
        date_q["$lte"] = dt.datetime.combine(end, dt.time.min)
    if date_q:
        query["date"] = date_q
    # Raw driver read with a projection: only the analytics fields cross the wire and no
    # per-document model validation is done.
    cursor = (
        Transaction.get_motor_collection()
        .find(query, _DETAIL_PROJECTION if detail else _PROJECTION, batch_size=_BATCH_SIZE)
        .sort("date", 1)
    )
    return [
        {
            "id": str(t["_id"]),
            "date": _as_date(t["date"]),
            "amount_fils": t["amount_fils"],
            "type": t["type"],
            "category_id": str(t["category_id"]) if t.get("category_id") else None,
            "account_id": str(t["account_id"]),
            "to_account_id": str(t["to_account_id"]) if t.get("to_account_id") else None,
            **(
                {"merchant": t.get("merchant"), "created_by": str(t["created_by"]) if t.get("created_by") else None}
                if detail
                else {}
            ),
        }
        for t in await cursor.to_list(None)
    ]


def filter_txns(txns: list[dict[str, Any]], start: dt.date | None, end: dt.date | None) -> list[dict[str, Any]]:
    """In-memory equivalent of narrowing ``load_analytics_txns`` to [start, end]."""
    return [t for t in txns if (start is None or t["date"] >= start) and (end is None or t["date"] <= end)]
