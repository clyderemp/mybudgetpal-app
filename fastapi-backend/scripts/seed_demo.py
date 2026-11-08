"""Seed a demo household with ~6 months of realistic AED data.

Usage (from fastapi-backend/):
    MONGODB_URI=mongodb://localhost:27017 .venv/bin/python scripts/seed_demo.py [--reset] [--db NAME]

* Owner login: demo@mybudgetpal.local, with a random password printed ONCE.
* 3 accounts (Mashreq Neo, Emirates NBD, Cash), 2 debts, 1 savings goal, a plan, budgets for
  the last two months, and transactions for the 6 full months before this one plus
  the current month to date (Asia/Dubai).
* Refuses to run if the demo user already exists unless --reset (which removes only the demo
  household's documents first).
* MONGODB_URI / MONGODB_DB come from the environment (or a local .env); --uri / --db override.
  A mongomock:// URI works but the data lives only inside this process (useful as a smoke test).
"""

from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import os
import random
import secrets
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from beanie import PydanticObjectId, init_beanie  # noqa: E402

from app.db import document_models  # noqa: E402
from app.models import (  # noqa: E402
    Account,
    Budget,
    BudgetLine,
    Category,
    Debt,
    Goal,
    Household,
    Invite,
    Plan,
    Session,
    Transaction,
    User,
)
from app.security.passwords import hash_password  # noqa: E402
from app.services.categories import seed_default_categories  # noqa: E402
from app.services.insights import get_today, month_str, shift_month  # noqa: E402

DEMO_EMAIL = "demo@mybudgetpal.local"
MONTHS = 6
HOUSEHOLD_MODELS = (Account, Budget, Category, Debt, Goal, Invite, Plan, Session, Transaction)


def aed(amount: float) -> int:
    """AED -> integer fils."""
    return int(round(amount * 100))


async def _wipe_demo(user: User) -> None:
    hid = user.household_id
    for model in HOUSEHOLD_MODELS:
        await model.find({"household_id": hid}).delete()
    await User.find({"household_id": hid}).delete()
    await Household.find({"_id": hid}).delete()


async def seed(today: dt.date, password: str, reset: bool = False, rng_seed: int = 42) -> dict[str, Any]:
    """Create the demo household. Beanie must already be initialised. Returns a summary."""
    existing = await User.find_one({"email": DEMO_EMAIL})
    if existing is not None:
        if not reset:
            raise SystemExit(f"{DEMO_EMAIL} already exists; rerun with --reset to recreate it.")
        await _wipe_demo(existing)

    rng = random.Random(rng_seed)
    user_id = PydanticObjectId()
    household = Household(name="Demo Household", owner_id=user_id)
    await household.insert()
    hid: PydanticObjectId = household.id  # type: ignore[assignment]
    user = User(id=user_id, household_id=hid, email=DEMO_EMAIL, name="Demo Owner",
                password_hash=hash_password(password), role="owner")
    await user.insert()
    await seed_default_categories(hid)
    cat = {c.name: c.id async for c in Category.find({"household_id": hid})}

    first_month = shift_month(month_str(today), -MONTHS)
    y0, m0 = int(first_month[:4]), int(first_month[5:7])
    start = dt.date(y0, m0, 1)

    mashreq = Account(household_id=hid, name="Mashreq Neo", institution="Mashreq Neo", type="bank",
                      opening_balance_fils=aed(18_500), last4="4821", color="#f97316")
    enbd = Account(household_id=hid, name="Emirates NBD", institution="Emirates NBD", type="bank",
                   opening_balance_fils=aed(9_200), last4="1937", color="#2563eb")
    cash = Account(household_id=hid, name="Cash", type="cash", opening_balance_fils=aed(650), color="#10b981")
    for a in (mashreq, enbd, cash):
        await a.insert()

    txns: list[Transaction] = []

    def add(d: dt.date, acc: Account, amount_fils: int, type_: str, category: str | None = None,
            merchant: str | None = None, to: Account | None = None, note: str | None = None) -> None:
        if d > today or d < start:
            return
        txns.append(Transaction(
            household_id=hid, account_id=acc.id, date=d, amount_fils=amount_fils, type=type_,  # type: ignore[arg-type]
            category_id=cat[category] if category else None, to_account_id=to.id if to else None,
            merchant=merchant, note=note, created_by=user_id, source="manual",
        ))

    month = first_month
    while month <= month_str(today):
        y, m = int(month[:4]), int(month[5:7])

        def day(n: int) -> dt.date:
            return dt.date(y, m, n)

        add(day(1), mashreq, aed(24_000), "income", "Salary", "Employer A", note="Monthly salary")
        add(day(1), enbd, aed(14_500), "income", "Salary", "Employer B", note="Monthly salary")
        if m % 3 == 0:
            add(day(12), mashreq, aed(rng.choice([800, 1_200, 1_500])), "income", "Other income", "Freelance")
        add(day(2), enbd, aed(9_500), "expense", "Rent", "Landlord", note="Apartment rent")
        add(day(5), mashreq, aed(rng.uniform(620, 980)), "expense", "Utilities", "DEWA")
        add(day(6), mashreq, aed(399), "expense", "Telecom", "du")
        add(day(6), enbd, aed(249), "expense", "Telecom", "Etisalat e&")
        add(day(8), mashreq, aed(56), "expense", "Subscriptions", "Netflix")
        add(day(8), mashreq, aed(22), "expense", "Subscriptions", "Spotify")
        add(day(9), enbd, aed(1_850), "expense", "Education", "Nursery fees")
        add(day(3), mashreq, aed(1_000), "transfer", to=cash, note="ATM withdrawal")
        add(day(10), enbd, aed(2_100), "expense", "Debt payment", "ENBD Auto Loan", note="Car loan instalment")
        add(day(20), mashreq, aed(rng.choice([900, 1_200, 1_500])), "expense", "Debt payment",
            "Mashreq Credit Card", note="Card payment")
        if m in (1, 7):
            add(day(14), enbd, aed(3_400), "expense", "Insurance", "AXA Motor", note="Car insurance")
        for week_day in (4, 11, 18, 25):
            add(day(week_day), mashreq, aed(rng.uniform(320, 720)), "expense", "Groceries",
                rng.choice(["Carrefour", "Lulu Hypermarket", "Spinneys", "Union Coop"]))
            add(day(week_day + 1), enbd, aed(rng.uniform(150, 240)), "expense", "Fuel", rng.choice(["ENOC", "ADNOC"]))
            add(day(week_day + 2), cash, aed(rng.uniform(15, 60)), "expense", "Groceries", "Corner grocery")
        for _ in range(rng.randint(5, 9)):
            add(day(rng.randint(1, 28)), mashreq, aed(rng.uniform(45, 380)), "expense", "Dining",
                rng.choice(["Talabat", "Deliveroo", "Operation Falafel", "Tim Hortons", "PF Chang's"]))
        for _ in range(rng.randint(3, 6)):
            add(day(rng.randint(1, 28)), mashreq, aed(rng.uniform(12, 90)), "expense", "Transport",
                rng.choice(["Careem", "RTA Salik", "RTA Nol top-up", "Uber"]))
        for _ in range(rng.randint(1, 3)):
            add(day(rng.randint(1, 28)), mashreq, aed(rng.uniform(150, 900)), "expense", "Shopping",
                rng.choice(["Amazon.ae", "Noon", "IKEA", "Centrepoint"]))
        if rng.random() < 0.6:
            add(day(rng.randint(1, 28)), mashreq, aed(rng.uniform(80, 450)), "expense", "Entertainment",
                rng.choice(["VOX Cinemas", "Dubai Parks", "Ain Dubai"]))
        if rng.random() < 0.4:
            add(day(rng.randint(1, 28)), enbd, aed(rng.uniform(120, 600)), "expense", "Health",
                rng.choice(["Aster Pharmacy", "Mediclinic"]))
        add(day(15), mashreq, aed(2_000), "transfer", to=enbd, note="Savings top-up")
        month = shift_month(month, 1)

    # One-off events: a trip two months ago, a gift last month.
    trip = shift_month(month_str(today), -2)
    add(dt.date(int(trip[:4]), int(trip[5:7]), 17), mashreq, aed(4_850), "expense", "Travel", "Emirates Airlines")
    last = shift_month(month_str(today), -1)
    add(dt.date(int(last[:4]), int(last[5:7]), 21), mashreq, aed(650), "expense", "Gifts", "Bloomingdale's")
    await Transaction.insert_many(txns)

    card = Debt(household_id=hid, name="Mashreq Credit Card", kind="credit_card", balance_fils=aed(12_480),
                apr_bps=3699, min_payment_fils=aed(624), due_day=20, account_id=mashreq.id)
    car = Debt(household_id=hid, name="ENBD Auto Loan", kind="car_loan", balance_fils=aed(64_300),
               apr_bps=499, min_payment_fils=aed(2_100), due_day=10, account_id=enbd.id)
    await card.insert()
    await car.insert()

    goal_date = dt.date(today.year + 1, today.month, 1)
    await Goal(household_id=hid, name="Emergency fund", target_fils=aed(75_000), saved_fils=aed(21_000),
               target_date=goal_date, priority=1, account_id=enbd.id).insert()
    await Plan(household_id=hid, strategy="avalanche", monthly_debt_budget_fils=aed(4_000),
               monthly_savings_fils=aed(2_000), emergency_fund_months=6).insert()

    limits = {"Rent": 9_500, "Utilities": 1_000, "Groceries": 2_800, "Fuel": 900, "Telecom": 700,
              "Dining": 1_200, "Transport": 300, "Shopping": 1_000, "Entertainment": 400,
              "Subscriptions": 100, "Education": 1_850, "Debt payment": 3_600}
    for mth in (shift_month(month_str(today), -1), month_str(today)):
        await Budget(household_id=hid, month=mth,
                     lines=[BudgetLine(category_id=cat[n], limit_fils=aed(v)) for n, v in limits.items()]).insert()

    return {"household_id": str(hid), "user_id": str(user_id), "transactions": len(txns),
            "from": start.isoformat(), "to": today.isoformat()}


def _env(name: str, default: str | None = None) -> str | None:
    if name in os.environ:
        return os.environ[name]
    env_file = Path(__file__).resolve().parents[1] / ".env"
    if env_file.is_file():
        for line in env_file.read_text().splitlines():
            key, sep, value = line.partition("=")
            if sep and key.strip() == name:
                return value.strip().strip('"').strip("'")
    return default


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--uri", default=None, help="MongoDB URI (default: $MONGODB_URI)")
    parser.add_argument("--db", default=None, help="database name (default: $MONGODB_DB or mybudgetpal)")
    parser.add_argument("--reset", action="store_true", help="delete and recreate the demo household")
    args = parser.parse_args()

    uri = args.uri or _env("MONGODB_URI")
    if not uri:
        raise SystemExit("Set MONGODB_URI (or pass --uri).")
    db_name = args.db or _env("MONGODB_DB", "mybudgetpal")
    if uri.startswith("mongomock://"):
        from mongomock_motor import AsyncMongoMockClient

        client: Any = AsyncMongoMockClient()
        print("note: mongomock:// is in-memory; seeded data disappears when this script exits.")
    else:
        from motor.motor_asyncio import AsyncIOMotorClient

        client = AsyncIOMotorClient(uri, uuidRepresentation="standard")
    await init_beanie(database=client[db_name], document_models=document_models)

    password = secrets.token_urlsafe(12)
    result = await seed(get_today(), password, reset=args.reset)
    print(f"Seeded demo household into database '{db_name}': {result['transactions']} transactions "
          f"({result['from']} .. {result['to']}), 3 accounts, 2 debts, 1 goal.")
    print(f"Login: {DEMO_EMAIL}")
    print(f"Password (shown once): {password}")


if __name__ == "__main__":
    asyncio.run(main())
