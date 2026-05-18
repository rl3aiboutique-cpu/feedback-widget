"""Server-side jargon scrubber for the chat-first assistant reply.

The capture-mode system prompt forbids technical vocabulary
(``endpoint``, ``cache``, ``debounce``, etc.) inside the LLM's reply
text, but the models do not honour negative instructions reliably.
This module is the safety net: it runs after the JSON parser validates
the turn shape but before the reply is persisted, so the user never
sees jargon the prompt already promised wouldn't appear.

Two-strategy approach:

1. **Quiet rewrite.** When forbidden words appear AND a host glossary
   maps them to a canonical domain term, replace in-place. The user
   sees clean prose; the rewrite is recorded in ``log`` for audit.
2. **Drop-and-retry.** When a single reply is at least 50 % jargon
   (more than half of the matched-token spans cover the text), the
   reply is dropped; the chat service keeps the original verbatim
   reply but logs the high-density event so ops can see prompt drift.

The scrubber is pure: same input → same output → same log. No DB
access, no IO. Sprint C removed the legacy assumption-list pass; only
``scrub_questions`` (the chat reply path) remains.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

# Jargon density above which a reply is dropped instead of rewritten.
# Measured as the fraction of the text character count covered by
# forbidden-word spans. 0.5 = "more than half the prose is jargon —
# there's nothing left to keep."
DROP_THRESHOLD: float = 0.5


@dataclass(frozen=True)
class ScrubLogEntry:
    """One audit entry. Persisted as a dict on the chat-call audit row."""

    slot_key: str
    original_statement: str
    rewritten_statement: str | None
    matched_words: tuple[str, ...]
    action: str  # "rewrite" | "drop"

    def to_dict(self) -> dict[str, Any]:
        return {
            "slot_key": self.slot_key,
            "original": self.original_statement,
            "rewritten": self.rewritten_statement,
            "matched_words": list(self.matched_words),
            "action": self.action,
        }


def _compile_pattern(forbidden: Iterable[str]) -> re.Pattern[str] | None:
    """Build a single word-boundary regex that matches any forbidden word.

    Multi-word phrases (e.g. ``"foreign key"``) are escaped and joined
    with ``\\b`` boundaries so they only match as whole tokens. Returns
    ``None`` when the list is empty so callers can short-circuit.
    """
    cleaned = sorted(
        {w.strip().lower() for w in forbidden if w and w.strip()}, key=len, reverse=True
    )
    if not cleaned:
        return None
    parts = [re.escape(w) for w in cleaned]
    return re.compile(
        r"(?<![A-Za-z0-9])(?:" + "|".join(parts) + r")(?![A-Za-z0-9])",
        re.IGNORECASE,
    )


def _matches_with_spans(text: str, pattern: re.Pattern[str]) -> tuple[list[str], int]:
    """Return ``(matched_words, total_covered_chars)`` for one text body.

    Spans are merged before counting so overlapping matches don't
    inflate the density score.
    """
    spans: list[tuple[int, int]] = []
    matches: list[str] = []
    for m in pattern.finditer(text):
        spans.append((m.start(), m.end()))
        matches.append(m.group(0).lower())
    if not spans:
        return [], 0
    spans.sort()
    merged: list[tuple[int, int]] = [spans[0]]
    for start, end in spans[1:]:
        prev_start, prev_end = merged[-1]
        if start <= prev_end:
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))
    covered = sum(e - s for s, e in merged)
    return matches, covered


def _rewrite_with_glossary(text: str, glossary: dict[str, str]) -> str:
    """Replace any glossary key (case-insensitive whole-word match) with
    its canonical phrasing. Multi-word keys are supported. The first
    letter of the replacement preserves the original's case so
    sentence-initial replacements don't introduce stray lowercase.
    """
    if not glossary:
        return text
    keys_sorted = sorted(glossary.keys(), key=len, reverse=True)
    pattern = re.compile(
        r"(?<![A-Za-z0-9])(?:" + "|".join(re.escape(k) for k in keys_sorted) + r")(?![A-Za-z0-9])",
        re.IGNORECASE,
    )

    def repl(m: re.Match[str]) -> str:
        original = m.group(0)
        lowered = original.lower()
        replacement = next(
            (v for k, v in glossary.items() if k.lower() == lowered),
            original,
        )
        if original and original[0].isupper() and replacement:
            replacement = replacement[0].upper() + replacement[1:]
        return replacement

    return pattern.sub(repl, text)


@dataclass(frozen=True)
class QuestionScrubResult:
    """Aggregate output of one scrub pass over the chat assistant
    reply (or any ``list[str]`` of text bodies).

    ``kept`` mirrors the input minus dropped strings (with low-density
    glossary rewrites applied). ``log`` carries the per-action audit
    entries with slot keys prefixed ``q_<index>``.
    """

    kept: list[str]
    log: list[ScrubLogEntry]


def scrub_questions(
    questions: list[str],
    *,
    forbidden_words: list[str],
    glossary: dict[str, str] | None = None,
) -> QuestionScrubResult:
    """Apply the forbidden-words / density-drop policy to a list of
    plain text strings.

    Used by :meth:`ChatService.run_turn` to scrub the model's reply
    before persisting it on ``feedback_chat_session.messages``. The
    chat reply is wrapped in a one-element list so the same logic
    reused across the codebase is unified.
    """
    pattern = _compile_pattern(forbidden_words)
    glossary_map = glossary or {}
    kept: list[str] = []
    log: list[ScrubLogEntry] = []

    for idx, raw in enumerate(questions):
        text = str(raw or "").strip()
        slot_key = f"q_{idx}"

        if pattern is None or not text:
            kept.append(text)
            continue

        matches, covered = _matches_with_spans(text, pattern)
        if not matches:
            kept.append(text)
            continue

        density = covered / max(1, len(text))
        if density >= DROP_THRESHOLD:
            log.append(
                ScrubLogEntry(
                    slot_key=slot_key,
                    original_statement=text,
                    rewritten_statement=None,
                    matched_words=tuple(sorted(set(matches))),
                    action="drop",
                )
            )
            continue

        rewritten = _rewrite_with_glossary(text, glossary_map)
        if rewritten != text:
            kept.append(rewritten)
            log.append(
                ScrubLogEntry(
                    slot_key=slot_key,
                    original_statement=text,
                    rewritten_statement=rewritten,
                    matched_words=tuple(sorted(set(matches))),
                    action="rewrite",
                )
            )
        else:
            kept.append(text)
            log.append(
                ScrubLogEntry(
                    slot_key=slot_key,
                    original_statement=text,
                    rewritten_statement=None,
                    matched_words=tuple(sorted(set(matches))),
                    action="rewrite",
                )
            )

    return QuestionScrubResult(kept=kept, log=log)
