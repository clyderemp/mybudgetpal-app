from __future__ import annotations

import asyncio

from beanie import PydanticObjectId

from app.errors import validation_error
from app.models import Account, Category, Transaction
from app.models.transactions import TxnItem
from app.schemas.transactions import TransactionCreate


async def _owned(model: type, raw: str, household_id: PydanticObjectId):  # type: ignore[no-untyped-def]
    return await model.find_one({"_id": PydanticObjectId(raw), "household_id": household_id})  # type: ignore[attr-defined]


async def _none() -> None:
    return None


async def validate_refs(data: TransactionCreate, household_id: PydanticObjectId) -> None:
    """All referenced ids must belong to the household; category kind must match type."""
    # Independent lookups: one concurrent round trip.
    account, to_account, cat = await asyncio.gather(
        _owned(Account, data.account_id, household_id),
        _owned(Account, data.to_account_id, household_id) if data.to_account_id else _none(),
        _owned(Category, data.category_id, household_id) if data.category_id else _none(),
    )
    fields: dict[str, str] = {}
    if account is None:
        fields["accountId"] = "account not found"
    if data.to_account_id and to_account is None:
        fields["toAccountId"] = "account not found"
    if data.category_id:
        if cat is None:
            fields["categoryId"] = "category not found"
        elif cat.kind != data.type:
            fields["categoryId"] = f"category is for {cat.kind}, not {data.type}"
    if fields:
        raise validation_error(fields)


def apply_to_doc(txn: Transaction, data: TransactionCreate) -> None:
    txn.account_id = PydanticObjectId(data.account_id)
    txn.date = data.date
    txn.amount_fils = data.amount_fils
    txn.type = data.type
    txn.category_id = PydanticObjectId(data.category_id) if data.category_id else None
    txn.to_account_id = PydanticObjectId(data.to_account_id) if data.to_account_id else None
    txn.merchant = data.merchant
    txn.note = data.note
    txn.items = [TxnItem(name=i.name, amount_fils=i.amount_fils, quantity=i.quantity) for i in data.items]
    # A person entering or editing a name resolves the "no name" review flag.
    if txn.needs_review and txn.review_reason == "no_name" and data.merchant:
        txn.needs_review = False
        txn.review_reason = None


async def create_transaction(
    data: TransactionCreate, household_id: PydanticObjectId, user_id: PydanticObjectId
) -> Transaction:
    await validate_refs(data, household_id)
    txn = Transaction(
        household_id=household_id,
        account_id=PydanticObjectId(data.account_id),
        date=data.date,
        amount_fils=data.amount_fils,
        type=data.type,
        created_by=user_id,
        source="manual",
    )
    apply_to_doc(txn, data)
    await txn.insert()
    return txn
