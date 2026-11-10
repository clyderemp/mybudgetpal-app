"""Synthetic statement PDFs/CSVs for tests (fictional people, banks' layouts only).

A tiny PDF writer (Helvetica text at absolute positions + horizontal rules) reproduces the
coordinate layouts the parsers rely on: Emirates NBD account statements, Mashreq NEO single-account
statements and Mashreq NEO consolidated statements. Coordinates are "top" values as pdfplumber
reports them (points from the top edge).
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Page:
    width: float
    height: float
    texts: list[tuple[float, float, str, float]] = field(default_factory=list)  # x, top, text, size
    rules: list[tuple[float, float, float]] = field(default_factory=list)  # x0, x1, top

    def text(self, x: float, top: float, s: str, size: float = 6.5) -> None:
        self.texts.append((x, top, s, size))

    def rule(self, x0: float, x1: float, top: float) -> None:
        self.rules.append((x0, x1, top))


def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_pdf(pages: list[Page]) -> bytes:
    objs: list[bytes] = []

    def add(body: bytes) -> int:
        objs.append(body)
        return len(objs)

    font = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    pages_id = add(b"")  # placeholder
    kids = []
    for p in pages:
        ops = []
        for x, top, s, size in p.texts:
            y = p.height - top - size * 0.75
            ops.append(f"BT /F1 {size:g} Tf {x:.2f} {y:.2f} Td ({_esc(s)}) Tj ET")
        for x0, x1, top in p.rules:
            y = p.height - top
            ops.append(f"0.5 w {x0:.2f} {y:.2f} m {x1:.2f} {y:.2f} l S")
        stream = "\n".join(ops).encode("cp1252")
        content = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        kids.append(add(
            b"<< /Type /Page /Parent %d 0 R /MediaBox [0 0 %g %g] /Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >>"
            % (pages_id, p.width, p.height, font, content)))
    objs[pages_id - 1] = b"<< /Type /Pages /Kids [%s] /Count %d >>" % (
        b" ".join(b"%d 0 R" % k for k in kids), len(kids))
    catalog = add(b"<< /Type /Catalog /Pages %d 0 R >>" % pages_id)
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, catalog, xref)
    return bytes(out)


def _amt(fils: int, decimals: int = 2) -> str:
    s = f"{abs(fils) / 100:,.2f}"
    return s + "0" if decimals == 3 else s


# ------------------------------------------------------------------ Emirates NBD
# (date dd/mm/yyyy, [description lines], debit fils|None, credit fils|None)
ENBD_HOLDER = ["ALEX SAMPLE PERSON AND OR", "JORDAN EXAMPLE PARTNER"]


def enbd_pdf(rows: list[tuple[str, list[str], int | None, int | None]], *, last4: str = "1004",
             product: str = "CURRENT ACCOUNT", opening: int = 10000, printed_opening: int | None = None,
             period: tuple[str, str] = ("01-07-2026", "31-07-2026"), rows_per_page: int = 7,
             wrong_balance_after: int | None = None) -> bytes:
    acct = "10150000" + "0" * (5 - len(last4)) + last4  # 13 digits ending in last4
    iban = "AE07026" + "0" * (16 - len(last4)) + last4
    pages: list[Page] = []
    bal = opening
    chunks = [rows[i:i + rows_per_page] for i in range(0, len(rows), rows_per_page)] or [[]]
    for pno, chunk in enumerate(chunks, 1):
        p = Page(612, 792)
        p.text(557, 98.6, f"Page {pno} of {len(chunks)}")
        p.text(20, 130.6, "Statement Details Emirates NBD")
        if pno == 1:
            p.text(20, 163.9, "Statement Date: 10/11/2026")
            p.text(246, 163.9, f"Statement period {period[0]} to {period[1]}")
            p.text(246, 179.5, f"Account type {product}")
            p.text(20, 183.6, ENBD_HOLDER[0])
            p.text(20, 193.1, ENBD_HOLDER[1])
            p.text(246, 193.1, f"Account number {acct}")
            p.text(20, 210.1, ".")
            p.text(246, 210.1, f"IBAN {iban}")
            p.text(246, 225.1, "Currency AED")
            p.text(20, 231.2, "POST BOX 1")
            p.text(20, 240.0, "DUBAI, UNITED ARAB EMIRATES")
        p.text(42, 308.7, "Date")
        p.text(190, 308.7, "Details")
        p.text(354, 308.7, "Debit")
        p.text(440, 308.7, "Credit")
        p.text(531, 308.7, "Balance")
        y = 335.9
        if pno == 1:
            p.text(30, y, "30/06/2026")
            p.text(84, y, "BROUGHT FORWARD")
            p.text(508, y, _amt(opening if printed_opening is None else printed_opening))
            p.text(556, y, "Cr")
        y = 376.7
        for i, (date, desc, debit, credit) in enumerate(chunk):
            bal += (credit or 0) - (debit or 0)
            k = (pno - 1) * rows_per_page + i
            shown = bal + (6000 if wrong_balance_after is not None and k >= wrong_balance_after else 0)
            p.text(30, y, date)
            if debit:
                p.text(346, y, _amt(debit))
            if credit:
                p.text(434, y, _amt(credit))
            p.text(508, y, _amt(shown))
            p.text(556, y, "Cr" if shown >= 0 else "Dr")
            offs = {1: [0.0], 2: [-4.7, 5.5], 3: [-10.2, 0.0, 10.2]}[min(len(desc), 3)]
            for off, line in zip(offs, desc):
                if off == 0.0:
                    p.text(84, y, line)
                else:
                    p.text(84, y + off, line)
            y += 40.8
        pages.append(p)
    return build_pdf(pages)


# ------------------------------------------------------------------ Mashreq single-account statement
def mashreq_account_pdf(rows: list[tuple[str, list[str], str, int | None, int | None]], *, last4: str = "3570",
                        opening: int = 0, period: tuple[str, str] = ("2026-07-01", "2026-11-10"),
                        kind: str = "Savings") -> bytes:
    p = Page(600, 842)
    p.text(30, 68.6, "ALEX SAMPLE PERSON")
    p.text(295, 68.6, f"{kind} account statement")
    p.text(295, 84.7, f"Account Number 01910000{last4} AED")
    p.text(295, 102.6, f"IBAN AE0703300000191000{last4}")
    p.text(292, 131.5, "Mashreq Neo is part of Mashreqbank PSC is regulated by the Central Bank of the United Arab Emirates")
    p.text(31, 241.6, f"Statement for period {period[0]} to {period[1]}")
    for x, s in ((31, "Date"), (97, "Transaction"), (268, "Reference"), (312, "No"), (390, "Debit"),
                 (464, "Credit"), (527, "Balance")):
        p.text(x, 281.6, s)
    p.text(90, 314.4, "Opening Balance")
    p.text(551, 314.4, _amt(opening))
    y, bal = 334.4, opening
    for date, desc, ref, debit, credit in rows:
        bal += (credit or 0) - (debit or 0)
        p.text(90, y - 3.3, desc[0])
        p.text(30, y, date)
        p.text(254, y, ref)
        if debit:
            p.text(378, y, _amt(debit))
        if credit:
            p.text(446, y, _amt(credit))
        p.text(534, y, _amt(bal))
        for k, line in enumerate(desc[1:], 1):
            p.text(90, y - 3.3 + 12.7 * k, line)
        y += 12.7 * max(len(desc), 2) + 10
    p.text(90, y, "Closing Balance")
    p.text(551, y, _amt(bal))
    p.text(284, 802.6, "Page 1 of 1")
    return build_pdf([p])


# ------------------------------------------------------------------ Mashreq consolidated statement
# accounts: [(kind "Current"|"Savings", product, last4, opening fils, rows)]; row = (dd/mm/yyyy, [desc], ref, debit, credit)
def mashreq_consolidated_pdf(accounts: list[tuple[str, str, str, int, list]], *,
                             period: tuple[str, str] = ("01/10/2026", "31/10/2026")) -> bytes:
    p1 = Page(594, 842)
    p1.text(267, 99.4, "Consolidated Relationship Statement")
    p1.text(38, 115.3, "ALEX SAMPLE PERSON")
    p1.text(267, 123.7, "Customer Number 012345552")
    p1.text(267, 141.8, "Issue Date 02/11/2026")
    p1.text(267, 162.3, f"Statement Period {period[0]} to {period[1]}")
    p1.text(267, 179.6, "Mashreq NEO is part of Mashreqbank PSC a Bank that is regulated by the Central Bank")
    y = 300
    for kind, product, last4, opening, rows in accounts:
        closing = opening + sum((c or 0) - (d or 0) for _, _, _, d, c in rows)
        p1.text(50, y, f"{product} 01910000{last4} AED 0.000 {_amt(closing + 1234, 3)} 0.000 0.00%")
        y += 30
    pages = [p1]
    for kind, product, last4, opening, rows in accounts:
        p = Page(594, 842)
        p.text(38, 115.3, "ALEX SAMPLE PERSON")
        p.text(283, 120.6, f"{kind} Account Statement")
        p.text(283, 141.8, f"Account No 01910000{last4} AED")
        p.text(49, 274.0, f"Statement for Period {period[0]} to {period[1]}")
        for x, s in ((51, "Date"), (104, "Transaction"), (277, "Reference"), (313, "no"), (414, "Debit"),
                     (475, "Credit"), (547, "Balance")):
            p.text(x, 295.3, s)
        top = 318.0
        p.rule(47.9, 560, top)

        def band(lines: list[tuple[float, str, float]], height: float) -> None:
            nonlocal top
            for x, s, dy in lines:
                p.text(x, top + dy, s)
            top += height
            p.rule(47.9, 560, top)

        band([(104, "OPENING BALANCE", 4), (414, "0.000", 4), (477, "0.000", 4), (547, _amt(opening, 3), 4)], 14.4)
        bal = opening
        for date, desc, ref, debit, credit in rows:
            bal += (credit or 0) - (debit or 0)
            lines = [(51, date, 4), (277, ref, 4), (414, _amt(debit or 0, 3), 4), (477, _amt(credit or 0, 3), 4),
                     (547, _amt(bal, 3), 4)]
            lines += [(104, line, 4 + 9.5 * k) for k, line in enumerate(desc)]
            band(lines, 9.5 * max(len(desc), 1) + 6)
        band([(104, "CLOSING BALANCE", 4), (414, "0.000", 4), (477, "0.000", 4), (547, _amt(bal, 3), 4)], 14.4)
        p.text(280, 832.0, "Page 2 of 2")
        pages.append(p)
    return build_pdf(pages)


def csv_bytes(rows: list[tuple[str, str, str, str, str]]) -> bytes:
    lines = ["Date,Description,Debit,Credit,Balance"] + [",".join(r) for r in rows]
    return ("\n".join(lines) + "\n").encode()
