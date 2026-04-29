"""Server-side redaction — defence in depth.

The widget redacts on the client before anything leaves the browser, but
a malicious or buggy client can ship secrets anyway. This module re-runs
a curated set of regex strippers over every string in the metadata
bundle before it lands in Postgres.

Redactors are deliberately conservative:

* Authorization / Bearer / token patterns: replace value with ``[REDACTED]``.
* JWT-shaped tokens (three base64 segments): replace.
* Credit-card-number-shaped digit runs (Luhn-friendly): replace.
* Long urlencoded ``access_token=…`` query params: replace value.

Patterns intentionally err on the side of redaction. False positives in
diagnostic data (emails contain dashes, URLs contain dots) are tolerated
because feedback rows are read by humans, not parsed.
"""

from __future__ import annotations

import re
from typing import Any

# Authorization: Bearer xxx / Authorization: Basic xxx
# The value chunk is matched up to end-of-line/string so we scrub the whole
# secret, not just the first token after the delimiter.
_AUTH_HEADER_RE = re.compile(r"(?i)(authorization\s*[:=]\s*)[^\r\n]+")
# Bare "Bearer xxx" tokens.
_BEARER_RE = re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._\-+/=]+")
# JWT-shaped: three base64url segments separated by dots, each ≥ 4 chars.
_JWT_RE = re.compile(r"\b[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,}\b")
# 13-19 digit runs separated by spaces or dashes (loose CC).
_CC_RE = re.compile(r"\b(?:\d[ \-]?){12,18}\d\b")
# access_token=xxx / refresh_token=xxx / api_key=xxx in query strings.
_QS_TOKEN_RE = re.compile(r"(?i)\b(access_token|refresh_token|id_token|api[_-]?key|secret)=[^\s&]+")
# Cookies (rough): "Cookie: name=value; ..." → strip the value chunk.
_COOKIE_RE = re.compile(r"(?i)(cookie\s*[:=]\s*)[^\r\n]+")


def redact_string(value: str) -> str:
    """Apply every redactor to a single string. Pure function."""
    out = value
    out = _AUTH_HEADER_RE.sub(r"\1[REDACTED]", out)
    out = _BEARER_RE.sub("[REDACTED]", out)
    out = _COOKIE_RE.sub(r"\1[REDACTED]", out)
    out = _QS_TOKEN_RE.sub(r"\1=[REDACTED]", out)
    out = _JWT_RE.sub("[REDACTED]", out)
    out = _CC_RE.sub("[REDACTED]", out)
    return out


def redact_bundle(value: Any) -> Any:
    """Recursively redact every string inside a JSON-shaped value.

    Lists and dicts are walked; strings are run through ``redact_string``;
    other primitives pass through untouched. Returns a new structure
    (no in-place mutation) so callers can keep the original around.
    """
    if isinstance(value, str):
        return redact_string(value)
    if isinstance(value, list):
        return [redact_bundle(v) for v in value]
    if isinstance(value, dict):
        return {k: redact_bundle(v) for k, v in value.items()}
    return value
