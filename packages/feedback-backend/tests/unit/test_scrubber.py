"""Unit tests for the chat-first jargon scrubber.

Covers the two strategies (quiet rewrite via host glossary, drop-and-
retry above density threshold) plus edge cases the service layer
needs to be sure of: empty inputs, no glossary, multi-word phrases,
case preservation.

Sprint C removed the legacy ``scrub_assumptions`` path that depended
on the iter ``Assumption`` model; only ``scrub_questions`` remains.
"""

from __future__ import annotations

from feedback_widget.scrubber import (
    DROP_THRESHOLD,
    scrub_questions,
)


def test_empty_forbidden_list_keeps_everything_unchanged() -> None:
    out = scrub_questions(
        ["An endpoint returns JSON."],
        forbidden_words=[],
        glossary=None,
    )
    assert out.kept == ["An endpoint returns JSON."]
    assert out.log == []


def test_clean_text_passes_through_silently() -> None:
    out = scrub_questions(
        ["Suppliers see only their own orders."],
        forbidden_words=["endpoint", "cache"],
        glossary=None,
    )
    assert out.kept == ["Suppliers see only their own orders."]
    assert out.log == []


def test_low_density_jargon_without_glossary_keeps_text_and_logs() -> None:
    text = (
        "When the user clicks Approve, the order moves on without "
        "showing a debounce delay across many requests."
    )
    out = scrub_questions(
        [text],
        forbidden_words=["debounce", "request"],
        glossary=None,
    )
    assert out.kept == [text]
    assert len(out.log) == 1
    entry = out.log[0]
    assert entry.action == "rewrite"  # logged for ops review
    assert "debounce" in entry.matched_words


def test_glossary_rewrites_quietly() -> None:
    text = "The cache should refresh nightly."
    out = scrub_questions(
        [text],
        forbidden_words=["cache"],
        glossary={"cache": "saved snapshot"},
    )
    # Original match "cache" is lowercase → replacement keeps lowercase.
    assert out.kept == ["The saved snapshot should refresh nightly."]
    assert len(out.log) == 1
    assert out.log[0].action == "rewrite"
    assert out.log[0].rewritten_statement == out.kept[0]


def test_glossary_preserves_sentence_initial_case() -> None:
    text = "Cache invalidations are tricky."
    out = scrub_questions(
        [text],
        forbidden_words=["cache"],
        glossary={"cache": "saved snapshot"},
    )
    # "Cache" capitalised → replacement starts capitalised too.
    assert out.kept == ["Saved snapshot invalidations are tricky."]


def test_high_density_drops_the_reply() -> None:
    # Roughly all jargon — density exceeds DROP_THRESHOLD.
    text = "endpoint cache jwt cookie oauth jwt cache endpoint"
    out = scrub_questions(
        [text],
        forbidden_words=["endpoint", "cache", "jwt", "cookie", "oauth"],
        glossary=None,
    )
    assert out.kept == []  # dropped entirely
    assert len(out.log) == 1
    assert out.log[0].action == "drop"


def test_drop_threshold_is_a_sane_default() -> None:
    """Guardrail: changing DROP_THRESHOLD without re-evaluating tests
    above silently changes admin-visible behaviour."""
    assert 0.0 < DROP_THRESHOLD < 1.0
    assert DROP_THRESHOLD == 0.5


def test_multi_word_phrase_match() -> None:
    out = scrub_questions(
        ["The foreign key links the rows."],
        forbidden_words=["foreign key"],
        glossary={"foreign key": "link"},
    )
    # "foreign key" matched lowercase → replacement stays lowercase.
    assert out.kept[0] == "The link links the rows."


def test_empty_question_is_kept_as_empty_string() -> None:
    out = scrub_questions(
        ["", "ok"],
        forbidden_words=["endpoint"],
        glossary=None,
    )
    assert out.kept == ["", "ok"]
    assert out.log == []
