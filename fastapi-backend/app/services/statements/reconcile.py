"""Statement arithmetic checks. Mismatches are reported, never raised."""
from __future__ import annotations

from app.services.statements.types import Reconciliation, StatementSection

MAX_MESSAGES = 12


def _aed(fils: int) -> str:
    sign = "-" if fils < 0 else ""
    return f"{sign}{abs(fils) / 100:,.2f}"


def reconcile(sec: StatementSection) -> Reconciliation:
    rec = Reconciliation()
    msgs = rec.messages
    rows = sec.rows
    net = sec.total_credit_fils - sec.total_debit_fils

    # exactly one of debit/credit per row
    for i, r in enumerate(rows):
        if (r.debit_fils is None) == (r.credit_fils is None):
            rec.running_balance_ok = False
            msgs.append(f"row {i + 1} ({r.date}): expected exactly one of debit/credit")

    # row-by-row running balance
    implied_opening = None
    if rows and rows[0].balance_fils is not None:
        implied_opening = rows[0].balance_fils - (rows[0].credit_fils or 0) + (rows[0].debit_fils or 0)
    prev = sec.opening_fils if sec.opening_fils is not None else implied_opening
    breaks = 0
    for i, r in enumerate(rows):
        if r.balance_fils is None:
            continue
        if prev is not None:
            expected = prev + (r.credit_fils or 0) - (r.debit_fils or 0)
            if expected != r.balance_fils:
                breaks += 1
                rec.running_balance_ok = False
                if i == 0 and sec.opening_fils is not None:
                    msgs.append(
                        f"printed opening balance {_aed(sec.opening_fils)} does not chain into the first row; "
                        f"the rows imply an opening of {_aed(implied_opening or 0)}")
                elif len(msgs) < MAX_MESSAGES:
                    msgs.append(f"row {i + 1} ({r.date}): printed balance {_aed(r.balance_fils)} "
                                f"but previous balance and amount give {_aed(expected)}")
        prev = r.balance_fils
    if breaks > 1 and len(msgs) >= MAX_MESSAGES:
        msgs.append(f"{breaks} running-balance breaks in total")

    # opening + credits - debits = closing
    if sec.opening_fils is None or sec.closing_fils is None:
        rec.arithmetic_ok = False
        msgs.append("opening or closing balance not printed; arithmetic check skipped")
    elif sec.opening_fils + net != sec.closing_fils:
        rec.arithmetic_ok = False
        msgs.append(f"opening {_aed(sec.opening_fils)} + credits {_aed(sec.total_credit_fils)} − debits "
                    f"{_aed(sec.total_debit_fils)} = {_aed(sec.opening_fils + net)}, statement closing is "
                    f"{_aed(sec.closing_fils)} (difference {_aed(sec.opening_fils + net - sec.closing_fils)})")

    # rows inside the period
    if sec.period_from and sec.period_to:
        outside = [r for r in rows if not (sec.period_from <= r.date <= sec.period_to)]
        if outside:
            msgs.append(f"{len(outside)} row(s) dated outside the statement period")
    msgs.extend(sec.issues[:MAX_MESSAGES])
    rec.ok = rec.arithmetic_ok and rec.running_balance_ok
    sec.reconciliation = rec
    return rec
