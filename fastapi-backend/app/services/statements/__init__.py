"""Bank statement reading: detect bank + format, parse into normalised rows, reconcile.

``parse_statement(data, filename)`` is pure (bytes in, dataclasses out). Supported:
Emirates NBD account statements, Mashreq NEO consolidated and single-account statements (PDF),
and generic CSV exports. Matching against the household's data lives in ``matching``.
"""
from __future__ import annotations

import io

from app.services.statements import csvfile, enbd, mashreq
from app.services.statements.pdfutil import first_page_text
from app.services.statements.reconcile import reconcile
from app.services.statements.types import (
    ParsedStatement,
    Reconciliation,
    StatementError,
    StatementRow,
    StatementSection,
)

MAX_PAGES = 80

__all__ = [
    "ParsedStatement",
    "Reconciliation",
    "StatementError",
    "StatementRow",
    "StatementSection",
    "parse_statement",
]


def _parse_pdf(data: bytes) -> ParsedStatement:
    import pdfplumber  # imported lazily: only the upload route needs it
    from pdfminer.pdfdocument import PDFPasswordIncorrect

    try:
        pdf = pdfplumber.open(io.BytesIO(data))
    except PDFPasswordIncorrect as exc:
        raise StatementError("the PDF is password-protected") from exc
    except Exception as exc:  # pdfminer raises a zoo of types on malformed input
        raise StatementError("the PDF could not be read") from exc
    with pdf:
        if not pdf.pages:
            raise StatementError("the PDF has no pages")
        if len(pdf.pages) > MAX_PAGES:
            raise StatementError(f"the PDF has more than {MAX_PAGES} pages")
        first = first_page_text(pdf)
        try:
            if mashreq.detect_consolidated(first):
                return ParsedStatement("Mashreq", "mashreq_consolidated", mashreq.parse_consolidated(pdf))
            if mashreq.detect_account(first):
                return ParsedStatement("Mashreq", "mashreq_account", mashreq.parse_account(pdf))
            if enbd.detect(first):
                return ParsedStatement("Emirates NBD", "enbd_account", enbd.parse(pdf))
        except StatementError:
            raise
        except Exception as exc:
            raise StatementError("the statement layout was not recognised") from exc
    raise StatementError("not a supported statement (Emirates NBD or Mashreq NEO PDF, or CSV)")


def parse_statement(data: bytes, filename: str = "") -> ParsedStatement:
    if data[:5] == b"%PDF-":
        parsed = _parse_pdf(data)
    elif csvfile.looks_like_csv(data):
        parsed = ParsedStatement("CSV", "csv", csvfile.parse(data))
    else:
        raise StatementError("upload a PDF statement or a CSV export")
    if not any(s.rows for s in parsed.sections) and not parsed.sections:
        raise StatementError("no accounts found in the statement")
    for sec in parsed.sections:
        reconcile(sec)
    return parsed
