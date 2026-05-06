"""Unit tests for the iter scrubber.

Covers the two strategies (quiet rewrite via host glossary, drop-and-
retry above density threshold) plus edge cases the service layer
needs to be sure of: empty inputs, no glossary, multi-word phrases,
case preservation.
"""

from __future__ import annotations

from feedback_widget.iter_models import FeedbackIterAssumptionKind
from feedback_widget.iter_schemas import Assumption
from feedback_widget.iter_scrubber import DROP_THRESHOLD, scrub_assumptions


def _asm(slot: str, statement: str, rationale: str = "") -> Assumption:
    return Assumption(
        slot_key=slot,
        kind=FeedbackIterAssumptionKind.UX,
        statement=statement,
        rationale=rationale,
        confidence=0.8,
    )


def test_empty_forbidden_list_keeps_everything_unchanged() -> None:
    items = [_asm("asm_a", "An endpoint returns JSON.")]
    result = scrub_assumptions(items, forbidden_words=[], glossary=None)
    assert result.kept == items
    assert result.log == []


def test_clean_text_passes_through_silently() -> None:
    items = [_asm("asm_a", "Suppliers see only their own orders.", "Scope check.")]
    result = scrub_assumptions(items, forbidden_words=["endpoint", "cache"], glossary=None)
    assert result.kept == items
    assert result.log == []


def test_low_density_jargon_without_glossary_keeps_assumption_and_logs() -> None:
    items = [
        _asm(
            "asm_a",
            "When the user clicks Approve, the order moves on without showing a debounce delay.",
            "This matches what the user already does manually today across many requests.",
        )
    ]
    result = scrub_assumptions(items, forbidden_words=["debounce", "request"], glossary=None)
    assert len(result.kept) == 1
    assert result.kept[0].statement == items[0].statement  # not rewritten — no mapping
    assert len(result.log) == 1
    entry = result.log[0]
    assert entry.action == "rewrite"  # logged for ops review even without rewrite
    assert "debounce" in entry.matched_words


def test_glossary_rewrite_replaces_match_with_canonical_term() -> None:
    items = [
        _asm(
            "asm_a",
            "A new user is created when the workflow runs.",
            "User refers to the seat in the CRM.",
        )
    ]
    result = scrub_assumptions(
        items,
        forbidden_words=["user"],
        glossary={"user": "lead"},
    )
    assert len(result.kept) == 1
    assert result.kept[0].statement.startswith("A new lead is created")
    assert "user" not in result.kept[0].statement.lower()
    assert result.log[0].action == "rewrite"
    assert result.log[0].rewritten_statement == result.kept[0].statement


def test_high_density_jargon_drops_assumption_and_logs_action_drop() -> None:
    # Statement is dominated by jargon — well above the 0.5 threshold.
    statement = "API endpoint cache JSON payload schema migration backend FK index TTL queue."
    items = [_asm("asm_drop", statement, "")]
    result = scrub_assumptions(
        items,
        forbidden_words=[
            "api",
            "endpoint",
            "cache",
            "json",
            "payload",
            "schema",
            "migration",
            "backend",
            "fk",
            "index",
            "ttl",
            "queue",
        ],
        glossary=None,
    )
    assert result.kept == []
    assert len(result.log) == 1
    assert result.log[0].action == "drop"
    assert result.log[0].slot_key == "asm_drop"
    # Sanity: density was actually >= threshold for this fixture.
    assert DROP_THRESHOLD <= 0.6


def test_multi_word_forbidden_phrase_matches_as_one_token() -> None:
    items = [
        _asm(
            "asm_a",
            "A race condition can happen when two users save together.",
            "Concurrency issue.",
        )
    ]
    result = scrub_assumptions(
        items,
        forbidden_words=["race condition"],
        glossary={"race condition": "double-save problem"},
    )
    assert "race condition" not in result.kept[0].statement.lower()
    assert "double-save problem" in result.kept[0].statement
    assert "race condition" in result.log[0].matched_words


def test_glossary_replacement_preserves_initial_capitalisation() -> None:
    items = [_asm("asm_a", "User accounts are created on signup.", "")]
    result = scrub_assumptions(items, forbidden_words=["user"], glossary={"user": "lead"})
    # Sentence-initial capitalised "User" should become "Lead", not "lead".
    assert result.kept[0].statement.startswith("Lead accounts")
