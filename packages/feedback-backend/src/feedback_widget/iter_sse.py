"""Server-Sent-Events helpers for the iter ``runs`` endpoint.

Format reference (spec §8.4)::

    event: token
    data: {"chunk": "...partial markdown..."}

    event: section
    data: {"section": "personas"}

    event: done
    data: {"version_id": "...", "version_number": 2}

    event: error
    data: {"error_code": "...", "message": "..."}

A periodic ``: heartbeat\\n\\n`` line keeps reverse proxies (nginx,
Traefik) from idle-closing the connection during long generations.
"""

from __future__ import annotations

import asyncio
import re
from collections.abc import AsyncIterator

from .iter_schemas import (
    SSEEvent,
    SSEEventDone,
    SSEEventError,
    SSEEventHeartbeat,
    SSEEventSection,
    SSEEventToken,
)


def format_sse(event: SSEEvent) -> bytes:
    """Render one event as the wire bytes the client receives.

    Uses the ``event:`` field for the type and ``data:`` for the
    JSON payload. Heartbeats use the SSE comment form (``: ...\\n\\n``)
    which clients ignore for dispatching but keep the connection
    alive for proxies.
    """
    if isinstance(event, SSEEventHeartbeat):
        return b": heartbeat\n\n"
    payload = event.model_dump_json(exclude={"type"})
    return f"event: {event.type}\ndata: {payload}\n\n".encode()


async def heartbeat_pinger(interval_seconds: float) -> AsyncIterator[bytes]:
    """Yield a heartbeat byte-string at a fixed cadence forever.

    The caller is responsible for cancelling this iterator when the
    main stream closes (use ``asyncio.wait`` with FIRST_COMPLETED or
    similar).
    """
    while True:
        await asyncio.sleep(interval_seconds)
        yield format_sse(SSEEventHeartbeat())


def make_token(chunk: str) -> SSEEventToken:
    return SSEEventToken(chunk=chunk)


def make_section(
    section: str,
) -> SSEEventSection:
    return SSEEventSection(section=section)  # type: ignore[arg-type]


def make_done(*, version_id: str, version_number: int) -> SSEEventDone:
    import uuid as _uuid

    return SSEEventDone(
        version_id=_uuid.UUID(version_id),
        version_number=version_number,
    )


def make_error(*, error_code: str, message: str) -> SSEEventError:
    return SSEEventError(error_code=error_code, message=message)


# ────────────────────────────────────────────────────────────────────
# Section detector
# ────────────────────────────────────────────────────────────────────
#
# As ``markdown_rendered`` streams in, the UI lights up sections one
# at a time when the streaming parser detects an H2 boundary. The
# detector is a tiny stateful matcher rather than a Markdown parser
# because the prompt fixes the section order and headings.

# v0.5.1 — heading matcher is now level-agnostic. The system prompt
# in `iter_prompts/system_v1.py` actually emits H1 (`# Personas`) for
# the four canonical sections, but the older comment in this file
# claimed H2. Both header levels are now accepted (`#{1,6}\s+Name`)
# so the parser tolerates the model's actual output and any prompt-
# template tweak that swaps levels in the future. Case-insensitive
# for safety. Trailing `\b` anchors each label so `Spec` doesn't
# match `Specification` and so on.
#
# Assumptions is no longer matched: the prompt emits assumptions as
# a JSON list, not as a markdown section, so the entry was always
# dead weight that surfaced as an empty card on the frontend.
_SECTION_PATTERNS: dict[str, re.Pattern[str]] = {
    "personas": re.compile(r"^#{1,6}\s+Personas\b", re.IGNORECASE | re.MULTILINE),
    "user_stories": re.compile(r"^#{1,6}\s+User\s+Stories\b", re.IGNORECASE | re.MULTILINE),
    "spec": re.compile(r"^#{1,6}\s+Spec\b", re.IGNORECASE | re.MULTILINE),
    "diagram": re.compile(r"^#{1,6}\s+Diagram\b", re.IGNORECASE | re.MULTILINE),
}


class SectionDetector:
    """Emit a section name the first time its heading appears in the
    streaming text. Idempotent on re-feeds of the same content."""

    def __init__(self) -> None:
        self._seen: set[str] = set()
        self._buffer = ""

    def feed(self, chunk: str) -> list[str]:
        """Return the list of section names that newly appear in this
        chunk relative to everything seen before."""
        self._buffer += chunk
        newly: list[str] = []
        for name, pattern in _SECTION_PATTERNS.items():
            if name in self._seen:
                continue
            if pattern.search(self._buffer):
                self._seen.add(name)
                newly.append(name)
        return newly
