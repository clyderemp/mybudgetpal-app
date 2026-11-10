"""Statement parsing on synthetic PDFs/CSVs: detection, rows, sections, reconciliation, classification."""
import datetime as dt

import pytest

import app.services.statements as statements
from app.services.statements import StatementError, StatementTooComplex, parse_statement
from app.services.statements.classify import classify_row, holder_names, same_person
from app.services.statements.types import mask_numbers
from tests.statement_fixtures import Page, build_pdf, csv_bytes, enbd_pdf, mashreq_account_pdf, mashreq_consolidated_pdf

ENBD_ROWS = [
    ("01/07/2026", ["CARD NO.443913XXXXXX3686 DUBAI ELECTRICITY", "DUBAI:AE 484018 01-07-2026 2155.00,AED"], 215500, None),
    ("02/07/2026", ["MOBILE BANKING TRANSFER TO", "AE070260000000000001002 RefNo:-ABCDEF123456"], 30000, None),
    ("04/07/2026", ["TT REF: 0123456789 AED 17500 /009/004 ACME", "WIDGETS TRADING /REF/Salary for June"], None, 1750000),
    ("05/07/2026", ["RMA 0123456789B012 AED 2000.0 F86318D1A0C0", "AE070500000000123455404"], 200000, None),
    ("06/07/2026", ["418887XXXXXX6358"], 100000, None),
    ("07/07/2026", ["CARD NO.443913XXXXXX3686 Tabby 800 82229", "DUBAI:AE 767544 07-07-2026 96.70,AED"], 9670, None),
    ("08/07/2026", ["CARD NO.443913XXXXXX3686 -07-2026 16:11:32", "E4012026 749205 Dragon Mart, ATM DUBAI AE"], 50000, None),
    ("09/07/2026", ["IPP 20260709BOM6B0001 T_03CF21B0B6E040DE", "AED 1200 ALEX SAMPLE PERSON /REF/ Family", "Support"], None, 120000),
    ("10/07/2026", ["CARD NO.443913XXXXXX3686 UNKNOWN BOUTIQUE", "LLC DUBAI:AE 111222 10-07-2026 45.00,AED"], 4500, None),
    ("11/07/2026", ["RMA TT REF: EPHCOR2520AOS0DE CAD 200@2.73351", "C4472 Alex Sample Person"], 54670, None),
    ("12/07/2026", ["MOBILE BANKING TRANSFER TO", "AE070260000000000001901 RefNo:-0A0B0C0D0E0F"], 335000, None),
]

MASHREQ_ACCOUNTS = [
    ("Current", "Neo Current Account", "0666", 10000, [
        ("01/10/2026", ["Salary Received"], "033SAL0001", None, 1750000),
        ("02/10/2026", ["Debit Card Purchase Card number ending with 1155,"], "MDC0000001", 9670, None),
        ("03/10/2026", ["Debit Card Purchase Card number ending with 1155,", "CARREFOUR MARKET 919601 UBAI", "D"],
         "MDC0000002", 25000, None),
        ("04/10/2026", ["Account to Account Transfer FROM", "ACCOUNT No:019100000666 TO ACCOUNT No:", "019100003570"],
         "033AACT001", 50000, None),
        ("05/10/2026", ["IPP TRANSFER 123452156AE070260000000000001004", "- Alex Sample Person - /REF/ Family Support -",
                        "T_02da558a756e455d"], "033IPP0001", 120000, None),
    ]),
    ("Savings", "Neo Plus Saver - Salary", "3570", 0, [
        ("04/10/2026", ["Account to Account Transfer FROM", "ACCOUNT No:019100000666 TO ACCOUNT No:", "019100003570"],
         "033AACT001", None, 50000),
    ]),
]


def enbd_statement(**kw):  # type: ignore[no-untyped-def]
    return enbd_pdf(ENBD_ROWS, opening=500000, **kw)


def test_enbd_parses_rows_meta_and_reconciles():
    p = parse_statement(enbd_statement())
    assert (p.bank, p.format, len(p.sections)) == ("Emirates NBD", "enbd_account", 1)
    s = p.sections[0]
    assert (s.last4, s.account_type, s.product, s.currency) == ("1004", "bank", "Current account", "AED")
    assert (s.period_from, s.period_to) == (dt.date(2026, 7, 1), dt.date(2026, 7, 31))
    assert holder_names(s.holder) == ["ALEX SAMPLE PERSON", "JORDAN EXAMPLE PARTNER"]
    assert len(s.rows) == len(ENBD_ROWS)
    assert [(r.debit_fils, r.credit_fils) for r in s.rows] == [(d, c) for _, _, d, c in ENBD_ROWS]
    assert s.opening_fils == 500000
    assert s.closing_fils == 500000 + sum((c or 0) - (d or 0) for _, _, d, c in ENBD_ROWS)
    assert s.reconciliation.ok, s.reconciliation.messages
    r = s.rows[1]
    assert r.counterparty_last4 == "1002" and r.ref == "ABCDEF123456"
    assert "AE070260000000000001002" not in r.description and "AE..1002" in r.description
    assert s.rows[0].card_last4 == "3686" and s.rows[4].card_last4 == "6358"
    assert s.rows[9].original_currency == "CAD"


def test_enbd_multi_page_and_quirks_are_reported_not_fatal():
    p = parse_statement(enbd_statement(rows_per_page=4, printed_opening=533, wrong_balance_after=8))
    s = p.sections[0]
    assert len(s.rows) == len(ENBD_ROWS)  # rows on three pages
    rec = s.reconciliation
    assert not rec.ok and not rec.running_balance_ok
    assert any("does not chain" in m for m in rec.messages)  # printed brought-forward disagrees with rows
    assert any("printed balance" in m for m in rec.messages)  # running balance break


def test_mashreq_consolidated_sections_and_glyph_fixes():
    p = parse_statement(mashreq_consolidated_pdf(MASHREQ_ACCOUNTS))
    assert (p.bank, p.format) == ("Mashreq", "mashreq_consolidated")
    cur, sav = p.sections
    assert (cur.last4, cur.account_type, sav.last4, sav.account_type) == ("0666", "bank", "3570", "savings")
    assert cur.product == "Neo Current Account" and sav.product.startswith("Neo Plus Saver")
    assert cur.opening_fils == 10000 and cur.closing_fils == 10000 + 1750000 - 9670 - 25000 - 50000 - 120000
    assert cur.reconciliation.ok and sav.reconciliation.ok, cur.reconciliation.messages
    assert [r.ref for r in cur.rows][:2] == ["033SAL0001", "MDC0000001"]
    assert cur.rows[2].description.endswith("DUBAI")  # 'UBAI' + 'D' repaired
    assert cur.rows[1].card_last4 == "1155"
    assert cur.rows[4].counterparty_last4 == "1004"
    assert any("generation time" in n for n in cur.notes)


def test_mashreq_account_statement():
    rows = [("2026-10-07", ["Acct to Acct transfer - FUND TRANSFER -", "019100000666 - ALEX SAMPLE PERSON"],
             "033AACT0002", None, 220000),
            ("2026-10-22", ["Acct to Acct transfer - FUND TRANSFER -", "019100000666 - ALEX SAMPLE PERSON"],
             "033AACT0003", 140000, None)]
    p = parse_statement(mashreq_account_pdf(rows))
    s = p.sections[0]
    assert (p.format, s.last4, s.account_type) == ("mashreq_account", "3570", "savings")
    assert [(r.credit_fils, r.debit_fils, r.counterparty_last4) for r in s.rows] == [(220000, None, "0666"), (None, 140000, "0666")]
    assert s.closing_fils == 80000 and s.reconciliation.ok


def test_csv_export():
    data = csv_bytes([("2026-07-02", "SPOTIFY STOCKHOLM", "23.99", "", "976.01"),
                      ("2026-07-01", "Opening deposit", "", "1000.00", "1000.00")])
    p = parse_statement(data, "export.csv")
    s = p.sections[0]
    assert p.format == "csv" and [r.date.day for r in s.rows] == [1, 2]  # newest-first reversed
    assert (s.opening_fils, s.closing_fils) == (0, 97601) and s.reconciliation.ok


@pytest.mark.parametrize("data", [b"hello", b"%PDF-1.4 garbage", b"a,b\n1,2\n"])
def test_unreadable_files_raise_statement_error(data):
    with pytest.raises(StatementError):
        parse_statement(data)


def test_classification_of_row_kinds():
    s = parse_statement(enbd_statement()).sections[0]
    facts = [classify_row(r, s.last4) for r in s.rows]
    kinds = [f.kind for f in facts]
    assert kinds == ["purchase", "account", "salary", "person", "card_payment", "bnpl", "atm", "person", "purchase",
                     "remittance", "account"]
    assert facts[0].name == "Dubai Electricity"
    assert facts[2].category_hint == "Salary" and "ACME" in facts[2].label.upper()
    assert facts[3].no_name and facts[3].label == "Transfer to ..5404"
    assert facts[4].counter_last4 == "6358" and facts[5].bnpl == "Tabby"
    assert facts[6].label == "ATM Dragon Mart"
    assert same_person(facts[7].counter_name, holder_names(s.holder)) and facts[7].counter_bank == "BOM"
    assert facts[9].category_hint == "Debt payment" and "CAD 200" in facts[9].note
    m = parse_statement(mashreq_consolidated_pdf(MASHREQ_ACCOUNTS)).sections[0]
    mf = [classify_row(r, "0666") for r in m.rows]
    assert mf[1].no_name and mf[1].label == "Card purchase ..1155"
    assert mf[2].name == "Carrefour Market" and mf[3].counter_last4 == "3570"


def test_mask_numbers():
    assert mask_numbers("TO AE07 0260 0000 0000 0001 002 ref 0123456789012") == "TO AE..1002 ref ..9012"
    assert mask_numbers("CARD NO.443913XXXXXX3686") == "CARD NO.XXXX3686"


def test_decompression_bomb_page_is_refused():
    p = Page(612, 792)
    p.text(20, 100, "Emirates NBD")
    data = build_pdf([p], padding=5 * 1024 * 1024)  # 5 MB of inflated content in a few KB
    assert len(data) < 20_000
    with pytest.raises(StatementTooComplex):
        parse_statement(data)


def test_too_many_objects_per_page_is_refused():
    p = Page(612, 792)
    for i in range(240):  # ~21,600 glyphs on one page
        p.text(10, 10 + i * 3, "X" * 90, size=3)
    with pytest.raises(StatementTooComplex):
        parse_statement(build_pdf([p]))


def test_total_object_cap_and_time_budget(monkeypatch):
    data = enbd_statement(rows_per_page=3)
    monkeypatch.setattr(statements, "MAX_TOTAL_OBJECTS", 500)
    with pytest.raises(StatementTooComplex):
        parse_statement(data)
    monkeypatch.undo()
    with pytest.raises(StatementTooComplex):
        parse_statement(data, time_budget=0)
    assert parse_statement(data).sections[0].rows  # normal budget still fine
