from __future__ import annotations

from collections import defaultdict

from beanie import PydanticObjectId

from app.models import Account, Transaction


async def transaction_deltas(
    household_id: PydanticObjectId, account_ids: list[PydanticObjectId] | None = None
) -> dict[str, int]:
    """Net movement per account id (str) from non-deleted transactions."""
    query: dict = {"household_id": household_id, "deleted_at": None}
    if account_ids is not None:
        query["$or"] = [{"account_id": {"$in": account_ids}}, {"to_account_id": {"$in": account_ids}}]
    deltas: dict[str, int] = defaultdict(int)
    async for t in Transaction.find(query):
        acc = str(t.account_id)
        if t.type == "income":
            deltas[acc] += t.amount_fils
        elif t.type == "expense":
            deltas[acc] -= t.amount_fils
        elif t.type == "transfer":
            deltas[acc] -= t.amount_fils
            if t.to_account_id is not None:
                deltas[str(t.to_account_id)] += t.amount_fils
    return deltas


async def account_balances(
    household_id: PydanticObjectId, accounts: list[Account]
) -> dict[str, int]:
    """balance_fils per account id (str) = opening + income - expense +/- transfers."""
    ids = [a.id for a in accounts if a.id is not None]
    deltas = await transaction_deltas(household_id, ids) if ids else {}
    return {str(a.id): a.opening_balance_fils + deltas.get(str(a.id), 0) for a in accounts}
