"""Server-side jargon scrubber for iter assumption text.

The system prompt forbids technical vocabulary (``endpoint``, ``cache``,
``debounce``, etc.) inside assumption ``statement`` and ``rationale``,
but Gemma-class open-weight models do not honour negative instructions
reliably. This module is the safety net: it runs after the parser
validates the JSON shape but before persistence, so the user never
sees jargon the prompt already promised wouldn't appear.

Two-strategy approach:

1. **Quiet rewrite.** When forbidden words appear AND a host glossary
   maps them to a canonical domain term, replace in-place. The user
   sees clean prose; the rewrite is recorded in ``scrub_log`` for
   audit.
2. **Drop-and-retry.** When a single assumption is at least 50 %
   jargon (more than half of the matched-token spans cover the
   text), discard the assumption entirely. The session's turn
   counter is *not* decremented — counting drops would let a
   misbehaving model burn budget unfairly. Drops are logged with
   ``action="drop"``.

The scrubber is pure: same input → same output → same log. No DB
access, no IO. The service layer calls :func:`scrub_assumptions`
once per successful parse and persists the returned log entries on
the ``FeedbackIterCall.scrub_log`` column.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

# Jargon density above which an assumption is dropped instead of
# rewritten. Measured as the fraction of the statement+rationale
# character count covered by forbidden-word spans. 0.5 = "more than
# half the prose is jargon — there's nothing left to keep."
DROP_THRESHOLD: float = 0.5


@dataclass(frozen=True)
class ScrubLogEntry:
    """One audit entry. Persisted as a dict on ``FeedbackIterCall.scrub_log``."""

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


@dataclass(frozen=True)
class ScrubResult:
    """Aggregate output of one scrub pass.

    ``kept`` is the assumption list to persist (mirrors the input
    minus dropped ones, with statement/rationale potentially rewritten).
    ``log`` is the per-action audit trail.
    """

    kept: list[Any]  # list of `Assumption` from iter_schemas; typed loose to avoid cycle
    log: list[ScrubLogEntry]


def _compile_pattern(forbidden: Iterable[str]) -> re.Pattern[str] | None:
    """Build a single word-boundary regex that matches any forbidden word.

    Multi-word phrases (e.g. ``"foreign key"``) are escaped and joined
    with ``\b`` boundaries so they only match as whole tokens. Returns
    ``None`` when the list is empty so callers can short-circuit.
    """
    cleaned = sorted(
        {w.strip().lower() for w in forbidden if w and w.strip()}, key=len, reverse=True
    )
    if not cleaned:
        return None
    parts = [re.escape(w) for w in cleaned]
    return re.compile(r"(?<![A-Za-z0-9])(?:" + "|".join(parts) + r")(?![A-Za-z0-9])", re.IGNORECASE)


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
    """Replace any glossary key (case-insensitive whole-word match)
    with its canonical phrasing. Multi-word keys are supported.

    The first letter of the replacement preserves the original's case
    so sentence-initial replacements don't introduce stray lowercase.
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
        # Find the glossary key that matched (case-insensitive).
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
    """Aggregate output for the unresolved-questions scrub pass.

    ``kept`` mirrors the input minus dropped strings (with low-density
    glossary rewrites applied). ``log`` carries the per-action audit
    entries with slot keys prefixed ``q_<index>`` so admins can tell
    them apart from assumption entries when reading
    ``feedback_iter_call.scrub_log`` rows.
    """

    kept: list[str]
    log: list[ScrubLogEntry]


def scrub_questions(
    questions: list[str],
    *,
    forbidden_words: list[str],
    glossary: dict[str, str] | None = None,
) -> QuestionScrubResult:
    """Apply the same forbidden-words / density-drop policy used for
    assumptions to the model's ``unresolved_questions`` array.

    The questions block is plain ``list[str]`` in
    :class:`IterationOutput`, so this function takes and returns the
    same shape — no Pydantic copy gymnastics required.
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
            # Low-density jargon, no glossary mapping — keep but log
            # so ops can extend the glossary if the leak repeats.
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


def scrub_assumptions(
    assumptions: list[Any],
    *,
    forbidden_words: list[str],
    glossary: dict[str, str] | None = None,
) -> ScrubResult:
    """Apply jargon scrubbing to a list of parsed assumptions.

    ``assumptions`` items must expose ``slot_key``, ``statement``,
    ``rationale``, and (optionally) ``options`` attributes — i.e. the
    Pydantic ``Assumption`` model from :mod:`iter_schemas`. The function
    returns a fresh list (does not mutate the input) plus the audit log.
    """
    pattern = _compile_pattern(forbidden_words)
    glossary_map = glossary or {}
    kept: list[Any] = []
    log: list[ScrubLogEntry] = []

    for asm in assumptions:
        original_statement = str(getattr(asm, "statement", "") or "")
        original_rationale = str(getattr(asm, "rationale", "") or "")
        combined = f"{original_statement}\n{original_rationale}"

        if pattern is None:
            kept.append(asm)
            continue

        matches, covered = _matches_with_spans(combined, pattern)
        if not matches:
            kept.append(asm)
            continue

        density = covered / max(1, len(combined))
        if density >= DROP_THRESHOLD:
            log.append(
                ScrubLogEntry(
                    slot_key=str(getattr(asm, "slot_key", "")),
                    original_statement=original_statement,
                    rewritten_statement=None,
                    matched_words=tuple(sorted(set(matches))),
                    action="drop",
                )
            )
            continue

        # Rewrite via glossary where possible; otherwise the matches
        # remain as-is and we only log them. This is intentional —
        # silently mangling unmapped jargon would change meaning;
        # logging it gives the operator the signal to extend the
        # glossary or update the prompt.
        new_statement = _rewrite_with_glossary(original_statement, glossary_map)
        new_rationale = _rewrite_with_glossary(original_rationale, glossary_map)
        rewritten = new_statement != original_statement or new_rationale != original_rationale

        if rewritten:
            patched = asm.model_copy(
                update={"statement": new_statement, "rationale": new_rationale}
            )
            kept.append(patched)
            log.append(
                ScrubLogEntry(
                    slot_key=str(getattr(asm, "slot_key", "")),
                    original_statement=original_statement,
                    rewritten_statement=new_statement,
                    matched_words=tuple(sorted(set(matches))),
                    action="rewrite",
                )
            )
        else:
            # No glossary mapping for the matched words, density below
            # drop threshold — keep the assumption but record the
            # prompt drift for ops review.
            kept.append(asm)
            log.append(
                ScrubLogEntry(
                    slot_key=str(getattr(asm, "slot_key", "")),
                    original_statement=original_statement,
                    rewritten_statement=None,
                    matched_words=tuple(sorted(set(matches))),
                    action="rewrite",
                )
            )

    return ScrubResult(kept=kept, log=log)
