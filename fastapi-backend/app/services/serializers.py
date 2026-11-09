from __future__ import annotations

from app.models import Account, Category, Debt, Goal, Transaction, User
from app.schemas.accounts import AccountOut
from app.schemas.auth import UserOut
from app.schemas.categories import CategoryOut
from app.schemas.debts import DebtOut
from app.schemas.goals import GoalOut
from app.schemas.transactions import TransactionOut


def _s(v: object) -> str | None:
    return str(v) if v is not None else None


def user_out(u: User) -> UserOut:
    return UserOut(id=str(u.id), name=u.name, email=u.email, role=u.role)


def account_out(a: Account, balance_fils: int) -> AccountOut:
    return AccountOut(
        id=str(a.id),
        name=a.name,
        institution=a.institution,
        type=a.type,
        currency=a.currency,
        opening_balance_fils=a.opening_balance_fils,
        balance_fils=balance_fils,
        last4=a.last4,
        color=a.color,
        archived=a.archived,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


def category_out(c: Category) -> CategoryOut:
    return CategoryOut(
        id=str(c.id),
        name=c.name,
        kind=c.kind,
        group=c.group,
        icon=c.icon,
        color=c.color,
        archived=c.archived,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


def transaction_out(t: Transaction, names: dict[str, str] | None = None) -> TransactionOut:
    created_by = str(t.created_by)
    return TransactionOut(
        id=str(t.id),
        account_id=str(t.account_id),
        date=t.date,
        amount_fils=t.amount_fils,
        type=t.type,
        category_id=_s(t.category_id),
        to_account_id=_s(t.to_account_id),
        merchant=t.merchant,
        note=t.note,
        created_by=created_by,
        created_by_name=(names or {}).get(created_by),
        source=t.source,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


def debt_out(d: Debt) -> DebtOut:
    return DebtOut(
        id=str(d.id),
        name=d.name,
        kind=d.kind,
        balance_fils=d.balance_fils,
        apr_bps=d.apr_bps,
        min_payment_fils=d.min_payment_fils,
        due_day=d.due_day,
        account_id=_s(d.account_id),
        archived=d.archived,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


def goal_out(g: Goal) -> GoalOut:
    return GoalOut(
        id=str(g.id),
        name=g.name,
        target_fils=g.target_fils,
        saved_fils=g.saved_fils,
        target_date=g.target_date,
        priority=g.priority,
        account_id=_s(g.account_id),
        archived=g.archived,
        created_at=g.created_at,
        updated_at=g.updated_at,
    )


async def member_names(household_id) -> dict[str, str]:  # type: ignore[no-untyped-def]
    return {str(u.id): u.name for u in await User.find({"household_id": household_id}).to_list()}
