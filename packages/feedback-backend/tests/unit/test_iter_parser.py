"""Unit tests for the iter output parser.

Exercises:

* happy-path JSON → IterationOutput round-trip (via FakeLLMProvider)
* business-rule violations: too many personas, story persona FK miss,
  duplicate slot keys, ``remove`` op without restructure flag
* one-retry repair on malformed JSON, then success
"""

from __future__ import annotations

import asyncio
import json

import pytest

from feedback_widget.iter_llm import FakeLLMProvider
from feedback_widget.iter_parser import (
    IterationParseError,
    parse_iteration_output,
    parse_with_one_retry,
)


def test_fake_provider_output_parses_cleanly() -> None:
    fake = FakeLLMProvider()
    result = asyncio.run(
        fake.generate(
            system_prompt="SYS",
            user_prompt="USR",
            attachments=[],
            timeout_seconds=5,
            max_output_tokens=4_000,
        )
    )
    output = parse_iteration_output(result.raw_text, restructure_allowed=False)
    assert output.schema_version == "1"
    assert output.language == "en"
    assert len(output.personas) >= 1
    assert all(s.persona_id in {p.id for p in output.personas} for s in output.user_stories)
    assert output.markdown_rendered.startswith("# Working Document")


def _baseline_payload() -> dict[str, object]:
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
        "assumptions": [
            {
                "slot_key": "asm_1",
                "kind": "ux",
                "statement": "s",
                "rationale": "r",
                "confidence": 0.5,
            }
        ],
        "unresolved_questions": [],
        "diff": [],
        "changes_summary": "",
        "archived": [],
        "markdown_rendered": "# X",
    }


def test_persona_fk_missing_is_rejected() -> None:
    bad = _baseline_payload()
    bad["user_stories"][0]["persona_id"] = "p_unknown"  # type: ignore[index]
    with pytest.raises(IterationParseError) as exc_info:
        parse_iteration_output(json.dumps(bad), restructure_allowed=False)
    assert any("unknown persona" in e for e in exc_info.value.errors)


def test_remove_op_blocked_without_restructure() -> None:
    bad = _baseline_payload()
    bad["diff"] = [
        {
            "op": "remove",
            "path": "/personas/0",
            "before": {"id": "p_a"},
            "note": "user asked",
        }
    ]
    with pytest.raises(IterationParseError) as exc_info:
        parse_iteration_output(json.dumps(bad), restructure_allowed=False)
    assert any("not allowed" in e for e in exc_info.value.errors)


def test_remove_op_allowed_with_restructure() -> None:
    payload = _baseline_payload()
    payload["diff"] = [
        {
            "op": "remove",
            "path": "/personas/0",
            "before": {"id": "p_a"},
            "note": "user asked",
        }
    ]
    output = parse_iteration_output(json.dumps(payload), restructure_allowed=True)
    assert len(output.diff) == 1


def test_duplicate_slot_keys_rejected() -> None:
    payload = _baseline_payload()
    payload["assumptions"] = [
        {
            "slot_key": "asm_dup",
            "kind": "ux",
            "statement": "s",
            "rationale": "r",
            "confidence": 0.5,
        },
        {
            "slot_key": "asm_dup",
            "kind": "scope",
            "statement": "t",
            "rationale": "r",
            "confidence": 0.4,
        },
    ]
    with pytest.raises(IterationParseError) as exc_info:
        parse_iteration_output(json.dumps(payload), restructure_allowed=False)
    assert any("duplicate assumption slot_keys" in e for e in exc_info.value.errors)


def test_one_retry_recovers_from_malformed_json() -> None:
    """First attempt returns junk; retry returns valid JSON. Result
    is the valid IterationOutput plus attempts=2."""
    valid_payload = json.dumps(_baseline_payload())

    async def runner_returning_valid_on_second_call(_repaired_prompt: str) -> str:
        return valid_payload

    output, attempts = asyncio.run(
        parse_with_one_retry(
            raw_first_attempt="this is not JSON",
            user_prompt="USR",
            restructure_allowed=False,
            second_attempt_runner=runner_returning_valid_on_second_call,
        )
    )
    assert attempts == 2
    assert output.schema_version == "1"


def test_one_retry_propagates_when_second_also_fails() -> None:
    async def always_junk(_repaired_prompt: str) -> str:
        return "{still junk"

    with pytest.raises(IterationParseError):
        asyncio.run(
            parse_with_one_retry(
                raw_first_attempt="garbage",
                user_prompt="USR",
                restructure_allowed=False,
                second_attempt_runner=always_junk,
            )
        )
