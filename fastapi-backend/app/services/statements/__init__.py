"""Bank statement reading: detect bank + format, parse into normalised rows, reconcile.

``parse_statement(data, filename)`` is pure (bytes in, dataclasses out). Supported:
Emirates NBD account statements, Mashreq NEO consolidated and single-account statements (PDF),
and generic CSV exports. Matching against the household's data lives in ``matching``.
"""
from __future__ import annotations

import io
import zlib

from app.services.statements import csvfile, enbd, mashreq
from app.services.statements.pdfutil import check_deadline, first_page_text, set_deadline
from app.services.statements.reconcile import reconcile
from app.services.statements.types import (
    ParsedStatement,
    Reconciliation,
    StatementError,
    StatementRow,
    StatementSection,
    StatementTooComplex,
)

# Untrusted uploads: besides the byte cap at the route, bound the work pdfminer can be made to do.
MAX_PAGES = 80
MAX_PAGE_OBJECTS = 20_000    # chars + lines + rects on one page (real statements: < 4,000)
MAX_TOTAL_OBJECTS = 300_000  # across the document
PARSE_SECONDS = 20.0         # wall-clock budget, checked between pages
MAX_PAGE_CONTENT_BYTES = 2 * 1024 * 1024  # decompressed content stream per page (real statements: < 100 KB)

__all__ = [
    "ParsedStatement",
    "Reconciliation",
    "StatementError",
    "StatementRow",
    "StatementSection",
    "StatementTooComplex",
    "parse_statement",
    "parse_statement_in_process",
]


def _content_too_big(page: object) -> bool:
    """Cheap first gate (the child process limits are the real guard): inflate each page content
    stream ourselves with an output cap before pdfminer decompresses it without one. Fails CLOSED:
    a decode error, a chained filter or any filter other than FlateDecode counts as too big."""
    from pdfminer.pdftypes import resolve1

    size = 0
    for stream in getattr(page.page_obj, "contents", None) or []:  # type: ignore[attr-defined]
        stream = resolve1(stream)
        raw = getattr(stream, "rawdata", None)
        if raw is None:
            return True
        filters = [f[0] if isinstance(f, tuple) else f for f in stream.get_filters()]
        names = [getattr(f, "name", str(f)) for f in filters]
        if not names:
            size += len(raw)
        elif names == ["FlateDecode"]:
            try:
                out = zlib.decompressobj().decompress(raw, MAX_PAGE_CONTENT_BYTES + 1 - size)
            except zlib.error:
                return True
            size += len(out)
        else:
            return True
        if size > MAX_PAGE_CONTENT_BYTES:
            return True
    return False


def _check_size(pdf: object) -> None:
    """Lay out each page once (pdfplumber caches it) and stop as soon as a cap or the deadline is hit."""
    total = 0
    for page in pdf.pages:  # type: ignore[attr-defined]
        check_deadline()
        if _content_too_big(page):
            raise StatementTooComplex("a page of the statement is too large to read")
        n = len(page.chars) + len(page.lines) + len(page.rects)
        total += n
        if n > MAX_PAGE_OBJECTS or total > MAX_TOTAL_OBJECTS:
            raise StatementTooComplex("the statement is too large or complex to read")
    check_deadline()


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
        _check_size(pdf)
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
        except RecursionError as exc:
            raise StatementTooComplex("the statement is too large or complex to read") from exc
        except Exception as exc:
            raise StatementError("the statement layout was not recognised") from exc
    raise StatementError("not a supported statement (Emirates NBD or Mashreq NEO PDF, or CSV)")


def parse_statement(data: bytes, filename: str = "") -> ParsedStatement:
    """Entry point for uploads: PDFs are parsed in a resource-limited child process (``sandbox``)."""
    if data[:5] == b"%PDF-":
        from app.services.statements.sandbox import parse_pdf_isolated

        return parse_pdf_isolated(data, filename)
    return parse_statement_in_process(data, filename)


def parse_statement_in_process(data: bytes, filename: str = "", time_budget: float | None = PARSE_SECONDS) -> ParsedStatement:
    """Parse in this process (the sandbox child, CSVs, and tests). Untrusted PDFs: use ``parse_statement``."""
    if data[:5] == b"%PDF-":
        set_deadline(time_budget)
        try:
            parsed = _parse_pdf(data)
        finally:
            set_deadline(None)
    elif csvfile.looks_like_csv(data):
        parsed = ParsedStatement("CSV", "csv", csvfile.parse(data))
    else:
        raise StatementError("upload a PDF statement or a CSV export")
    if not any(s.rows for s in parsed.sections) and not parsed.sections:
        raise StatementError("no accounts found in the statement")
    for sec in parsed.sections:
        reconcile(sec)
    return parsed
