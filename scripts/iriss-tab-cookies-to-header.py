#!/usr/bin/env python3
"""
Chrome / DevTools tab-separated cookie table → `Cookie` request header value
(name=value pairs, semicolon-separated). Last row wins on duplicate names.
"""
from __future__ import annotations

import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: iriss-tab-cookies-to-header.py <tab-export.txt>", file=sys.stderr)
        sys.exit(2)
    raw = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
    cookies: dict[str, str] = {}
    for line in raw.splitlines():
        line = line.rstrip()
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        name = parts[0].strip()
        val = parts[1].strip()
        if not name:
            continue
        if val == "":
            continue
        cookies[name] = val
    out = "; ".join(f"{k}={v}" for k, v in cookies.items())
    sys.stdout.write(out)


if __name__ == "__main__":
    main()
