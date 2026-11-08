"""Production-style entry point: ``python -m app``.

Runs uvicorn with proxy headers OFF so a client-supplied X-Forwarded-For (passed through by
the Next.js /api rewrite) can never become ``request.client.host`` and dodge rate limits.
"""
from __future__ import annotations

import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8000")),
        proxy_headers=False,
        forwarded_allow_ips="",
    )
