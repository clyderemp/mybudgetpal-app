from __future__ import annotations

import asyncio

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Query, status

from app.errors import validation_error
from app.models import Account, Debt
from app.schemas.base import ListResponse
from app.schemas.debts import DebtCreate, DebtOut, DebtPatch, DebtPaymentIn, DebtPaymentOut
from app.schemas.transactions import TransactionCreate
from app.security.deps import CurrentUser, get_current_user
from app.services.balances import apply_balances, transaction_deltas
from app.services.categories import get_or_create_debt_payment_category
from app.services.ids import get_owned
from app.services.serializers import debt_out, transaction_out
from app.services.transactions import create_transaction

router = APIRouter(prefix="/debts", tags=["debts"])


async def _check_account(raw: str | None, household_id: PydanticObjectId) -> PydanticObjectId | None:
    if raw is None:
        return None
    oid = PydanticObjectId(raw)
    if await Account.find_one({"_id": oid, "household_id": household_id}) is None:
        raise validation_error({"accountId": "account not found"})
    return oid


async def _debts_out(debts: list[Debt], household_id: PydanticObjectId) -> list[DebtOut]:
    """Serialize debts, adding ``linkedAccountBalanceFils`` for debts with a linked account."""
    linked_ids = list({d.account_id for d in debts if d.account_id is not None})
    balances: dict[str, int] = {}
    if linked_ids:
        # Accounts and their transaction deltas load concurrently (one DB round, not two).
        accounts, deltas = await asyncio.gather(
            Account.find({"_id": {"$in": linked_ids}, "household_id": household_id}).to_list(),
            transaction_deltas(household_id, linked_ids),
        )
        balances = apply_balances(accounts, deltas)
    out = []
    for d in debts:
        item = debt_out(d)
        if d.account_id is not None:
            item.linked_account_balance_fils = balances.get(str(d.account_id))
        out.append(item)
    return out


async def _debt_out(debt: Debt, household_id: PydanticObjectId) -> DebtOut:
    return (await _debts_out([debt], household_id))[0]


@router.get("", response_model=ListResponse[DebtOut])
async def list_debts(
    include_archived: bool = Query(False, alias="includeArchived"),
    current: CurrentUser = Depends(get_current_user),
) -> ListResponse[DebtOut]:
    query: dict = {"household_id": current.household_id}
    if not include_archived:
        query["archived"] = False
    debts = await Debt.find(query).sort("+created_at").to_list()
    return ListResponse[DebtOut](items=await _debts_out(debts, current.household_id), total=len(debts))


@router.post("", response_model=DebtOut, status_code=status.HTTP_201_CREATED)
async def create_debt(body: DebtCreate, current: CurrentUser = Depends(get_current_user)) -> DebtOut:
    data = body.model_dump()
    data["account_id"] = await _check_account(body.account_id, current.household_id)
    debt = Debt(household_id=current.household_id, **data)
    await debt.insert()
    return await _debt_out(debt, current.household_id)


@router.get("/{debt_id}", response_model=DebtOut)
async def get_debt(debt_id: str, current: CurrentUser = Depends(get_current_user)) -> DebtOut:
    return await _debt_out(await get_owned(Debt, debt_id, current.household_id, "Debt"), current.household_id)


@router.patch("/{debt_id}", response_model=DebtOut)
async def patch_debt(debt_id: str, body: DebtPatch, current: CurrentUser = Depends(get_current_user)) -> DebtOut:
    debt = await get_owned(Debt, debt_id, current.household_id, "Debt")
    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        if key == "account_id":
            value = await _check_account(value, current.household_id)
        elif value is None:
            continue
        setattr(debt, key, value)
    debt.touch()
    await debt.save()
    return await _debt_out(debt, current.household_id)


@router.post("/{debt_id}/archive", response_model=DebtOut)
async def archive_debt(debt_id: str, current: CurrentUser = Depends(get_current_user)) -> DebtOut:
    debt = await get_owned(Debt, debt_id, current.household_id, "Debt")
    debt.archived = True
    debt.touch()
    await debt.save()
    return await _debt_out(debt, current.household_id)


@router.post("/{debt_id}/payments", response_model=DebtPaymentOut, status_code=status.HTTP_201_CREATED)
async def pay_debt(
    debt_id: str, body: DebtPaymentIn, current: CurrentUser = Depends(get_current_user)
) -> DebtPaymentOut:
    """Record a payment and reduce the debt balance (floored at 0).

    * Debt linked to a ``credit_card`` or ``loan`` account (that account IS the debt, and card
      purchases are already expenses on it): a TRANSFER from ``accountId`` to the linked account,
      no category, so spending is not double-counted. Paying from that account itself -> 422.
    * Unlinked, or linked to any other account type (e.g. the bank account it is usually paid
      from): an EXPENSE in the "Debt payment" category.
    """
    debt = await get_owned(Debt, debt_id, current.household_id, "Debt")
    linked = None
    if debt.account_id is not None:
        linked = await Account.find_one({"_id": debt.account_id, "household_id": current.household_id})
    if linked is not None and linked.type in ("credit_card", "loan"):
        if PydanticObjectId(body.account_id) == debt.account_id:
            raise validation_error({"accountId": "cannot pay a debt from its own linked account"})
        data = TransactionCreate(
            account_id=body.account_id,
            date=body.date,
            amount_fils=body.amount_fils,
            type="transfer",
            to_account_id=str(debt.account_id),
            merchant=debt.name,
            note=f"Payment to {debt.name}",
        )
    else:
        category = await get_or_create_debt_payment_category(current.household_id)
        data = TransactionCreate(
            account_id=body.account_id,
            date=body.date,
            amount_fils=body.amount_fils,
            type="expense",
            category_id=str(category.id),
            merchant=debt.name,
            note=f"Payment to {debt.name}",
        )
    txn = await create_transaction(data, current.household_id, current.user_id)
    debt.balance_fils = max(0, debt.balance_fils - body.amount_fils)
    debt.touch()
    await debt.save()
    return DebtPaymentOut(
        debt=await _debt_out(debt, current.household_id),
        transaction=transaction_out(txn, {str(current.user_id): current.name}),
    )
