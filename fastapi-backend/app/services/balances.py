from __future__ import annotations

from collections import defaultdict
from typing import Any

from beanie import PydanticObjectId

from app.models import Account, Transaction


async def transaction_deltas(
    household_id: PydanticObjectId, account_ids: list[PydanticObjectId] | None = None
) -> dict[str, int]:
    """Net movement per account id (str) from non-deleted transactions.

    One aggregation round trip: sums are grouped server-side by (account, to_account, type)
    and folded into per-account deltas here, instead of streaming every transaction.
    """
    match: dict[str, Any] = {"household_id": household_id, "deleted_at": None}
    if account_ids is not None:
        match["$or"] = [{"account_id": {"$in": account_ids}}, {"to_account_id": {"$in": account_ids}}]
    pipeline: list[dict[str, Any]] = [
        {"$match": match},
        {
            "$group": {
                "_id": {"a": "$account_id", "t": "$to_account_id", "y": "$type"},
                "s": {"$sum": "$amount_fils"},
            }
        },
    ]
    rows = await Transaction.get_motor_collection().aggregate(pipeline).to_list(None)
    deltas: dict[str, int] = defaultdict(int)
    for row in rows:
        key, total = row["_id"], int(row["s"])
        acc, to_acc, typ = str(key.get("a")), key.get("t"), key.get("y")
        if typ == "income":
            deltas[acc] += total
        elif typ == "expense":
            deltas[acc] -= total
        elif typ == "transfer":
            deltas[acc] -= total
            if to_acc is not None:
                deltas[str(to_acc)] += total
    return deltas


def apply_balances(accounts: list[Account], deltas: dict[str, int]) -> dict[str, int]:
    return {str(a.id): a.opening_balance_fils + deltas.get(str(a.id), 0) for a in accounts}


async def account_balances(
    household_id: PydanticObjectId, accounts: list[Account]
) -> dict[str, int]:
    """balance_fils per account id (str) = opening + income - expense +/- transfers."""
    ids = [a.id for a in accounts if a.id is not None]
    deltas = await transaction_deltas(household_id, ids) if ids else {}
    return apply_balances(accounts, deltas)
