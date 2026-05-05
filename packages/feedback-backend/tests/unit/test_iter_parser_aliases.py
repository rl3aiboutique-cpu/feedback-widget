"""Tests for the diff-op alias coercion the parser does before
schema validation. Open-weight models routinely produce
``replace``/``update`` instead of ``modify``; we silently
canonicalise rather than burning a retry round-trip."""

from __future__ import annotations

import json

from feedback_widget.iter_parser import parse_iteration_output


def _baseline() -> dict[str, object]:
    return {
        "schema_version": "1",
        "language": "en",
        "personas": [
            {
                "id": "p_a",
                "name": "Alice",
                "role": "admin",
                "goals": [],
                "pain_points": [],
                "context": "test",
            }
        ],
        "user_stories": [
            {
                "id": "us_1",
                "persona_id": "p_a",
                "title": "T",
                "story": {"as_a": "a", "i_want": "b", "so_that": "c"},
                "acceptance_criteria": [
                    {"scenario": "s", "given": ["g"], "when": ["w"], "then": ["t"]}
                ],
            }
        ],
        "spec": {"title": "T", "summary": "S", "sections": []},
        "diagram": {"format": "ascii", "source": "x", "caption": "c"},
        "assumptions": [],
        "unresolved_questions": [],
        "diff": [],
        "changes_summary": "",
        "archived": [],
        "markdown_rendered": "# X",
    }


def test_replace_is_coerced_to_modify() -> None:
    payload = _baseline()
    payload["diff"] = [
        {
            "op": "replace",
            "path": "/spec/sections/0/body_markdown",
            "before": "old text",
            "after": "new text",
        }
    ]
    output = parse_iteration_output(json.dumps(payload), restructure_allowed=False)
    assert len(output.diff) == 1
    assert output.diff[0].op == "modify"


def test_replace_with_value_only_gets_after_filled() -> None:
    payload = _baseline()
    payload["diff"] = [
        {
            "op": "replace",
            "path": "/spec/sections/0/body_markdown",
            "value": "the replacement text",
        }
    ]
    output = parse_iteration_output(json.dumps(payload), restructure_allowed=False)
    assert output.diff[0].op == "modify"
    assert output.diff[0].after == "the replacement text"  # type: ignore[union-attr]


def test_delete_is_blocked_when_restructure_disallowed() -> None:
    payload = _baseline()
    payload["diff"] = [
        {
            "op": "delete",
            "path": "/personas/0",
            "before": {"id": "p_a"},
            "note": "user asked",
        }
    ]
    # delete -> remove. Under restructure_allowed=False, the parser
    # business-rule check fires.
    import pytest

    from feedback_widget.iter_parser import IterationParseError

    with pytest.raises(IterationParseError):
        parse_iteration_output(json.dumps(payload), restructure_allowed=False)


def test_obsolete_alias_canonicalises() -> None:
    payload = _baseline()
    payload["diff"] = [
        {
            "op": "obsolete",
            "path": "/personas/0",
            "reason": "no longer relevant",
        }
    ]
    output = parse_iteration_output(json.dumps(payload), restructure_allowed=False)
    assert output.diff[0].op == "mark_obsolete"
