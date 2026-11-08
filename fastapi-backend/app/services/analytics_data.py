from __future__ import annotations

import datetime as dt
from typing import Any

from beanie import PydanticObjectId

from app.models import Transaction
from app.services.ids import to_oid


async def load_analytics_txns(
    household_id: str | PydanticObjectId, start: dt.date | None, end: dt.date | None
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
    out: list[dict[str, Any]] = []
    async for t in Transaction.find(query).sort("+date"):
        out.append(
            {
                "id": str(t.id),
                "date": t.date,
                "amount_fils": t.amount_fils,
                "type": t.type,
                "category_id": str(t.category_id) if t.category_id else None,
                "account_id": str(t.account_id),
                "to_account_id": str(t.to_account_id) if t.to_account_id else None,
            }
        )
    return out
