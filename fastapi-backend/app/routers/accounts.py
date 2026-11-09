from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, Query, status

from app.models import Account
from app.schemas.accounts import AccountCreate, AccountOut, AccountPatch
from app.schemas.base import ListResponse
from app.security.deps import CurrentUser, get_current_user
from app.services.balances import account_balances, apply_balances, transaction_deltas
from app.services.ids import get_owned
from app.services.serializers import account_out

router = APIRouter(prefix="/accounts", tags=["accounts"])


async def _out(account: Account) -> AccountOut:
    balances = await account_balances(account.household_id, [account])
    return account_out(account, balances[str(account.id)])


@router.get("", response_model=ListResponse[AccountOut])
async def list_accounts(
    include_archived: bool = Query(False, alias="includeArchived"),
    current: CurrentUser = Depends(get_current_user),
) -> ListResponse[AccountOut]:
    query: dict = {"household_id": current.household_id}
    if not include_archived:
        query["archived"] = False
    # Household-wide deltas don't depend on the account list: fetch both concurrently.
    accounts, deltas = await asyncio.gather(
        Account.find(query).sort("+created_at").to_list(),
        transaction_deltas(current.household_id),
    )
    balances = apply_balances(accounts, deltas)
    items = [account_out(a, balances[str(a.id)]) for a in accounts]
    return ListResponse[AccountOut](items=items, total=len(items))


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
async def create_account(body: AccountCreate, current: CurrentUser = Depends(get_current_user)) -> AccountOut:
    account = Account(household_id=current.household_id, **body.model_dump())
    await account.insert()
    return account_out(account, account.opening_balance_fils)


@router.get("/{account_id}", response_model=AccountOut)
async def get_account(account_id: str, current: CurrentUser = Depends(get_current_user)) -> AccountOut:
    return await _out(await get_owned(Account, account_id, current.household_id, "Account"))


@router.patch("/{account_id}", response_model=AccountOut)
async def patch_account(
    account_id: str, body: AccountPatch, current: CurrentUser = Depends(get_current_user)
) -> AccountOut:
    account = await get_owned(Account, account_id, current.household_id, "Account")
    for key, value in body.model_dump(exclude_unset=True).items():
        if key in ("name", "type", "currency", "opening_balance_fils") and value is None:
            continue
        setattr(account, key, value)
    account.touch()
    await account.save()
    return await _out(account)


@router.post("/{account_id}/archive", response_model=AccountOut)
async def archive_account(account_id: str, current: CurrentUser = Depends(get_current_user)) -> AccountOut:
    account = await get_owned(Account, account_id, current.household_id, "Account")
    account.archived = True
    account.touch()
    await account.save()
    return await _out(account)
