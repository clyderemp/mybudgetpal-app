"""Recurring bills and expected income (pure: no DB, no I/O, no clock).

Inputs are plain dicts (snake_case, like the rest of ``app.analytics``):

bill   {id, name, kind, amount_fils, amount_mode "fixed"|"estimate", cadence "monthly"|"quarterly"|"yearly",
        due_day_from, due_day_to, account_id?, category_id?, match_text: [str], amount_tolerance_pct,
        ignored_transaction_ids: [str], start_month, end_month?, instalments_total?, instalments_paid, purpose, active, skipped_months: [str]}
stream {id, name, member_id?, account_id?, active, parts: [{id, label, kind, amount_fils, amount_min_fils?,
        amount_max_fils?, day_from, day_to, match_text: [str]}]}
txn    {id, date, amount_fils, type, account_id, to_account_id?, merchant?, note?, bill_id?}

Rules (docs/spec.md "Bills and expected income"):

* A bill is due in a month when the month is within [start_month, last month] and a whole number of
  cadence periods after ``start_month``. Instalment plans (``instalments_total``) end after the remaining
  ``instalments_total - instalments_paid`` instalments, counted from ``start_month``.
* Matching, per month, one transaction to at most one bill or income part:
  1. Transactions linked by ``bill_id`` belong to that bill, in the month whose payment window holds the
     date. The window of month M runs from 10 days before the due date in M to the day before the window
     of the next due month, so windows never overlap and an early payment counts for the month it pays.
  2. Otherwise rules: the merchant or note contains one of ``match_text`` (default: the bill name),
     an expense/transfer out for bills, income (or a transfer into the stream's account) for income, the date
     in the window, and the amount within tolerance ("high") or within 50% ("medium", flagged as a price
     change). Paid from a different account than the bill's demotes "high" to "medium". Candidates are
     assigned greedily, best first (confidence, then amount closeness, then date closeness).
* ``estimate`` bills expect the average of the last 3 payments (from the previous 3 months); with none yet,
  ``amount_fils``.
"""

from __future__ import annotations

import calendar
import datetime as dt
import re
from collections import Counter, defaultdict
from statistics import median
from typing import Any

from app.analytics._common import add_months, get, parse_month, round_half_up

CADENCE_MONTHS = {"monthly": 1, "quarterly": 3, "yearly": 12}
EARLY_DAYS = 10  # a payment up to this many days before the due date counts for that month
INCOME_SLACK_DAYS = 3  # income may land this many days either side of its usual range
DUE_SOON_DAYS = 3
PRICE_CHANGE_BAND = 0.5  # a text match within +/-50% is still the bill, flagged as a price change
ESTIMATE_HISTORY = 3
STALE_DAYS = 45  # a suggestion needs a payment this recent
COMMITMENT_KINDS = ("bill", "subscription", "loan", "bnpl", "debt_payment", "other")

CONF_RANK = {"linked": 3, "high": 2, "medium": 1}


# ---------------------------------------------------------------- calendar helpers


def month_index(month: str) -> int:
    y, m = parse_month(month)
    return y * 12 + (m - 1)


def months_between(a: str, b: str) -> int:
    """b - a in months."""
    return month_index(b) - month_index(a)


def day_in_month(month: str, day: int) -> dt.date:
    """Day ``day`` of ``month``, clamped to the month's last day (31 -> 30 Nov, 28/29 Feb)."""
    y, m = parse_month(month)
    return dt.date(y, m, min(max(1, day), calendar.monthrange(y, m)[1]))


def month_end(month: str) -> dt.date:
    y, m = parse_month(month)
    return dt.date(y, m, calendar.monthrange(y, m)[1])


# ---------------------------------------------------------------- bill schedule


def cadence_months(bill: Any) -> int:
    return CADENCE_MONTHS.get(str(get(bill, "cadence") or "monthly"), 1)


def last_month(bill: Any) -> str | None:
    """Last month the bill is due: from the instalment count when set, else ``end_month`` (None = open)."""
    total = get(bill, "instalments_total")
    if total:
        remaining = max(0, int(total) - int(get(bill, "instalments_paid") or 0))
        return add_months(get(bill, "start_month"), (remaining - 1) * cadence_months(bill))
    return get(bill, "end_month")


def is_due_in(bill: Any, month: str) -> bool:
    start = get(bill, "start_month")
    if months_between(start, month) < 0:
        return False
    last = last_month(bill)
    if last is not None and months_between(last, month) > 0:
        return False
    return months_between(start, month) % cadence_months(bill) == 0


def is_running_in(bill: Any, month: str) -> bool:
    """Between start and last month (inclusive), whether or not a payment falls in this month."""
    if months_between(get(bill, "start_month"), month) < 0:
        return False
    last = last_month(bill)
    return last is None or months_between(last, month) <= 0


def instalment_number(bill: Any, month: str) -> int | None:
    if not get(bill, "instalments_total"):
        return None
    return int(get(bill, "instalments_paid") or 0) + months_between(get(bill, "start_month"), month) // cadence_months(bill) + 1


def is_completed(bill: Any, month: str) -> bool:
    last = last_month(bill)
    return last is not None and months_between(last, month) > 0


def monthly_share(bill: Any, amount_fils: int | None = None) -> int:
    """What to set aside each month: the amount spread over its cadence (yearly 1,200 -> 100/month)."""
    amount = int(get(bill, "amount_fils") if amount_fils is None else amount_fils)
    return round_half_up(amount / cadence_months(bill))


def bill_window(bill: Any, month: str) -> tuple[dt.date, dt.date]:
    """Payment window of the bill's occurrence in ``month`` (see module docstring)."""
    due = day_in_month(month, int(get(bill, "due_day_from")))
    nxt = day_in_month(add_months(month, cadence_months(bill)), int(get(bill, "due_day_from")))
    return due - dt.timedelta(days=EARLY_DAYS), nxt - dt.timedelta(days=EARLY_DAYS + 1)


def due_range(month: str, day_from: int, day_to: int) -> tuple[dt.date, dt.date]:
    return day_in_month(month, day_from), day_in_month(month, max(day_from, day_to))


# ---------------------------------------------------------------- text matching


def normalise(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def patterns_for(item: Any) -> list[str]:
    pats = [normalise(p) for p in (get(item, "match_text") or []) if normalise(p)]
    return pats


def text_matches(patterns: list[str], txn: Any) -> bool:
    hay = f"{normalise(get(txn, 'merchant'))} {normalise(get(txn, 'note'))}"
    return any(p in hay for p in patterns)


def _date(t: Any) -> dt.date:
    d = get(t, "date")
    return d if isinstance(d, dt.date) else dt.date.fromisoformat(str(d)[:10])


# ---------------------------------------------------------------- matching


def _amount_conf(amount: int, expected: int, tol_pct: float) -> tuple[str | None, float]:
    if expected <= 0:
        return "high", 0.0
    diff = abs(amount - expected) / expected
    if diff <= tol_pct / 100:
        return "high", diff
    if diff <= PRICE_CHANGE_BAND:
        return "medium", diff
    return None, diff


def _income_conf(amount: int, part: Any) -> tuple[str | None, float]:
    expected = int(get(part, "amount_fils"))
    lo = get(part, "amount_min_fils")
    hi = get(part, "amount_max_fils")
    lo = int(lo) if lo is not None else round_half_up(expected * 0.9)
    hi = int(hi) if hi is not None else round_half_up(expected * 1.1)
    diff = abs(amount - expected) / expected if expected else 0.0
    if lo <= amount <= hi:
        return "high", diff
    if expected and diff <= PRICE_CHANGE_BAND:
        return "medium", diff
    return None, diff


def _is_bill_txn(t: Any) -> bool:
    return get(t, "type") in ("expense", "transfer")


def _is_income_txn(t: Any, account_id: str | None) -> bool:
    if get(t, "type") == "income":
        return True
    return get(t, "type") == "transfer" and account_id is not None and get(t, "to_account_id") == account_id


def match_month(
    bills: list[Any],
    streams: list[Any],
    txns: list[Any],
    month: str,
    expected: dict[str, int] | None = None,
) -> tuple[dict[str, list[dict[str, Any]]], dict[tuple[str, str], list[dict[str, Any]]]]:
    """Match the month's transactions to bills due in ``month`` and to income parts (one-to-one).

    Returns ({bill_id: [match]}, {(stream_id, part_id): [match]}); match = {txn, confidence, diff}.
    """
    expected = expected or {}
    used: set[str] = set()
    bill_matches: dict[str, list[dict[str, Any]]] = defaultdict(list)
    part_matches: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    due_bills = [b for b in bills if get(b, "active", True) and is_due_in(b, month)]
    bill_ids = {str(get(b, "id")) for b in bills}

    # 1. Explicit links.
    for b in due_bills:
        lo, hi = bill_window(b, month)
        for t in txns:
            if get(t, "bill_id") == str(get(b, "id")) and lo <= _date(t) <= hi:
                bill_matches[str(get(b, "id"))].append({"txn": t, "confidence": "linked", "diff": 0.0})
                used.add(str(get(t, "id")))

    # 2. Rules: collect every candidate pair, then assign best-first.
    candidates: list[tuple[tuple[int, float, int], str, Any, str, Any, float]] = []
    for b in due_bills:
        bid = str(get(b, "id"))
        if bill_matches.get(bid):
            continue
        pats = patterns_for(b) or [normalise(get(b, "name"))]
        lo, hi = bill_window(b, month)
        due_from, _ = due_range(month, int(get(b, "due_day_from")), int(get(b, "due_day_to")))
        exp = int(expected.get(bid, get(b, "amount_fils")))
        tol = float(get(b, "amount_tolerance_pct") or 0)
        ignored = {str(i) for i in get(b, "ignored_transaction_ids") or []}
        for t in txns:
            if str(get(t, "id")) in ignored:
                continue
            linked_elsewhere = get(t, "bill_id") is not None and get(t, "bill_id") in bill_ids
            if linked_elsewhere or not _is_bill_txn(t) or not lo <= _date(t) <= hi or not text_matches(pats, t):
                continue
            conf, diff = _amount_conf(int(get(t, "amount_fils")), exp, tol)
            if conf is None:
                continue
            if conf == "high" and get(b, "account_id") and get(t, "account_id") != get(b, "account_id"):
                conf = "medium"
            days = abs((_date(t) - due_from).days)
            candidates.append(((CONF_RANK[conf], -diff, -days), "bill", b, conf, t, diff))

    for s in streams:
        if not get(s, "active", True):
            continue
        for p in get(s, "parts") or []:
            pats = patterns_for(p)
            lo, hi = due_range(month, int(get(p, "day_from")), int(get(p, "day_to")))
            lo, hi = lo - dt.timedelta(days=INCOME_SLACK_DAYS), hi + dt.timedelta(days=INCOME_SLACK_DAYS)
            acc = get(s, "account_id")
            for t in txns:
                if not _is_income_txn(t, acc) or not lo <= _date(t) <= hi:
                    continue
                if pats and not text_matches(pats, t):
                    continue
                if acc and get(t, "type") == "income" and get(t, "account_id") != acc and not pats:
                    continue  # no text rule: only income into the stream's account counts
                conf, diff = _income_conf(int(get(t, "amount_fils")), p)
                if conf is None:
                    continue
                mid = lo + (hi - lo) / 2
                days = abs((_date(t) - mid).days)
                candidates.append(((CONF_RANK[conf], -diff, -days), "part", (s, p), conf, t, diff))

    candidates.sort(key=lambda c: c[0], reverse=True)
    filled_bills: set[str] = set()
    filled_parts: set[tuple[str, str]] = set()
    for _score, what, item, conf, t, diff in candidates:
        tid = str(get(t, "id"))
        if tid in used:
            continue
        if what == "bill":
            key = str(get(item, "id"))
            if key in filled_bills:
                continue
            filled_bills.add(key)
            bill_matches[key].append({"txn": t, "confidence": conf, "diff": diff})
        else:
            s, p = item
            pkey = (str(get(s, "id")), str(get(p, "id")))
            if pkey in filled_parts:
                continue
            filled_parts.add(pkey)
            part_matches[pkey].append({"txn": t, "confidence": conf, "diff": diff})
        used.add(tid)
    return dict(bill_matches), dict(part_matches)


# ---------------------------------------------------------------- month report


def _status(paid: bool, skipped: bool, due_from: dt.date, due_to: dt.date, today: dt.date) -> str:
    if paid:
        return "paid"
    if skipped:
        return "skipped"
    if today > due_to:
        return "overdue"
    if today >= due_from - dt.timedelta(days=DUE_SOON_DAYS):
        return "due_soon"
    return "upcoming"


def _match_out(m: dict[str, Any]) -> dict[str, Any]:
    t = m["txn"]
    return {
        "transactionId": str(get(t, "id")),
        "date": _date(t).isoformat(),
        "amountFils": int(get(t, "amount_fils")),
        "merchant": get(t, "merchant"),
        "accountId": get(t, "account_id"),
        "confidence": m["confidence"],
    }


def expected_amounts(bills: list[Any], streams: list[Any], txns: list[Any], month: str) -> tuple[dict[str, int], list[tuple[str, str]]]:
    """Expected amount per bill for ``month`` (estimate bills: average of the last 3 payments in the
    previous 3 months) and the high-confidence (txn_id, bill_id) links found in those months."""
    history: dict[str, list[tuple[dt.date, int]]] = defaultdict(list)
    links: list[tuple[str, str]] = []
    for k in range(ESTIMATE_HISTORY, 0, -1):
        prev = add_months(month, -k)
        bm, _ = match_month(bills, streams, txns, prev)
        for bid, ms in bm.items():
            history[bid].append((max(_date(m["txn"]) for m in ms), sum(int(get(m["txn"], "amount_fils")) for m in ms)))
            links += [(str(get(m["txn"], "id")), bid) for m in ms if m["confidence"] == "high"]
    out: dict[str, int] = {}
    for b in bills:
        bid = str(get(b, "id"))
        paid = [amt for _, amt in sorted(history.get(bid, []))][-ESTIMATE_HISTORY:]
        if get(b, "amount_mode") == "estimate" and paid:
            out[bid] = round_half_up(sum(paid) / len(paid))
        else:
            out[bid] = int(get(b, "amount_fils"))
    return out, links


def month_report(bills: list[Any], streams: list[Any], txns: list[Any], month: str, today: dt.date) -> dict[str, Any]:
    """Checklist for ``month``: every bill due that month and every expected income part with its status.

    ``txns`` should cover from 3 months before ``month`` (estimates) to the end of the next month.
    Statuses: bills paid|skipped|overdue|due_soon|upcoming; income received|overdue|due_soon|upcoming.
    ``links`` lists high-confidence (transactionId, billId) rule matches the caller may persist.
    """
    expected, links = expected_amounts(bills, streams, txns, month)
    bm, pm = match_month(bills, streams, txns, month, expected)
    items: list[dict[str, Any]] = []
    for b in bills:
        if not get(b, "active", True) or not is_due_in(b, month):
            continue
        bid = str(get(b, "id"))
        due_from, due_to = due_range(month, int(get(b, "due_day_from")), int(get(b, "due_day_to")))
        ms = sorted(bm.get(bid, []), key=lambda m: _date(m["txn"]))
        paid_fils = sum(int(get(m["txn"], "amount_fils")) for m in ms)
        exp = expected[bid]
        tol = float(get(b, "amount_tolerance_pct") or 0) / 100
        fixed = (get(b, "amount_mode") or "fixed") == "fixed"
        price_changed = fixed and bool(ms) and exp > 0 and abs(paid_fils - exp) / exp > tol
        skipped = month in (get(b, "skipped_months") or [])
        links += [(str(get(m["txn"], "id")), bid) for m in ms if m["confidence"] == "high"]
        items.append(
            {
                "billId": bid,
                "name": get(b, "name"),
                "kind": get(b, "kind"),
                "purpose": get(b, "purpose") or "household",
                "cadence": get(b, "cadence") or "monthly",
                "accountId": get(b, "account_id"),
                "categoryId": get(b, "category_id"),
                "amountMode": get(b, "amount_mode") or "fixed",
                "dueFrom": due_from.isoformat(),
                "dueTo": due_to.isoformat(),
                "expectedFils": exp,
                "paidFils": paid_fils,
                "differenceFils": paid_fils - exp if ms else 0,
                "status": _status(bool(ms), skipped, due_from, due_to, today),
                "priceChanged": price_changed,
                "needsConfirmation": any(m["confidence"] == "medium" for m in ms),
                "instalmentNumber": instalment_number(b, month),
                "instalmentsTotal": get(b, "instalments_total"),
                "matches": [_match_out(m) for m in ms],
            }
        )
    items.sort(key=lambda i: (i["dueFrom"], i["name"].lower()))

    income: list[dict[str, Any]] = []
    for s in streams:
        if not get(s, "active", True):
            continue
        for p in get(s, "parts") or []:
            key = (str(get(s, "id")), str(get(p, "id")))
            due_from, due_to = due_range(month, int(get(p, "day_from")), int(get(p, "day_to")))
            ms = sorted(pm.get(key, []), key=lambda m: _date(m["txn"]))
            got = sum(int(get(m["txn"], "amount_fils")) for m in ms)
            status = _status(bool(ms), False, due_from, due_to + dt.timedelta(days=INCOME_SLACK_DAYS), today)
            income.append(
                {
                    "streamId": key[0],
                    "partId": key[1],
                    "streamName": get(s, "name"),
                    "memberId": get(s, "member_id"),
                    "label": get(p, "label"),
                    "kind": get(p, "kind"),
                    "accountId": get(s, "account_id"),
                    "dueFrom": due_from.isoformat(),
                    "dueTo": due_to.isoformat(),
                    "expectedFils": int(get(p, "amount_fils")),
                    "minFils": get(p, "amount_min_fils"),
                    "maxFils": get(p, "amount_max_fils"),
                    "receivedFils": got,
                    "status": "received" if ms else status,
                    "needsConfirmation": any(m["confidence"] == "medium" for m in ms),
                    "matches": [_match_out(m) for m in ms],
                }
            )
    income.sort(key=lambda i: (i["dueFrom"], i["streamName"].lower()))

    household = [i for i in items if i["purpose"] == "household" and i["status"] != "skipped"]
    totals = {
        "billsExpectedFils": sum(i["expectedFils"] for i in household),
        "billsPaidFils": sum(i["paidFils"] for i in household),
        "billsRemainingFils": sum(i["expectedFils"] for i in household if i["status"] != "paid"),
        "billsCount": len(household),
        "billsPaidCount": sum(1 for i in household if i["status"] == "paid"),
        "incomeExpectedFils": sum(i["expectedFils"] for i in income),
        "incomeReceivedFils": sum(i["receivedFils"] for i in income),
        "incomeWaitingFils": sum(i["expectedFils"] for i in income if i["status"] != "received"),
    }
    return {"month": month, "items": items, "income": income, "totals": totals, "links": sorted(set(links))}


# ---------------------------------------------------------------- safe to spend


def safe_to_spend(
    cash_fils: int,
    bill_items: list[dict[str, Any]],
    income_items: list[dict[str, Any]],
    today: dt.date,
) -> dict[str, Any]:
    """Cash in household bank/cash accounts - bills still due before the next expected salary
    + other income expected before then.

    ``bill_items``/``income_items`` are ``month_report`` items for this month and next. The horizon
    (``until``) is the start of the next salary not yet received (today when it is late); with no salary
    stream it is the end of this month. Bills count when unpaid, not skipped, household, and due to start
    on or before ``until``. Income counts (at its minimum) when not received and due to start before it.
    """
    salaries = sorted(
        (i for i in income_items if i["kind"] == "salary" and i["status"] != "received"),
        key=lambda i: i["dueFrom"],
    )
    salary = salaries[0] if salaries else None
    if salary is not None:
        until = max(today, dt.date.fromisoformat(salary["dueFrom"]))
    else:
        until = month_end(f"{today.year:04d}-{today.month:02d}")
    bills = [
        i
        for i in bill_items
        if i["status"] not in ("paid", "skipped")
        and i.get("purpose", "household") == "household"
        and dt.date.fromisoformat(i["dueFrom"]) <= until
    ]
    income = [
        i
        for i in income_items
        if i["status"] != "received"
        and i is not salary
        and dt.date.fromisoformat(i["dueFrom"]) < until
    ]

    def income_amount(i: dict[str, Any]) -> int:
        return int(i["minFils"]) if i.get("minFils") is not None else int(i["expectedFils"])

    bills_fils = sum(max(0, i["expectedFils"] - i.get("paidFils", 0)) for i in bills)
    income_fils = sum(income_amount(i) for i in income)
    return {
        "cashFils": cash_fils,
        "billsDueFils": bills_fils,
        "incomeExpectedFils": income_fils,
        "safeToSpendFils": cash_fils - bills_fils + income_fils,
        "until": until.isoformat(),
        "nextSalary": (
            {"streamName": salary["streamName"], "label": salary["label"], "dueFrom": salary["dueFrom"], "dueTo": salary["dueTo"]}
            if salary
            else None
        ),
        "bills": [{"billId": i["billId"], "name": i["name"], "dueFrom": i["dueFrom"], "amountFils": max(0, i["expectedFils"] - i.get("paidFils", 0))} for i in bills],
        "income": [{"streamName": i["streamName"], "label": i["label"], "dueFrom": i["dueFrom"], "amountFils": income_amount(i)} for i in income],
    }


# ---------------------------------------------------------------- zero-based plan


def zero_based_plan(
    bills: list[Any],
    streams: list[Any],
    month: str,
    flexible_fils: int,
    expected: dict[str, int] | None = None,
    budget_category_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Give every dirham a job: expected income - commitments - sinking funds and savings - flexible
    category limits = left to assign (goal: 0).

    * commitments: household monthly bills due this month (not skipped), every kind except ``savings``;
    * sinking funds: household quarterly/yearly bills running this month, at their monthly share;
    * savings: household monthly bills of kind ``savings``;
    * flexible: the month's category budget limits.
    ``overlapCategoryIds``: categories that have a budget limit AND bills (likely counted twice).
    """
    expected = expected or {}
    income = sum(int(get(p, "amount_fils")) for s in streams if get(s, "active", True) for p in get(s, "parts") or [])
    by_kind: Counter[str] = Counter()
    sinking: list[dict[str, Any]] = []
    bill_cats: set[str] = set()
    for b in bills:
        if not get(b, "active", True) or (get(b, "purpose") or "household") != "household":
            continue
        amount = int(expected.get(str(get(b, "id")), get(b, "amount_fils")))
        if cadence_months(b) == 1:
            if not is_due_in(b, month) or month in (get(b, "skipped_months") or []):
                continue
            by_kind[str(get(b, "kind"))] += amount
        else:
            if not is_running_in(b, month):
                continue
            share = monthly_share(b, amount)
            sinking.append({"billId": str(get(b, "id")), "name": get(b, "name"), "monthlyFils": share, "amountFils": amount,
                            "cadence": get(b, "cadence"), "dueThisMonth": is_due_in(b, month)})
        if get(b, "category_id"):
            bill_cats.add(str(get(b, "category_id")))
    commitments = sum(v for k, v in by_kind.items() if k != "savings")
    savings = by_kind.get("savings", 0)
    sinking_total = sum(s["monthlyFils"] for s in sinking)
    left = income - commitments - sinking_total - savings - flexible_fils
    return {
        "month": month,
        "expectedIncomeFils": income,
        "commitmentsFils": commitments,
        "commitmentsByKind": [{"kind": k, "amountFils": v} for k, v in sorted(by_kind.items()) if k != "savings"],
        "sinkingFundsFils": sinking_total,
        "sinkingFunds": sorted(sinking, key=lambda s: s["name"].lower()),
        "savingsFils": savings,
        "flexibleFils": flexible_fils,
        "leftToAssignFils": left,
        "committedShare": round((commitments + sinking_total) / income, 4) if income > 0 else None,
        "overlapCategoryIds": sorted(bill_cats & set(budget_category_ids or [])),
    }


# ---------------------------------------------------------------- recurring suggestions

_KIND_WORDS: list[tuple[str, tuple[str, ...]]] = [
    ("bnpl", ("tabby", "tamara", "postpay", "cashew", "spotii")),
    ("subscription", ("spotify", "netflix", "openai", "chatgpt", "apple.com", "icloud", "youtube", "google", "anthropic",
                      "claude", "osn", "shahid", "disney", "adobe", "microsoft", "amazon prime", "anghami", "starzplay")),
    ("loan", ("loan", "zero max", "finance", "instalment", "installment", "emi")),
    ("bill", ("dewa", "sewa", "addc", "fewa", "etisalat", "e&", "du ", "empower", "emicool", "salik", "insurance", "rent")),
    ("debt_payment", ("wise", "remit", "western union", "transfer abroad", "international")),
]


def merchant_key(merchant: str | None) -> str:
    """Stable key for a merchant string: lowercase words, tokens with digits dropped, first 3 words."""
    words = [w for w in re.split(r"[^a-z0-9&.]+", (merchant or "").lower()) if w and not re.search(r"\d", w)]
    return " ".join(words[:3]).strip(" .")


def guess_kind(text: str) -> str:
    hay = f" {text.lower()} "
    for kind, words in _KIND_WORDS:
        if any(w in hay for w in words):
            return kind
    return "other"


def _clusters(rows: list[Any]) -> list[list[Any]]:
    """Group transactions by similar amount (within 15% of the cluster's smallest)."""
    out: list[list[Any]] = []
    for t in sorted(rows, key=lambda r: int(get(r, "amount_fils"))):
        if out and int(get(t, "amount_fils")) <= int(get(out[-1][0], "amount_fils")) * 1.15:
            out[-1].append(t)
        else:
            out.append([t])
    return out


def detect_recurring(txns: list[Any], bills: list[Any], today: dt.date, months: int = 6) -> list[dict[str, Any]]:
    """Recurring expense candidates from the last ``months`` months: the same merchant roughly monthly
    (seen in >= 2 distinct months, at most ~1.5 times a month, median gap 20-40 days when >= 3 times)
    at a similar amount, last paid within 45 days. Skips transactions already linked to a bill and merchants an active bill already
    matches. Sorted by confidence, then amount."""
    since = add_months(f"{today.year:04d}-{today.month:02d}", -months)
    start = day_in_month(since, 1)
    existing = [patterns_for(b) or [normalise(get(b, "name"))] for b in bills if get(b, "active", True)]
    groups: dict[str, list[Any]] = defaultdict(list)
    for t in txns:
        if get(t, "type") not in ("expense", "transfer") or get(t, "bill_id"):
            continue
        if not start <= _date(t) <= today:
            continue
        key = merchant_key(get(t, "merchant"))
        if len(key) < 3:
            continue
        if any(text_matches(p, t) for p in existing):
            continue
        groups[key].append(t)

    out: list[dict[str, Any]] = []
    for key, rows in groups.items():
        clusters = [c for c in _clusters(rows) if len({_date(t).strftime("%Y-%m") for t in c}) >= 2]
        for c in clusters:
            c.sort(key=_date)
            month_set = {_date(t).strftime("%Y-%m") for t in c}
            if len(c) / len(month_set) > 1.5:
                continue
            gaps = [(_date(b) - _date(a)).days for a, b in zip(c, c[1:])]
            if len(c) >= 3 and not 20 <= median(gaps) <= 40:
                continue
            if len(c) == 2 and not 20 <= gaps[0] <= 40:
                continue
            if (today - _date(c[-1])).days > STALE_DAYS:
                continue  # stopped: nothing in the last ~6 weeks
            amounts = [int(get(t, "amount_fils")) for t in c]
            mid = int(median(amounts))
            spread = (max(amounts) - min(amounts)) / mid if mid else 0
            days = sorted(_date(t).day for t in c)
            lo, hi = days[0], days[-1]
            if hi - lo > 10:
                d = int(median(days))
                lo, hi = max(1, d - 3), min(31, d + 3)
            names = Counter((get(t, "merchant") or "").strip() for t in c)
            name = names.most_common(1)[0][0] or key.title()
            if name.isupper():
                name = name.title()
            accounts = Counter(get(t, "account_id") for t in c)
            cats = Counter(get(t, "category_id") for t in c if get(t, "category_id"))
            if len(clusters) > 1:
                name = f"{name} ({mid / 100:,.2f})"
            kind = guess_kind(f"{key} {name}")
            confidence = "high" if len(month_set) >= 3 and spread <= 0.05 else "medium"
            out.append(
                {
                    "key": f"{key}|{mid}",
                    "name": name[:100],
                    "kind": kind,
                    "amountFils": int(get(c[-1], "amount_fils")) if spread <= 0.02 else mid,
                    "amountMode": "fixed" if spread <= 0.02 else "estimate",
                    "dueDayFrom": lo,
                    "dueDayTo": hi,
                    "accountId": accounts.most_common(1)[0][0],
                    "categoryId": cats.most_common(1)[0][0] if cats else None,
                    "matchText": [key],
                    "occurrences": len(c),
                    "months": len(month_set),
                    "lastDate": _date(c[-1]).isoformat(),
                    "lastAmountFils": int(get(c[-1], "amount_fils")),
                    "confidence": confidence,
                    "transactionIds": [str(get(t, "id")) for t in c],
                }
            )
    out.sort(key=lambda s: (s["confidence"] != "high", -s["amountFils"]))
    return out
