"""Word/line helpers over pdfplumber pages (coordinate-based parsing)."""
from __future__ import annotations

import re
import threading
import time
from typing import Any

from app.services.statements.types import StatementTooComplex

_budget = threading.local()


def set_deadline(seconds: float | None) -> None:
    """Wall-clock budget for the parse running in this thread (None clears it)."""
    _budget.deadline = time.monotonic() + seconds if seconds is not None else None


def check_deadline() -> None:
    deadline = getattr(_budget, "deadline", None)
    if deadline is not None and time.monotonic() > deadline:
        raise StatementTooComplex("the statement took too long to read")

ARABIC = re.compile(r"[؀-ۿﭐ-﷿ﹰ-﻿]")


def clean_text(text: str) -> str:
    """Repair renderer artefacts: Mashreq's 'f' glyph comes out as form feed; drop (cid:N) glyphs."""
    return re.sub(r"\(cid:\d+\)", "", text.replace("\x0c", "f"))


def page_lines(page: Any, x_tolerance: float = 1.5, y_tolerance: float = 2, gap: float = 2.5) -> list[dict]:
    """Group words into visual lines by 'top'. Arabic words are dropped; ``arabic`` flags such lines."""
    check_deadline()
    words = page.extract_words(x_tolerance=x_tolerance, y_tolerance=y_tolerance)
    lines: list[dict] = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        w = dict(w)
        w["text"] = clean_text(w["text"]).strip()
        if not w["text"]:
            continue
        if lines and abs(lines[-1]["top"] - w["top"]) <= gap:
            lines[-1]["words"].append(w)
        else:
            lines.append({"top": w["top"], "words": [w]})
    out = []
    for ln in lines:
        ln["words"].sort(key=lambda w: w["x0"])
        ln["arabic"] = any(ARABIC.search(w["text"]) for w in ln["words"])
        ln["words"] = [w for w in ln["words"] if not ARABIC.search(w["text"])]
        ln["text"] = " ".join(w["text"] for w in ln["words"])
        if ln["words"]:
            out.append(ln)
        elif ln["arabic"]:
            out.append({"top": ln["top"], "words": [], "arabic": True, "text": ""})
    return out


def xc(word: dict) -> float:
    return (word["x0"] + word["x1"]) / 2


def first_page_text(pdf: Any) -> str:
    return clean_text(pdf.pages[0].extract_text() or "") if pdf.pages else ""
