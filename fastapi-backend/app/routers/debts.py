from __future__ import annotations

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, Query, status

from app.errors import validation_error
from app.models import Account, Debt
from app.schemas.base import ListResponse
from app.schemas.debts import DebtCreate, DebtOut, DebtPatch, DebtPaymentIn, DebtPaymentOut
from app.schemas.transactions import TransactionCreate
from app.security.deps import CurrentUser, get_current_user
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


@router.get("", response_model=ListResponse[DebtOut])
async def list_debts(
    include_archived: bool = Query(False, alias="includeArchived"),
    current: CurrentUser = Depends(get_current_user),
) -> ListResponse[DebtOut]:
    query: dict = {"household_id": current.household_id}
    if not include_archived:
        query["archived"] = False
    debts = await Debt.find(query).sort("+created_at").to_list()
    return ListResponse[DebtOut](items=[debt_out(d) for d in debts], total=len(debts))


@router.post("", response_model=DebtOut, status_code=status.HTTP_201_CREATED)
async def create_debt(body: DebtCreate, current: CurrentUser = Depends(get_current_user)) -> DebtOut:
    data = body.model_dump()
    data["account_id"] = await _check_account(body.account_id, current.household_id)
    debt = Debt(household_id=current.household_id, **data)
    await debt.insert()
    return debt_out(debt)


@router.get("/{debt_id}", response_model=DebtOut)
async def get_debt(debt_id: str, current: CurrentUser = Depends(get_current_user)) -> DebtOut:
    return debt_out(await get_owned(Debt, debt_id, current.household_id, "Debt"))


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
    return debt_out(debt)


@router.post("/{debt_id}/archive", response_model=DebtOut)
async def archive_debt(debt_id: str, current: CurrentUser = Depends(get_current_user)) -> DebtOut:
    debt = await get_owned(Debt, debt_id, current.household_id, "Debt")
    debt.archived = True
    debt.touch()
    await debt.save()
    return debt_out(debt)


@router.post("/{debt_id}/payments", response_model=DebtPaymentOut, status_code=status.HTTP_201_CREATED)
async def pay_debt(
    debt_id: str, body: DebtPaymentIn, current: CurrentUser = Depends(get_current_user)
) -> DebtPaymentOut:
    """Record a payment: expense txn in 'Debt payment' + reduce balance (floored at 0)."""
    debt = await get_owned(Debt, debt_id, current.household_id, "Debt")
    category = await get_or_create_debt_payment_category(current.household_id)
    txn = await create_transaction(
        TransactionCreate(
            account_id=body.account_id,
            date=body.date,
            amount_fils=body.amount_fils,
            type="expense",
            category_id=str(category.id),
            merchant=debt.name,
            note=f"Payment to {debt.name}",
        ),
        current.household_id,
        current.user_id,
    )
    debt.balance_fils = max(0, debt.balance_fils - body.amount_fils)
    debt.touch()
    await debt.save()
    return DebtPaymentOut(
        debt=debt_out(debt), transaction=transaction_out(txn, {str(current.user_id): current.name})
    )
