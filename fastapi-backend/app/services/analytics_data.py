from __future__ import annotations

import asyncio
import datetime as dt
from typing import Any

from beanie import PydanticObjectId

from app.models import Account, Transaction
from app.services.ids import to_oid

_PROJECTION = {"_id": 1, "date": 1, "amount_fils": 1, "type": 1, "category_id": 1, "account_id": 1, "to_account_id": 1}
# The explorer also filters/groups by who recorded it and by merchant.
_DETAIL_PROJECTION = {**_PROJECTION, "merchant": 1, "created_by": 1}
# Large first batch: the whole range normally arrives in a single round trip (no getMore).
_BATCH_SIZE = 10_000

# Synthetic category id for money crossing the household/business boundary: "business:<account id>".
BUSINESS_CATEGORY_PREFIX = "business:"


def business_category_id(account_id: str) -> str:
    return f"{BUSINESS_CATEGORY_PREFIX}{account_id}"


def is_business_category(category_id: str | None) -> bool:
    return bool(category_id) and str(category_id).startswith(BUSINESS_CATEGORY_PREFIX)


def _as_date(value: Any) -> dt.date:
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    return dt.date.fromisoformat(str(value)[:10])


async def business_accounts(household_id: str | PydanticObjectId) -> dict[str, str]:
    """{account id: name} of the household's business accounts. Archived ones are included:
    their history must stay out of household figures too."""
    rows = await (
        Account.get_motor_collection()
        .find({"household_id": to_oid(household_id), "purpose": "business"}, {"_id": 1, "name": 1})
        .to_list(None)
    )
    return {str(r["_id"]): r.get("name") or "Business" for r in rows}


def apply_business_boundary(txns: list[dict[str, Any]], business: dict[str, str]) -> list[dict[str, Any]]:
    """Household view of analytics transactions — the ONE place business money is kept out (pure).

    * income/expense on a business account: dropped (not the household's money);
    * transfer business -> household: household **income** on the household account, category
      ``business:<id>``, merchant "From <business account>";
    * transfer household -> business: household **expense** on the household account, category
      ``business:<id>``, merchant "To <business account>";
    * transfer business -> business: dropped; household -> household: unchanged (neutral).

    Converted rows carry ``business_account_id`` (the business side) so an account filter on the
    business account still finds them.
    """
    if not business:
        return txns
    out: list[dict[str, Any]] = []
    for t in txns:
        src = t["account_id"]
        dst = t.get("to_account_id")
        src_biz = src in business
        dst_biz = dst is not None and dst in business
        if t["type"] != "transfer":
            if not src_biz:
                out.append(t)
        elif src_biz and dst is not None and not dst_biz:
            out.append(
                {
                    **t,
                    "type": "income",
                    "account_id": dst,
                    "to_account_id": None,
                    "category_id": business_category_id(src),
                    "merchant": f"From {business[src]}",
                    "business_account_id": src,
                }
            )
        elif dst_biz and not src_biz:
            out.append(
                {
                    **t,
                    "type": "expense",
                    "to_account_id": None,
                    "category_id": business_category_id(dst),
                    "merchant": f"To {business[dst]}",
                    "business_account_id": dst,
                }
            )
        elif not src_biz:
            out.append(t)  # household <-> household: neutral
    return out


async def load_analytics_txns(
    household_id: str | PydanticObjectId,
    start: dt.date | None,
    end: dt.date | None,
    *,
    detail: bool = False,
    include_business: bool = False,
) -> list[dict[str, Any]]:
    """Non-deleted household transactions in [start, end] (inclusive) as plain dicts (spec §6).

    Shape: {id, date: date, amount_fils: int, type, category_id: str|None, account_id: str,
    to_account_id: str|None}. Sorted by date ascending.

    Business accounts are kept out via ``apply_business_boundary`` unless ``include_business``
    (then everything counts as-is and every transfer is neutral).
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
    business: dict[str, str] = {}
    if include_business:
        docs = await cursor.to_list(None)
    else:  # both reads in flight together: still one DB round
        docs, business = await asyncio.gather(cursor.to_list(None), business_accounts(household_id))
    rows = [
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
        for t in docs
    ]
    return apply_business_boundary(rows, business)


def filter_txns(txns: list[dict[str, Any]], start: dt.date | None, end: dt.date | None) -> list[dict[str, Any]]:
    """In-memory equivalent of narrowing ``load_analytics_txns`` to [start, end]."""
    return [t for t in txns if (start is None or t["date"] >= start) and (end is None or t["date"] <= end)]
