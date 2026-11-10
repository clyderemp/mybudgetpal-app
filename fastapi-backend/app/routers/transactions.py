from __future__ import annotations

import asyncio
import datetime as dt
import re
from typing import Any

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import ValidationError
from pydantic.alias_generators import to_camel

from app.errors import not_found, validation_error
from app.models import Transaction, utcnow
from app.schemas.base import ListResponse
from app.schemas.transactions import (
    ReviewCountOut,
    TransactionCreate,
    TransactionOut,
    TransactionPatch,
    TxnSort,
)
from app.models.transactions import TxnType
from app.security.deps import CurrentUser, get_current_user
from app.services.ids import parse_path_id
from app.services.serializers import member_names, transaction_out
from app.services.transactions import apply_to_doc, create_transaction, validate_refs

router = APIRouter(prefix="/transactions", tags=["transactions"])

_SORTS = {
    "date": [("date", 1), ("created_at", 1)],
    "-date": [("date", -1), ("created_at", -1)],
    "amount": [("amount_fils", 1), ("date", -1)],
    "-amount": [("amount_fils", -1), ("date", -1)],
}


def _filter_oid(value: str | None, field: str) -> PydanticObjectId | None:
    if value is None or value == "":
        return None
    if not PydanticObjectId.is_valid(value) or len(value) != 24:
        raise validation_error({field: "invalid id"})
    return PydanticObjectId(value)


async def _get_txn(txn_id: str, household_id: PydanticObjectId) -> Transaction:
    oid = parse_path_id(txn_id, "Transaction")
    txn = await Transaction.find_one({"_id": oid, "household_id": household_id, "deleted_at": None})
    if txn is None:
        raise not_found("Transaction")
    return txn


def _pydantic_fields(exc: ValidationError) -> dict[str, str]:
    out: dict[str, str] = {}
    for e in exc.errors():
        key = ".".join(to_camel(str(p)) for p in e.get("loc", ())) or "_"
        out.setdefault(key, e.get("msg", "invalid"))
    return out


@router.get("", response_model=ListResponse[TransactionOut])
async def list_transactions(
    from_: dt.date | None = Query(None, alias="from"),
    to: dt.date | None = Query(None),
    account_id: str | None = Query(None, alias="accountId"),
    category_id: str | None = Query(None, alias="categoryId"),
    type_: TxnType | None = Query(None, alias="type"),
    q: str | None = Query(None, max_length=100),
    needs_review: bool | None = Query(None, alias="needsReview"),
    page: int = Query(1, ge=1, le=100_000),
    page_size: int = Query(50, ge=1, le=500, alias="pageSize"),
    sort: TxnSort = Query("-date"),
    current: CurrentUser = Depends(get_current_user),
) -> ListResponse[TransactionOut]:
    query: dict[str, Any] = {"household_id": current.household_id, "deleted_at": None}
    date_q: dict[str, Any] = {}
    if from_ is not None:
        date_q["$gte"] = dt.datetime.combine(from_, dt.time.min)
    if to is not None:
        date_q["$lte"] = dt.datetime.combine(to, dt.time.min)
    if date_q:
        query["date"] = date_q
    and_: list[dict[str, Any]] = []
    acc = _filter_oid(account_id, "accountId")
    if acc is not None:
        and_.append({"$or": [{"account_id": acc}, {"to_account_id": acc}]})
    cat = _filter_oid(category_id, "categoryId")
    if cat is not None:
        query["category_id"] = cat
    if type_ is not None:
        query["type"] = type_
    if needs_review is not None:
        query["needs_review"] = True if needs_review else {"$ne": True}
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        and_.append({"$or": [{"merchant": rx}, {"note": rx}, {"items.name": rx}]})
    if and_:
        query["$and"] = and_

    total, txns, names = await asyncio.gather(
        Transaction.find(query).count(),
        Transaction.find(query).sort(_SORTS[sort]).skip((page - 1) * page_size).limit(page_size).to_list(),
        member_names(current.household_id),
    )
    return ListResponse[TransactionOut](items=[transaction_out(t, names) for t in txns], total=total)


@router.get("/review-count", response_model=ReviewCountOut)
async def review_count(current: CurrentUser = Depends(get_current_user)) -> ReviewCountOut:
    """How many (non-deleted) transactions are flagged for review — cheap, for nav badges."""
    count = await Transaction.find(
        {"household_id": current.household_id, "deleted_at": None, "needs_review": True}
    ).count()
    return ReviewCountOut(count=count)


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
async def post_transaction(
    body: TransactionCreate, current: CurrentUser = Depends(get_current_user)
) -> TransactionOut:
    txn = await create_transaction(body, current.household_id, current.user_id)
    return transaction_out(txn, {str(current.user_id): current.name})


@router.get("/{txn_id}", response_model=TransactionOut)
async def get_transaction(txn_id: str, current: CurrentUser = Depends(get_current_user)) -> TransactionOut:
    txn, names = await asyncio.gather(_get_txn(txn_id, current.household_id), member_names(current.household_id))
    return transaction_out(txn, names)


@router.patch("/{txn_id}", response_model=TransactionOut)
async def patch_transaction(
    txn_id: str, body: TransactionPatch, current: CurrentUser = Depends(get_current_user)
) -> TransactionOut:
    txn = await _get_txn(txn_id, current.household_id)
    merged: dict[str, Any] = {
        "account_id": str(txn.account_id),
        "date": txn.date,
        "amount_fils": txn.amount_fils,
        "type": txn.type,
        "category_id": str(txn.category_id) if txn.category_id else None,
        "to_account_id": str(txn.to_account_id) if txn.to_account_id else None,
        "merchant": txn.merchant,
        "note": txn.note,
        "items": [i.model_dump() for i in txn.items],
    }
    patch = body.model_dump(exclude_unset=True)
    review = patch.pop("needs_review", None)
    if patch.get("items") is None:
        patch.pop("items", None)
    merged.update(patch)
    if merged["type"] == "transfer" and "category_id" not in body.model_fields_set:
        merged["category_id"] = None
    if merged["type"] != "transfer" and "to_account_id" not in body.model_fields_set:
        merged["to_account_id"] = None
    try:
        data = TransactionCreate.model_validate(merged)
    except ValidationError as exc:
        raise validation_error(_pydantic_fields(exc)) from exc
    await validate_refs(data, current.household_id)
    apply_to_doc(txn, data)
    if review is not None:  # explicit "mark reviewed" / "flag for review" (manual flag: reason "manual")
        txn.needs_review = review
        txn.review_reason = (txn.review_reason or "manual") if review else None
    txn.touch()
    _, names = await asyncio.gather(txn.save(), member_names(current.household_id))
    return transaction_out(txn, names)


@router.delete("/{txn_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(txn_id: str, current: CurrentUser = Depends(get_current_user)) -> Response:
    txn = await _get_txn(txn_id, current.household_id)
    txn.deleted_at = utcnow()
    txn.touch()
    await txn.save()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
