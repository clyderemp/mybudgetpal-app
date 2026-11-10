"""Parse untrusted PDFs in a child process with OS resource limits and a hard wall-clock kill.

The parent sends the file on stdin; the child (``python -m app.services.statements.sandbox``) lowers
its own RLIMIT_AS (address space) and RLIMIT_CPU before importing pdfplumber, parses in-process and
writes the result as JSON on stdout. Any crash, memory error, CPU-limit signal or timeout becomes
``StatementTooComplex``; a clean "not a statement" answer stays a ``StatementError``.

RLIMIT_AS is not enforceable everywhere (macOS ignores it for large reservations); the CPU limit
and the parent's kill-on-timeout always apply.
"""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from app.services.statements.types import (
    ParsedStatement,
    Reconciliation,
    StatementError,
    StatementRow,
    StatementSection,
    StatementTooComplex,
)

CHILD_MODULE = "app.services.statements.sandbox"
TIMEOUT_SECONDS = 20.0
MEMORY_MB = 512
CPU_SECONDS = 20
BACKEND_ROOT = Path(__file__).resolve().parents[3]
EXIT_NOT_STATEMENT = 3
EXIT_TOO_COMPLEX = 4


# ------------------------------------------------------------------ (de)serialisation
def _default(o: Any) -> Any:
    if isinstance(o, dt.date):
        return o.isoformat()
    raise TypeError(type(o).__name__)


def dumps(parsed: ParsedStatement) -> str:
    return json.dumps(dataclasses.asdict(parsed), default=_default)


def _date(v: str | None) -> dt.date | None:
    return dt.date.fromisoformat(v) if v else None


def loads(text: str) -> ParsedStatement:
    raw = json.loads(text)
    sections = []
    for s in raw["sections"]:
        rows = [StatementRow(**{**r, "date": _date(r["date"]), "value_date": _date(r.get("value_date"))})
                for r in s.pop("rows")]
        rec = Reconciliation(**s.pop("reconciliation"))
        sections.append(StatementSection(**{**s, "period_from": _date(s.get("period_from")),
                                            "period_to": _date(s.get("period_to"))}, rows=rows, reconciliation=rec))
    return ParsedStatement(raw["bank"], raw["format"], sections, raw.get("issues", []))


# ------------------------------------------------------------------ parent
def parse_pdf_isolated(data: bytes, filename: str = "", timeout: float = TIMEOUT_SECONDS,
                       module: str = CHILD_MODULE) -> ParsedStatement:
    env = {"PATH": os.environ.get("PATH", ""), "PYTHONPATH": str(BACKEND_ROOT), "PYTHONDONTWRITEBYTECODE": "1",
           "MBP_SANDBOX_MEMORY_MB": str(MEMORY_MB), "MBP_SANDBOX_CPU_SECONDS": str(CPU_SECONDS)}
    try:
        proc = subprocess.run([sys.executable, "-m", module, filename[:200]], input=data, capture_output=True,
                              timeout=timeout, env=env, cwd=str(BACKEND_ROOT), check=False)
    except subprocess.TimeoutExpired as exc:  # run() kills the child before raising
        raise StatementTooComplex("the statement took too long to read") from exc
    if proc.returncode == 0:
        try:
            return loads(proc.stdout.decode())
        except (ValueError, KeyError, TypeError) as exc:
            raise StatementTooComplex("the statement reader returned an unexpected result") from exc
    message = proc.stdout.decode(errors="replace").strip()[:300]
    if proc.returncode == EXIT_NOT_STATEMENT:
        raise StatementError(message or "the statement could not be read")
    # EXIT_TOO_COMPLEX, MemoryError, killed by RLIMIT_CPU (SIGXCPU/SIGKILL), any crash
    raise StatementTooComplex(message if proc.returncode == EXIT_TOO_COMPLEX and message
                              else "the statement is too large or complex to read")


# ------------------------------------------------------------------ child
def _limit_self() -> None:
    try:
        import resource
    except ImportError:  # pragma: no cover - non-POSIX
        return
    mem = int(os.environ.get("MBP_SANDBOX_MEMORY_MB", MEMORY_MB)) * 1024 * 1024
    cpu = int(os.environ.get("MBP_SANDBOX_CPU_SECONDS", CPU_SECONDS))
    for res, value in ((resource.RLIMIT_AS, mem), (resource.RLIMIT_CPU, cpu)):
        try:
            soft, hard = resource.getrlimit(res)
            new = value if hard == resource.RLIM_INFINITY else min(value, hard)
            resource.setrlimit(res, (new, hard))
        except (ValueError, OSError):  # platform refuses this limit: timeout + CPU still apply
            pass


def _child_main() -> int:
    _limit_self()
    data = sys.stdin.buffer.read()
    from app.services.statements import parse_statement_in_process

    try:
        parsed = parse_statement_in_process(data, sys.argv[1] if len(sys.argv) > 1 else "")
    except StatementTooComplex as exc:
        sys.stdout.write(str(exc))
        return EXIT_TOO_COMPLEX
    except MemoryError:
        sys.stdout.write("the statement is too large or complex to read")
        return EXIT_TOO_COMPLEX
    except StatementError as exc:
        sys.stdout.write(str(exc))
        return EXIT_NOT_STATEMENT
    sys.stdout.write(dumps(parsed))
    return 0


if __name__ == "__main__":
    sys.exit(_child_main())
