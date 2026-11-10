"""One-off import of a reviewed statement preview CSV (the Nov 2026 clean-up) into one household.

The CSV and a JSON config live OUTSIDE the repo (they hold personal financial data); this script holds
no names, account numbers or amounts. What was reviewed is what gets imported.

Usage (from fastapi-backend/):
    .venv/bin/python scripts/import_statements.py --config CONFIG.json --household <id> --batch stmt-2026-11 \
        [--csv clean_preview.csv] [--pdf-dir DIR] [--target development|production] [--dry-run] \
        [--confirm-production] [--rollback]

CSV columns: date, account, type (income|expense|transfer), amount_aed, to_account, category, merchant, note,
member, row_id ("<file>#<last4>#<row index>"), needs_review, review_reason (others are ignored).

CONFIG.json:
    {"accounts": {"<account name in the CSV>": {"last4": "1234", "target": "1543.13",
                                               "create": {"type": "bank", "institution": "...", "purpose": "business"}}},
     "new_categories": {"<name>": ["income|expense", "<group>", "<icon>"]},
     "members": {"<member value in the CSV>": "<username>"},   # anything else -> household owner
     "date_range": ["2026-07-01", "2026-11-10"]}
Accounts without "create" must already exist (matched by name). "target" = the balance the account must
show after the import: its opening balance is set to target − (sum of all its transactions) ("plug").

Rows are keyed like the app's statement import (``source_ref`` = bank:last4:date:direction+amount:ref), computed
by re-parsing the original PDFs in --pdf-dir, so uploading the same statements in the app later finds them as
already recorded. Rows without a PDF row (inferred) get ``stmt:<batch>:<row_id>``. Re-running skips rows whose
source_ref already exists. A manifest (import-<batch>.json, chmod 600) next to the CSV records what was created
and the previous opening balances; --rollback soft-deletes the batch (freeing its source_refs), restores
opening balances/last4 and archives created accounts/categories that nothing else uses.

Writes go to ``development`` by default; ``--target production`` additionally needs ``--confirm-production``.
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import datetime as dt
import json
import os
import re
import sys
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from beanie import PydanticObjectId, init_beanie  # noqa: E402

from app.db import document_models  # noqa: E402
from app.models import Account, Category, Household, Transaction, User, utcnow  # noqa: E402
from app.services.balances import transaction_deltas  # noqa: E402

DEFAULT_DIR = Path.home() / ".mybudgetpal-legacy-secrets" / "statements-2026-11"
TYPES = ("income", "expense", "transfer")


def fils(text: str) -> int:
    return int((Decimal(text.replace(",", "")) * 100).to_integral_value())


def aed(f: int) -> str:
    return f"{f / 100:,.2f}"


def short(stem: str) -> str:
    return re.sub(r"_\d{13}$", "", stem)


# ------------------------------------------------------------------ inputs
def load_rows(path: Path) -> list[dict[str, Any]]:
    rows = []
    with path.open(newline="") as fh:
        for i, r in enumerate(csv.DictReader(fh), start=2):
            r["_line"] = i
            rows.append(r)
    return rows


def pdf_source_refs(pdf_dir: Path | None) -> dict[str, str]:
    """row_id ('<file>#<last4>#<idx>') -> the source_ref the app's statement import gives that row."""
    if pdf_dir is None or not pdf_dir.is_dir():
        return {}
    from app.models.imports import StatementImport
    from app.services.imports import build_import
    from app.services.statements import parse_statement_in_process
    from app.services.statements.matching import assign_source_refs

    out: dict[str, str] = {}
    dummy = PydanticObjectId()
    for pdf in sorted(pdf_dir.iterdir()):
        if pdf.suffix.lower() != ".pdf":
            continue
        data = pdf.read_bytes()
        parsed = parse_statement_in_process(data, pdf.name)
        imp: StatementImport = build_import(parsed, data, pdf.name, dummy, dummy)
        assign_source_refs(imp)
        secs = {s.index: s for s in imp.sections}
        for r in imp.rows:
            idx = int(r.id.split("-")[1])
            out[f"{short(pdf.stem)}#{secs[r.section_index].last4}#{idx}"] = r.source_ref
    return out


# ------------------------------------------------------------------ plan
async def build_plan(args: argparse.Namespace, cfg: dict, rows: list[dict]) -> dict:
    hid = PydanticObjectId(args.household)
    household = await Household.get(hid)
    if household is None:
        raise SystemExit("household not found in this database")
    accounts = await Account.find({"household_id": hid, "archived": False}).to_list()
    by_name = {a.name: a for a in accounts}
    cats = await Category.find({"household_id": hid, "archived": False}).to_list()
    cat_by = {(c.name, c.kind): c for c in cats}
    users = {u.username: u for u in await User.find({"household_id": hid}).to_list()}

    acfg: dict[str, dict] = cfg.get("accounts", {})
    names = {r["account"] for r in rows} | {r["to_account"] for r in rows if r["to_account"]}
    create, missing = [], []
    for n in sorted(names):
        if n in by_name:
            continue
        spec = acfg.get(n, {}).get("create")
        (create if spec else missing).append(n)
    if missing:
        raise SystemExit(f"accounts not in the household and not marked 'create' in the config: {missing}")
    new_cats = {n: v for n, v in cfg.get("new_categories", {}).items() if (n, v[0]) not in cat_by}

    lo, hi = (dt.date.fromisoformat(x) for x in cfg.get("date_range", ["1900-01-01", "2999-12-31"]))
    refs = pdf_source_refs(Path(args.pdf_dir) if args.pdf_dir else None)
    errors, plan_rows = [], []
    for r in rows:
        line, typ = r["_line"], r["type"]
        try:
            date = dt.date.fromisoformat(r["date"])
            amount = fils(r["amount_aed"])
        except Exception:
            errors.append(f"line {line}: bad date/amount")
            continue
        if typ not in TYPES or amount <= 0 or not (lo <= date <= hi):
            errors.append(f"line {line}: type/amount/date out of range")
            continue
        if typ == "transfer":
            if not r["to_account"] or r["to_account"] == r["account"]:
                errors.append(f"line {line}: transfer needs two different accounts")
                continue
        else:
            known = (r["category"], typ) in cat_by or (r["category"] in new_cats and new_cats[r["category"]][0] == typ)
            if not known:
                errors.append(f"line {line}: category {r['category']!r} is not a(n) {typ} category in the household")
                continue
        ref = refs.get(r["row_id"]) or f"stmt:{args.batch}:{r['row_id']}"
        plan_rows.append({**r, "date_v": date, "fils": amount, "source_ref": ref})
    if errors:
        raise SystemExit("validation failed:\n  " + "\n  ".join(errors[:40]))
    dup = [k for k, n in Counter(p["source_ref"] for p in plan_rows).items() if n > 1]
    if dup:
        raise SystemExit(f"duplicate source_ref in the CSV: {dup[:5]}")
    existing = {t.source_ref for t in await Transaction.find(
        {"household_id": hid, "source_ref": {"$in": [p["source_ref"] for p in plan_rows]}}).to_list()}
    return {"hid": hid, "household": household, "by_name": by_name, "cat_by": cat_by, "users": users,
            "create": create, "new_cats": new_cats, "rows": [p for p in plan_rows if p["source_ref"] not in existing],
            "already": len(plan_rows) - len([p for p in plan_rows if p["source_ref"] not in existing]),
            "pdf_keyed": sum(1 for p in plan_rows if not p["source_ref"].startswith("stmt:"))}


def net_by_account(rows: list[dict]) -> dict[str, int]:
    out: dict[str, int] = defaultdict(int)
    for p in rows:
        if p["type"] == "income":
            out[p["account"]] += p["fils"]
        elif p["type"] == "expense":
            out[p["account"]] -= p["fils"]
        else:
            out[p["account"]] -= p["fils"]
            out[p["to_account"]] += p["fils"]
    return out


async def print_balances(plan: dict, cfg: dict, deltas: dict[str, int], projected: dict[str, int] | None) -> bool:
    ok = True
    print(f"{'account':<46} {'opening':>12} {'computed':>12} {'target':>12}  result")
    for name, spec in cfg.get("accounts", {}).items():
        acc = plan["by_name"].get(name)
        if spec.get("target") is None:
            continue
        target = fils(spec["target"])
        if acc is None:
            print(f"{name[:46]:<46} {'(new)':>12} {aed(projected.get(name, 0)) if projected else '':>12} {aed(target):>12}  plug {aed(target - (projected or {}).get(name, 0))}")
            continue
        computed = acc.opening_balance_fils + deltas.get(str(acc.id), 0) + ((projected or {}).get(name, 0))
        good = computed == target
        ok &= good
        print(f"{name[:46]:<46} {aed(acc.opening_balance_fils):>12} {aed(computed):>12} {aed(target):>12}  "
              f"{'OK' if good else 'plug ' + aed(target - computed)}")
    return ok


# ------------------------------------------------------------------ write / rollback
async def run_import(args: argparse.Namespace, cfg: dict, plan: dict, manifest_path: Path) -> None:
    hid = plan["hid"]
    owner = plan["household"].owner_id
    manifest: dict[str, Any] = {"batch": args.batch, "target": args.target, "household": str(hid),
                                "created_at": utcnow().isoformat(), "created_accounts": [], "created_categories": [],
                                "previous": {}, "inserted": 0}
    if manifest_path.exists():
        old = json.loads(manifest_path.read_text())
        if old.get("status") != "rolled_back":
            manifest = old  # re-run of the same batch: keep the original "previous" values
    acfg = cfg.get("accounts", {})
    for name in plan["create"]:
        spec = acfg[name]
        acc = Account(household_id=hid, name=name, type=spec["create"].get("type", "bank"),
                      institution=spec["create"].get("institution"), currency=spec["create"].get("currency", "AED"),
                      last4=spec.get("last4"), purpose=spec["create"].get("purpose", "household"))
        await acc.insert()
        plan["by_name"][name] = acc
        manifest["created_accounts"].append(str(acc.id))
    for name, spec in acfg.items():  # last4 / purpose on reused accounts so later uploads map automatically
        acc = plan["by_name"].get(name)
        if acc is None or str(acc.id) in manifest["created_accounts"]:
            continue
        manifest["previous"].setdefault(str(acc.id), {"opening_balance_fils": acc.opening_balance_fils,
                                                              "last4": acc.last4, "purpose": acc.purpose})
        changed = False
        if spec.get("last4") and acc.last4 != spec["last4"]:
            acc.last4, changed = spec["last4"], True
        purpose = (spec.get("create") or {}).get("purpose") or spec.get("purpose")
        if purpose and acc.purpose != purpose:
            acc.purpose, changed = purpose, True
        if changed:
            acc.touch()
            await acc.save()
    for name, (kind, group, icon) in plan["new_cats"].items():
        cat = Category(household_id=hid, name=name, kind=kind, group=group, icon=icon)  # type: ignore[arg-type]
        await cat.insert()
        plan["cat_by"][(name, kind)] = cat
        manifest["created_categories"].append(str(cat.id))

    members = cfg.get("members", {})
    docs = []
    for p in plan["rows"]:
        user = plan["users"].get(members.get(p["member"], ""))
        a = plan["by_name"][p["account"]]
        to = plan["by_name"][p["to_account"]] if p["type"] == "transfer" else None
        cat = plan["cat_by"][(p["category"], p["type"])] if p["type"] != "transfer" else None
        review = (p.get("needs_review") or "").lower() == "true"
        docs.append(Transaction(
            household_id=hid, account_id=a.id, date=p["date_v"], amount_fils=p["fils"], type=p["type"],
            category_id=cat.id if cat else None, to_account_id=to.id if to else None,
            merchant=p["merchant"] or None, note=(p["note"] or None), created_by=user.id if user else owner,
            source="import", needs_review=review, review_reason=(p.get("review_reason") or None) if review else None,
            source_ref=p["source_ref"], import_batch=args.batch,
        ))
    from pymongo.errors import BulkWriteError

    inserted = 0
    for i in range(0, len(docs), 500):
        chunk = docs[i:i + 500]
        try:
            res = await Transaction.insert_many(chunk, ordered=False)
            inserted += len(res.inserted_ids)
        except BulkWriteError as exc:
            if any(e.get("code") != 11000 for e in exc.details.get("writeErrors", [])):
                raise
            inserted += exc.details.get("nInserted", 0)
    manifest["inserted"] = manifest.get("inserted", 0) + inserted

    # opening-balance plugs: each targeted account must show its target balance
    deltas = await transaction_deltas(hid)
    for name, spec in acfg.items():
        acc = plan["by_name"].get(name)
        if acc is None or spec.get("target") is None:
            continue
        plug = fils(spec["target"]) - deltas.get(str(acc.id), 0)
        if acc.opening_balance_fils != plug:
            acc.opening_balance_fils = plug
            acc.touch()
            await acc.save()
    manifest["status"] = "imported"
    manifest_path.write_text(json.dumps(manifest, indent=1))
    os.chmod(manifest_path, 0o600)
    print(f"inserted {inserted} transactions (batch {args.batch}); manifest {manifest_path.name}")


async def run_rollback(args: argparse.Namespace, manifest_path: Path) -> None:
    if not manifest_path.exists():
        raise SystemExit(f"no manifest {manifest_path}")
    m = json.loads(manifest_path.read_text())
    if m.get("status") == "rolled_back":
        raise SystemExit("this batch was already rolled back")
    hid = PydanticObjectId(m["household"])
    now = utcnow()
    coll = Transaction.get_motor_collection()
    docs = await coll.find({"household_id": hid, "import_batch": args.batch, "deleted_at": None},
                           {"_id": 1, "source_ref": 1}).to_list(None)
    for d in docs:
        await coll.update_one({"_id": d["_id"]}, {"$set": {"deleted_at": now, "updated_at": now, "source_ref": None,
                                                         "rolled_back_source_ref": d.get("source_ref")}})
    for acc_id, prev in m.get("previous", {}).items():
        acc = await Account.get(PydanticObjectId(acc_id))
        if acc is not None:
            acc.opening_balance_fils, acc.last4, acc.purpose = prev["opening_balance_fils"], prev["last4"], prev["purpose"]
            acc.touch()
            await acc.save()
    for acc_id in m.get("created_accounts", []):
        oid = PydanticObjectId(acc_id)
        used = await Transaction.find({"household_id": hid, "deleted_at": None,
                                       "$or": [{"account_id": oid}, {"to_account_id": oid}]}).count()
        acc = await Account.get(oid)
        if acc is not None and not used:
            acc.archived = True
            acc.touch()
            await acc.save()
    for cat_id in m.get("created_categories", []):
        oid = PydanticObjectId(cat_id)
        cat = await Category.get(oid)
        if cat is not None and not await Transaction.find({"category_id": oid, "deleted_at": None}).count():
            cat.archived = True
            cat.touch()
            await cat.save()
    m["status"] = "rolled_back"
    m["rolled_back_at"] = now.isoformat()
    manifest_path.write_text(json.dumps(m, indent=1))
    print(f"rolled back {len(docs)} transactions of batch {args.batch}; opening balances restored")


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", type=Path, required=True)
    ap.add_argument("--csv", type=Path, default=DEFAULT_DIR / "clean_preview.csv")
    ap.add_argument("--pdf-dir", default=str(DEFAULT_DIR / "pdf"))
    ap.add_argument("--household", required=True, help="household id")
    ap.add_argument("--batch", required=True, help="import_batch label, e.g. stmt-2026-11")
    ap.add_argument("--target", choices=("development", "production"), default="development")
    ap.add_argument("--confirm-production", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="validate and print the plan; write nothing")
    ap.add_argument("--rollback", action="store_true", help="undo --batch using its manifest")
    args = ap.parse_args()
    if not re.fullmatch(r"[\w.-]{1,64}", args.batch):
        raise SystemExit("--batch: letters, digits, '.', '_' and '-' only")
    if args.target == "production" and not args.confirm_production:
        raise SystemExit("--target production also needs --confirm-production")

    from dotenv import dotenv_values
    from motor.motor_asyncio import AsyncIOMotorClient

    uri = dotenv_values(Path(__file__).resolve().parents[1] / ".env").get("MONGODB_URI") or ""
    if not uri.startswith("mongodb"):
        raise SystemExit("MONGODB_URI (Atlas) missing from .env")
    client = AsyncIOMotorClient(uri, uuidRepresentation="standard")
    await init_beanie(database=client[args.target], document_models=document_models)
    print(f"database: {args.target}")
    manifest_path = args.csv.parent / f"import-{args.batch}.json"
    if args.rollback:
        await run_rollback(args, manifest_path)
        return

    cfg = json.loads(args.config.read_text())
    rows = load_rows(args.csv)
    plan = await build_plan(args, cfg, rows)
    print(f"rows in CSV: {len(rows)}; to insert: {len(plan['rows'])}; already present (same source_ref): {plan['already']}; "
          f"keyed from the PDFs: {plan['pdf_keyed']}")
    print("accounts to create:", plan["create"] or "none", "| categories to create:", list(plan["new_cats"]) or "none")
    print("rows per account:", dict(Counter(p["account"] for p in plan["rows"])))
    print("needs review (no name):", sum(1 for p in plan["rows"] if (p.get("needs_review") or "").lower() == "true"))
    deltas = await transaction_deltas(plan["hid"])
    print("\nbefore -> projected (before opening-balance plugs):")
    await print_balances(plan, cfg, deltas, net_by_account(plan["rows"]))
    if args.dry_run:
        print("\ndry run: nothing written")
        return
    await run_import(args, cfg, plan, manifest_path)
    print("\nafter:")
    plan["by_name"] = {a.name: a for a in await Account.find({"household_id": plan["hid"], "archived": False}).to_list()}
    ok = await print_balances(plan, cfg, await transaction_deltas(plan["hid"]), None)
    print("\nall targeted accounts match their target balance" if ok else "\nMISMATCH: see above")


if __name__ == "__main__":
    asyncio.run(main())
