"""One-off import of the legacy Firebase (Firestore) data into a new household.

Input is a read-only Firestore export (JSON of ``{"path": {"_fields": {...}}}``), kept outside the repo
because it holds personal financial data. Only the owner's own Firebase user is imported; other
people who signed up to the old public app are never read beyond their path.

Usage (from fastapi-backend/):
    .venv/bin/python scripts/import_firebase.py EXPORT.json --owner-email E --member-email E \
        [--target development|production] [--replace] [--dry-run] [--confirm-production]

Mapping (decided with the owner, 9 Nov 2026):
* Source of truth is ``users/{uid}/receipts`` (the old ``transactions`` collection is an earlier copy).
* CAD amounts become AED: the receipt's own recorded CAD->AED rate if it has one (!= 1), else the
  ECB CAD->USD rate for that date (or the last earlier one) x the AED peg 3.6725. The original
  amount and rate are kept in the note.
* Cards from the (decrypted) ``financialAccounts`` become accounts; generic payment methods become
  per-era accounts ("Canada ..." archived, "UAE ...").
* ``savings`` receipts become transfers into a savings account; zero amounts are skipped.
* ``reportedBy`` maps to the owner or the member login. Opening balances are 0 (unknown).
* ``money-out`` budget lines become monthly budgets; ``money-in``/``savings`` lines are skipped.
* The single savings goal is kept. Card numbers are never imported.

Writes go to ``development`` by default. ``--target production`` additionally needs
``--confirm-production``; this is the only script allowed to write there, by explicit request.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import bisect
import datetime as dt
import hashlib
import json
import re
import secrets
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from beanie import PydanticObjectId, init_beanie  # noqa: E402

from app.db import document_models  # noqa: E402
from app.models import Account, Budget, Category, Goal, Household, Transaction, User  # noqa: E402
from app.models.budgets import BudgetLine  # noqa: E402
from app.security.passwords import hash_password  # noqa: E402
from app.services.categories import DEFAULT_CATEGORIES  # noqa: E402

AED_PER_USD = 3.6725
OWNER_UID = "GOHAAKju6WZiQcPge37EjK7GIO33"

# Extra categories the defaults don't cover: (name, kind, group, icon)
EXTRA_CATEGORIES = [
    ("Parking", "expense", "essentials", "parking-circle"),
    ("Car maintenance", "expense", "essentials", "wrench"),
    ("Car payment", "expense", "debt", "car"),
    ("Personal care", "expense", "lifestyle", "sparkles"),
    ("Personal spending", "expense", "lifestyle", "wallet"),
    ("Pet care", "expense", "lifestyle", "dog"),
    ("Wedding", "expense", "lifestyle", "heart"),
    ("Vapes", "expense", "lifestyle", "wind"),
    ("Home maintenance", "expense", "essentials", "hammer"),
]

CATEGORY_MAP = {
    "Dining Out": "Dining", "Dining Out - Food": "Dining", "Dining Out - Drinks": "Dining", "Cafe": "Dining",
    "Take out (UberEATS, DoorDash, Ritual)": "Dining", "Snacks": "Dining",
    "Groceries": "Groceries", "Grocery": "Groceries",
    "Gas": "Fuel",
    "Commute": "Transport", "Car Rental": "Transport",
    "Parking": "Parking", "Parking Tickets": "Parking",
    "Others (Personal Spendings)": "Personal spending", "Personal Spending": "Personal spending",
    "Loan Payments": "Debt payment", "Credit Payments": "Debt payment",
    "Car Payments": "Car payment",
    "Phone Bill": "Telecom", "Internet Bill": "Telecom",
    "Clothings": "Shopping", "Appliances": "Shopping", "Applicances": "Shopping", "E-Purchases": "Shopping",
    "Electronics": "Shopping", "Household Expenses": "Shopping",
    "Subscriptions": "Subscriptions", "Memberships": "Subscriptions", "Gym Related": "Subscriptions",
    "Rent": "Rent", "Utilities": "Utilities", "Insurance": "Insurance",
    "Personal Care": "Personal care", "Vitamins & Supplements": "Personal care",
    "Charge Fees": "Fees", "Charge Fees / Taxes": "Fees", "Taxes": "Fees",
    "Car Maintenance": "Car maintenance",
    "Travels": "Travel", "Recreation": "Entertainment", "Entertainment": "Entertainment",
    "Medical Care": "Health", "Home Maintenance": "Home maintenance",
    "Vapes": "Vapes",
    # income
    "Job Paycheque": "Salary", "Tax Return": "Other income", "Passive Income": "Other income",
    "Loan Funds": "Other income", "Others": "Other income",
}

# "Custom" receipts carry free text in customCategory; matched by keyword (lower-case), else Other.
CUSTOM_RULES = [
    (r"biscoff|pet", "Pet care"), (r"wedding", "Wedding"), (r"haircut|groom|facewash", "Personal care"),
    (r"vape", "Vapes"), (r"snack|lunch|food|cafe", "Dining"), (r"electronic|shoes|book|office|photo|purchase",
    "Shopping"), (r"gift", "Gifts"), (r"car wash", "Car maintenance"), (r"parking", "Parking"),
    (r"flight|hotel", "Travel"), (r"cinema", "Entertainment"), (r"tamara", "Debt payment"),
    (r"car rental", "Transport"), (r"apple dev|license", "Fees"),
]


def map_category(name: str | None, custom: str | None) -> str:
    if name == "Custom" or (name and name not in CATEGORY_MAP):
        text = (custom or name or "").strip().lower()
        for pattern, target in CUSTOM_RULES:
            if re.search(pattern, text):
                return target
        return "Other"
    return CATEGORY_MAP.get(name or "", "Other")


# ---------------------------------------------------------------- decryption (CryptoJS AES)
def _cryptojs_decrypt(b64: str, passphrase: str) -> str:
    from Crypto.Cipher import AES  # pycryptodome, only needed by this one-off script

    raw = base64.b64decode(b64)
    if raw[:8] != b"Salted__":
        raise ValueError("not a CryptoJS salted ciphertext")
    salt, ct = raw[8:16], raw[16:]
    dk, prev = b"", b""
    while len(dk) < 48:  # OpenSSL EVP_BytesToKey (MD5), as CryptoJS does for passphrases
        prev = hashlib.md5(prev + passphrase.encode() + salt).digest()
        dk += prev
    pt = AES.new(dk[:32], AES.MODE_CBC, dk[32:48]).decrypt(ct)
    return pt[: -pt[-1]].decode()


def decrypt_accounts(user_fields: dict[str, Any], uid: str) -> list[dict[str, Any]]:
    blob = user_fields.get("financialAccounts")
    if not blob:
        return []
    keys = [hashlib.sha256(f"{uid}-{i}".encode()).hexdigest() for i in range(100)]
    chunks = json.loads(blob)
    return json.loads("".join(_cryptojs_decrypt(c, keys[i]) for i, c in enumerate(chunks)))


# ---------------------------------------------------------------- FX
class CadToAed:
    def __init__(self, usd_per_cad: dict[str, float]):
        self.days = sorted(usd_per_cad)
        self.rates = usd_per_cad

    @classmethod
    def fetch(cls, start: dt.date, end: dt.date) -> CadToAed:
        rates: dict[str, float] = {}
        cur = start - dt.timedelta(days=7)  # so the first dates have an earlier fixing
        while cur <= end:
            stop = min(end, dt.date(cur.year, 12, 31))
            url = f"https://api.frankfurter.dev/v1/{cur}..{stop}?from=CAD&to=USD"
            data = json.load(urllib.request.urlopen(url, timeout=30))
            rates.update({d: v["USD"] for d, v in data["rates"].items()})
            cur = stop + dt.timedelta(days=1)
        return cls(rates)

    def rate(self, day: dt.date) -> float:
        i = bisect.bisect_right(self.days, day.isoformat()) - 1
        if i < 0:
            raise ValueError(f"no CAD rate on or before {day}")
        return self.rates[self.days[i]] * AED_PER_USD


# ---------------------------------------------------------------- plan
def _num(v: Any) -> float:
    try:
        return float(str(v).replace(",", "")) if v not in (None, "") else 0.0
    except ValueError:
        return 0.0


def _date(v: Any) -> dt.date:
    return dt.date.fromisoformat(str(v)[:10])


def _owner_name(fields: dict[str, Any], fallback: str) -> str:
    name = " ".join(x for x in (fields.get("fname"), fields.get("lname")) if x).strip()
    return name or fallback


def build_plan(export: dict[str, Any], fx: CadToAed | None, owner_uid: str = OWNER_UID) -> dict[str, Any]:
    """Pure mapping: Firestore export -> plain dicts ready to insert. ``fx`` needed only for CAD."""
    base = f"users/{owner_uid}"
    user = export[base]["_fields"]
    members = [v["_fields"] for p, v in export.items() if p.startswith(f"{base}/coUsers/")]
    member = members[0] if members else None
    member_uid = member["_id"] if member else None
    receipts = [v["_fields"] for p, v in export.items() if p.startswith(f"{base}/receipts/")]
    budgets_src = [v["_fields"] for p, v in export.items() if p.startswith(f"{base}/budgetData/")]
    first_names = {owner_uid: user.get("fname") or "Owner"}
    if member:
        first_names[member_uid] = member.get("fname") or "Member"

    # Accounts: cards first, then generic per-era accounts created on demand.
    accounts: dict[str, dict[str, Any]] = {}
    for c in decrypt_accounts(user, owner_uid):
        who = first_names.get(c.get("owner"), "")
        kind = c.get("cardType")
        if kind in ("credit", "installment"):
            acc_type, label = "credit_card", ("Credit card" if kind == "credit" else "Instalments")
        elif c.get("accountType") == "savings":
            acc_type, label = "savings", "Savings"
        else:
            acc_type, label = "bank", {"joint": "Joint", "personal": "Personal"}.get(c.get("accountType"), "Account")
        bank = c.get("bank") or "Card"
        name = f"{bank} {label}" if kind != "installment" else bank
        if label != "Joint" and who:
            name += f" ({who})"
        accounts[c["id"]] = {"name": name, "institution": bank, "type": acc_type, "archived": False}

    def generic(era: str, kind: str) -> str:
        key = f"{era}:{kind}"
        if key not in accounts:
            label = {"bank": "Bank (legacy)", "credit_card": "Credit card (legacy)",
                     "savings": "Savings (legacy)", "cash": "Cash"}[kind]
            accounts[key] = {"name": f"{'Canada' if era == 'CAD' else 'UAE'} {label}", "institution": None,
                             "type": kind, "archived": era == "CAD"}
        return key

    def account_for(method: str | None, era: str) -> str:
        if method and method in accounts:
            return method
        return generic(era, {"credit": "credit_card", "savings": "savings", "cash": "cash"}.get(method or "", "bank"))

    txns: list[dict[str, Any]] = []
    skipped = Counter()
    converted = 0
    for r in sorted(receipts, key=lambda x: (str(x["date"]), str(x.get("creationDate")))):
        value = _num(r.get("value"))
        if value <= 0:
            skipped["zero amount"] += 1
            continue
        day = _date(r["date"])
        era = "CAD" if r.get("currency") == "CAD" else "AED"
        note_parts = [r.get("note") or ""]
        if era == "CAD":
            own = _num(r.get("exchangeRate"))
            rate = own if own > 1.5 else (fx.rate(day) if fx else None)
            if rate is None:
                raise SystemExit("CAD receipts need FX rates")
            amount = int(round(value * rate * 100))
            note_parts.append(f"Originally CAD {value:,.2f} @ {rate:.4f}")
            converted += 1
        else:
            amount = int(round(value * 100))
        if r.get("customCategory"):
            note_parts.append(f"[{r['customCategory'].strip()}]")
        items = r.get("items") or []
        if items:
            note_parts.append("Items: " + "; ".join(
                f"{i.get('name', '?')} x{i.get('quantity', 1)} ({_num(i.get('total')):,.2f})" for i in items))
        note = " | ".join(p for p in note_parts if p).strip() or None
        if note and len(note) > 500:
            note = note[:497] + "..."
        by = "member" if r.get("reportedBy") == member_uid and member_uid else "owner"
        method = r.get("paymentMethod")
        t: dict[str, Any] = {"date": day, "amount_fils": amount, "merchant": (r.get("merchant") or "").strip() or None,
                             "note": note, "by": by, "category": None, "to": None}
        if r["type"] == "savings":
            src = account_for(method, era)
            if accounts[src]["type"] == "savings":
                t.update(type="transfer", account=generic(era, "bank"), to=src)
            else:
                t.update(type="transfer", account=src, to=generic(era, "savings"))
        elif r["type"] == "income":
            t.update(type="income", account=account_for(method, era), category=map_category(r.get("category"), r.get("customCategory")))
        else:
            t.update(type="expense", account=account_for(method, era), category=map_category(r.get("category"), r.get("customCategory")))
        txns.append(t)

    budgets: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    skipped_budget = Counter()
    for b in budgets_src:
        if b.get("type") != "money-out":
            skipped_budget[b.get("type")] += 1
            continue
        y, m = str(b["month"]).split("-")
        cats = b.get("categories") or ["Other"]
        budgets[f"{y}-{int(m):02d}"][map_category(cats[0], cats[0])] += int(round(_num(b.get("amount")) * 100))

    goal = None
    savings = user.get("savings") or {}
    if _num(savings.get("goal")) > 0:
        goal = {"name": "Savings goal", "target_fils": int(round(_num(savings["goal"]) * 100)),
                "saved_fils": int(round(_num(savings.get("balance")) * 100))}

    return {
        "owner": {"name": _owner_name(user, "Owner"), "created": user.get("createdOn")},
        "member": {"name": _owner_name(member, "Member")} if member else None,
        "accounts": accounts, "transactions": txns, "budgets": {k: dict(v) for k, v in budgets.items()},
        "goal": goal,
        "stats": {"receipts": len(receipts), "imported": len(txns), "skipped": dict(skipped),
                  "cad_converted": converted, "budget_lines_skipped": dict(skipped_budget),
                  "by_type": dict(Counter(t["type"] for t in txns)),
                  "by_person": dict(Counter(t["by"] for t in txns)),
                  "by_category": dict(Counter(t["category"] for t in txns if t["category"]).most_common()),
                  "from": str(min(t["date"] for t in txns)), "to": str(max(t["date"] for t in txns)),
                  "other_firebase_users_ignored": sum(1 for p in export if p.count("/") == 1
                                                      and p.startswith("users/") and p != base)},
    }


# ---------------------------------------------------------------- write
async def write_plan(plan: dict[str, Any], owner_email: str, member_email: str | None, replace: bool) -> dict[str, Any]:
    emails = [e for e in (owner_email, member_email) if e]
    existing = await User.find({"email": {"$in": emails}}).to_list()
    if existing:
        if not replace:
            raise SystemExit(f"users already exist for {[u.email for u in existing]}; rerun with --replace")
        for hid in {u.household_id for u in existing}:
            for model in (Account, Budget, Category, Goal, Transaction):
                await model.find({"household_id": hid}).delete()
            for model in [m for m in document_models if m.__name__ in ("Debt", "Plan", "Invite", "Session")]:
                await model.find({"household_id": hid}).delete()
            await User.find({"household_id": hid}).delete()
            await Household.find({"_id": hid}).delete()

    owner_id = PydanticObjectId()
    household = Household(name=f"{plan['owner']['name'].split()[0]}'s household", owner_id=owner_id)
    await household.insert()
    hid: PydanticObjectId = household.id  # type: ignore[assignment]
    passwords: dict[str, str] = {}
    users = {"owner": owner_id}
    pw = secrets.token_urlsafe(12)
    passwords[owner_email] = pw
    await User(id=owner_id, household_id=hid, email=owner_email.lower(), name=plan["owner"]["name"],
               password_hash=hash_password(pw), role="owner").insert()
    if plan["member"] and member_email:
        pw = secrets.token_urlsafe(12)
        passwords[member_email] = pw
        member = User(household_id=hid, email=member_email.lower(), name=plan["member"]["name"],
                      password_hash=hash_password(pw), role="member")
        await member.insert()
        users["member"] = member.id  # type: ignore[assignment]
    else:
        users["member"] = owner_id

    names = [c[0] for c in DEFAULT_CATEGORIES] + [c[0] for c in EXTRA_CATEGORIES]
    cats = [Category(household_id=hid, name=n, kind=k, group=g, icon=i)  # type: ignore[arg-type]
            for n, k, g, i in [*DEFAULT_CATEGORIES, *EXTRA_CATEGORIES]]
    await Category.insert_many(cats)
    cat_ids = {c.name: c.id for c in await Category.find({"household_id": hid}).to_list()}
    assert set(names) <= set(cat_ids)

    acc_ids: dict[str, PydanticObjectId] = {}
    for key, a in plan["accounts"].items():
        doc = Account(household_id=hid, name=a["name"], institution=a["institution"], type=a["type"],
                      archived=a["archived"])
        await doc.insert()
        acc_ids[key] = doc.id  # type: ignore[assignment]

    docs = [Transaction(
        household_id=hid, account_id=acc_ids[t["account"]], date=t["date"], amount_fils=t["amount_fils"],
        type=t["type"], category_id=cat_ids[t["category"]] if t["category"] else None,
        to_account_id=acc_ids[t["to"]] if t["to"] else None, merchant=t["merchant"], note=t["note"],
        created_by=users[t["by"]], source="import",
    ) for t in plan["transactions"]]
    for i in range(0, len(docs), 500):
        await Transaction.insert_many(docs[i:i + 500])

    for month, lines in sorted(plan["budgets"].items()):
        await Budget(household_id=hid, month=month, note="Imported from the old app",
                     lines=[BudgetLine(category_id=cat_ids[c], limit_fils=v) for c, v in lines.items()]).insert()
    if plan["goal"]:
        await Goal(household_id=hid, priority=1, **plan["goal"]).insert()
    return {"household_id": str(hid), "passwords": passwords}


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("export", type=Path)
    parser.add_argument("--owner-email", required=True)
    parser.add_argument("--member-email")
    parser.add_argument("--target", choices=("development", "production"), default="development")
    parser.add_argument("--confirm-production", action="store_true")
    parser.add_argument("--replace", action="store_true", help="delete these users' existing household first")
    parser.add_argument("--dry-run", action="store_true", help="map and print stats; write nothing")
    args = parser.parse_args()

    export = json.loads(args.export.read_text())
    has_cad = any(v["_fields"].get("currency") == "CAD" for p, v in export.items() if "/receipts/" in p)
    fx = None
    if has_cad:
        dates = [_date(v["_fields"]["date"]) for p, v in export.items() if "/receipts/" in p]
        fx = CadToAed.fetch(min(dates), max(dates))
    plan = build_plan(export, fx)
    print(json.dumps(plan["stats"], indent=1, default=str))
    print("accounts:", [a["name"] + (" [archived]" if a["archived"] else "") for a in plan["accounts"].values()])
    print("budget months:", sorted(plan["budgets"]), "| goal:", plan["goal"])
    if args.dry_run:
        return
    if args.target == "production" and not args.confirm_production:
        raise SystemExit("--target production also needs --confirm-production")

    from dotenv import dotenv_values
    from motor.motor_asyncio import AsyncIOMotorClient

    uri = dotenv_values(Path(__file__).resolve().parents[1] / ".env").get("MONGODB_URI") or ""
    if not uri.startswith("mongodb"):
        raise SystemExit("MONGODB_URI (Atlas) missing from .env")
    client = AsyncIOMotorClient(uri, uuidRepresentation="standard")
    await init_beanie(database=client[args.target], document_models=document_models)
    result = await write_plan(plan, args.owner_email, args.member_email, args.replace)
    print(f"Imported into '{args.target}', household {result['household_id']}.")
    for email, pw in result["passwords"].items():
        print(f"Login {email} / temporary password (shown once): {pw}")


if __name__ == "__main__":
    asyncio.run(main())
