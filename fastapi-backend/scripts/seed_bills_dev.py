"""DEVELOPMENT ONLY: add the household's known recurring bills and expected income, so the Bills page,
the dashboard panels and the zero-based plan can be checked with realistic data.

Usage (from fastapi-backend/):
    .venv/bin/python scripts/seed_bills_dev.py --user clyde            # dry run: prints what it would add
    .venv/bin/python scripts/seed_bills_dev.py --user clyde --apply    # adds what's missing (by name)
    .venv/bin/python scripts/seed_bills_dev.py --user clyde --remove   # deletes only what this script added

* Never runs against production: the same guard as seed_demo.py (development database only).
* Nothing is seeded automatically anywhere; real households add bills themselves or from suggestions.
* Amounts and due days are the household's known values; where the household's own transactions show a
  recurring payment for the same merchant (the suggestions detector), its amount, days, account and
  category are used instead. BNPL plan sizes and the Canada transfer are examples: edit them in the app.
* Everything added carries the note MARKER, which is how --remove finds it.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from beanie import init_beanie  # noqa: E402

from app.analytics.bills import detect_recurring  # noqa: E402
from app.db import document_models  # noqa: E402
from app.models import Account, Bill, Category, IncomePart, IncomeStream, User  # noqa: E402
from app.services.bills import bill_dict, load_match_txns  # noqa: E402
from app.services.insights import get_today, month_str  # noqa: E402
from seed_demo import _env, target_development  # noqa: E402

MARKER = "Example added by scripts/seed_bills_dev.py (development only)"


def aed(v: float) -> int:
    return int(round(v * 100))


# name, kind, amount AED, mode, cadence, day_from, day_to, match, category, extra
BILLS: list[dict[str, Any]] = [
    dict(name="Zero Max car loan", kind="loan", amount=3_350, day_from=1, day_to=5, match=["zero max"], category="Debt payment"),
    dict(name="DEWA", kind="bill", amount=600, mode="estimate", day_from=10, day_to=20, match=["dewa"], category="Utilities", tol=30),
    dict(name="Etisalat", kind="bill", amount=400, mode="estimate", day_from=1, day_to=10, match=["etisalat"], category="Telecom", tol=25),
    dict(name="Spotify", kind="subscription", amount=24.74, day_from=1, day_to=5, match=["spotify"], category="Subscriptions", tol=5),
    dict(name="ChatGPT", kind="subscription", amount=82.51, day_from=10, day_to=14, match=["openai", "chatgpt"], category="Subscriptions", tol=5),
    dict(name="Netflix", kind="subscription", amount=56, day_from=1, day_to=10, match=["netflix"], category="Subscriptions", tol=5),
    dict(name="Tabby instalment", kind="bnpl", amount=250, day_from=8, day_to=10, match=["tabby"], category="Debt payment",
         instalments=(4, 1)),
    dict(name="Tamara instalment", kind="bnpl", amount=300, day_from=15, day_to=17, match=["tamara"], category="Debt payment",
         instalments=(4, 2)),
    dict(name="Canada debt payment", kind="debt_payment", amount=1_500, mode="estimate", day_from=20, day_to=28,
         match=["international transfer", "wise", "remit"], category="Debt payment", tol=30),
    dict(name="Car insurance", kind="bill", amount=2_400, cadence="yearly", day_from=20, day_to=20, match=["axa", "insurance"],
         category="Insurance", start_offset=-8),
]


def _find_account(accounts: list[Account], *needles: str, types: tuple[str, ...] = ("bank",)) -> Account | None:
    for needle in needles:
        for a in accounts:
            if not a.archived and a.type in types and needle in a.name.lower():
                return a
    return None


async def run(username: str, apply: bool, remove: bool) -> None:
    user = await User.find_one({"username": username.lower()})
    if user is None:
        raise SystemExit(f"no user {username!r} in this database")
    hid = user.household_id
    if remove:
        b = await Bill.find({"household_id": hid, "notes": MARKER}).delete()
        s = await IncomeStream.find({"household_id": hid, "notes": MARKER}).delete()
        print(f"removed {getattr(b, 'deleted_count', 0)} bills and {getattr(s, 'deleted_count', 0)} income streams")
        return

    today = get_today()
    month = month_str(today)
    accounts = await Account.find({"household_id": hid}).to_list()
    cats = {c.name: c for c in await Category.find({"household_id": hid, "archived": False}).to_list()}
    members = await User.find({"household_id": hid}).to_list()
    existing_bills = await Bill.find({"household_id": hid, "archived": False}).to_list()
    existing_names = {b.name.lower() for b in existing_bills}
    stream_names = {s.name.lower() for s in await IncomeStream.find({"household_id": hid, "archived": False}).to_list()}
    from app.analytics._common import add_months
    from app.services.months import month_bounds

    start, _ = month_bounds(add_months(month, -6))
    suggestions = detect_recurring(await load_match_txns(hid, start, today), [bill_dict(b) for b in existing_bills], today)

    to_add: list[Bill] = []
    for spec in BILLS:
        if spec["name"].lower() in existing_names:
            continue
        seen = next((s for s in suggestions if any(m in s["matchText"][0] for m in spec["match"])), None)
        total, paid = spec.get("instalments", (None, 0))
        cat = cats.get(spec["category"])
        bill = Bill(
            household_id=hid,
            name=spec["name"],
            kind=spec["kind"],
            amount_fils=seen["amountFils"] if seen else aed(spec["amount"]),
            amount_mode=spec.get("mode", "fixed"),
            cadence=spec.get("cadence", "monthly"),
            due_day_from=seen["dueDayFrom"] if seen else spec["day_from"],
            due_day_to=seen["dueDayTo"] if seen else spec["day_to"],
            account_id=seen["accountId"] if seen else None,
            category_id=(seen or {}).get("categoryId") or (cat.id if cat else None),
            match_text=spec["match"],
            amount_tolerance_pct=spec.get("tol", 10),
            start_month=add_months(month, spec.get("start_offset", 0)) if not total else month,
            instalments_total=total,
            instalments_paid=paid,
            notes=MARKER,
        )
        to_add.append(bill)
        src = "from your transactions" if seen else "known value"
        print(f"bill   {bill.name:<22} {bill.kind:<13} AED {bill.amount_fils / 100:>9,.2f}  days {bill.due_day_from}-{bill.due_day_to}  ({src})")

    clyde = next((m for m in members if (m.username or "").lower() == "clyde"), user)
    trish = next((m for m in members if any(n in m.name.lower() for n in ("patricia", "trish"))), None)
    neo = _find_account(accounts, "neo", "mashreq")
    streams: list[IncomeStream] = []
    if "clyde salary" not in stream_names:
        streams.append(IncomeStream(
            household_id=hid, name="Clyde salary", member_id=clyde.id, account_id=neo.id if neo else None, notes=MARKER,
            parts=[IncomePart(id="salary", label="Salvone salary (previous month)", kind="salary", amount_fils=aed(17_500),
                              day_from=4, day_to=7, match_text=["salary", "salvone"])],
        ))
    if "trish salary" not in stream_names:
        streams.append(IncomeStream(
            household_id=hid, name="Trish salary", member_id=trish.id if trish else None, notes=MARKER,
            parts=[
                IncomePart(id="advance", label="Cash advance (deposited)", kind="cash_deposit", amount_fils=aed(2_500),
                           amount_min_fils=aed(2_000), amount_max_fils=aed(3_000), day_from=5, day_to=10,
                           match_text=["cash deposit", "cdm"]),
                IncomePart(id="remainder", label="Remaining salary", kind="cash_deposit", amount_fils=aed(3_000),
                           day_from=20, day_to=28, match_text=["cash deposit", "cdm"]),
            ],
        ))
    for s in streams:
        print(f"income {s.name:<22} {', '.join(f'{p.label} AED {p.amount_fils / 100:,.0f} ({p.day_from}-{p.day_to})' for p in s.parts)}")

    if not to_add and not streams:
        print("nothing to add")
        return
    if not apply:
        print("dry run: pass --apply to add these")
        return
    for b in to_add:
        await b.insert()
    for s in streams:
        await s.insert()
    print(f"added {len(to_add)} bills and {len(streams)} income streams")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--user", required=True, help="username whose household gets the examples")
    parser.add_argument("--apply", action="store_true", help="write (default: dry run)")
    parser.add_argument("--remove", action="store_true", help="delete what this script added")
    args = parser.parse_args()
    uri = _env("MONGODB_URI")
    if not uri:
        raise SystemExit("Set MONGODB_URI.")
    db_name = _env("MONGODB_DB") or "development"
    try:
        target_development(uri, db_name, _env("APP_ENV") or "development", os.environ)
    except ValueError as exc:
        raise SystemExit(f"refusing to run: {exc}") from None
    if uri.startswith("mongomock://"):
        from mongomock_motor import AsyncMongoMockClient

        client: Any = AsyncMongoMockClient()
    else:
        from motor.motor_asyncio import AsyncIOMotorClient

        client = AsyncIOMotorClient(uri, uuidRepresentation="standard")
    await init_beanie(database=client[db_name], document_models=document_models)
    await run(args.user, args.apply, args.remove)


if __name__ == "__main__":
    asyncio.run(main())
