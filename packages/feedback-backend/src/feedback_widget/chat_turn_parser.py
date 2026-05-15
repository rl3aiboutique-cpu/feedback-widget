"""Parse one capture-mode turn response from the LLM.

Output shape (D-015 + Sprint B / capture_v3)::

    {
      "mode": "discover" | "synthesize",
      "reply": "<= 25 words in user's language>",
      "covered": { problem, context, expectation, reality, impact,
                   change, example, importance },  # all 0..1
      "active_branch": "1|2|3|4|5|6|leaf",
      "inferred": { "type": "...", "severity": "..." },
      "synthesis": null | {
          # Always-required base fields:
          title, summary, user_story, context, user_need,
          acceptance_criteria, open_questions,
          # Sprint B / capture_v3 — legacy iter-module parity. Each is
          # optional so older prompt versions and incomplete syntheses
          # still pass parsing:
          personas: [{name, goal, frustration}],
          user_stories: [<canonical "As a / I want / so that" lines>],
          assumptions: [<plain-language assumptions>],
          diagram: "<optional Mermaid source or null>"
      }
    }

We deliberately keep the synthesis sub-object loose — the parser
validates only the top-level shape (``synthesis`` is a dict or null).
Sprint B optional fields land tolerantly: if the model omits them
the row still saves, if the model includes them the frontend
SynthesisCard renders the extras. Repair-hint loop mirrors the iter
parser's ``parse_with_one_retry`` semantics.
"""

from __future__ import annotations

import json
import re
from collections.abc import Awaitable, Callable
from typing import Any

# Same fence regex iter_parser.py uses — open-weight models love to
# wrap JSON in code fences despite the system prompt forbidding it.
_FENCE_RE = re.compile(
    r"^\s*```(?:json|javascript|js)?\s*\n(.*?)\n\s*```\s*$",
    re.DOTALL | re.IGNORECASE,
)

# The 8 coverage dimensions D-015 lists. Order is not contractual but
# we enforce presence so downstream code (early-exit check at
# covered_total ≥ 0.7) sees a stable shape.
_COVERED_KEYS: tuple[str, ...] = (
    "problem",
    "context",
    "expectation",
    "reality",
    "impact",
    "change",
    "example",
    "importance",
)

_VALID_MODES: frozenset[str] = frozenset({"discover", "synthesize"})


class ChatTurnParseError(ValueError):
    """Model produced output that failed JSON parse or shape validation."""

    def __init__(self, message: str, *, errors: list[str]) -> None:
        super().__init__(message)
        self.errors = errors

    def render_for_repair_hint(self) -> str:
        return "\n".join(f"- {e}" for e in self.errors)


def _strip_fences(raw: str) -> str:
    match = _FENCE_RE.match(raw.strip())
    if match:
        return match.group(1).strip()
    return raw.strip()


def _validate_covered(covered: Any, errors: list[str]) -> dict[str, float]:
    """Ensure all 8 keys are present and values are clamped to [0, 1]."""
    if not isinstance(covered, dict):
        errors.append("'covered' must be an object with 8 numeric fields")
        return dict.fromkeys(_COVERED_KEYS, 0.0)
    normalised: dict[str, float] = {}
    for k in _COVERED_KEYS:
        v = covered.get(k, 0.0)
        if not isinstance(v, int | float):
            errors.append(f"covered.{k} must be a number 0..1, got {type(v).__name__}")
            normalised[k] = 0.0
            continue
        normalised[k] = max(0.0, min(1.0, float(v)))
    return normalised


def parse_turn_response(raw: str) -> dict[str, Any]:
    """Parse + lightly validate a single turn payload.

    Returns a dict with the same key set as D-015. Missing optional
    fields (``inferred``, ``synthesis``) default to ``None`` /
    sensible empty values; missing REQUIRED fields raise.
    """
    cleaned = _strip_fences(raw)
    errors: list[str] = []
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        msg = f"JSON decode failed at line {exc.lineno} col {exc.colno}: {exc.msg}"
        raise ChatTurnParseError("model returned malformed JSON", errors=[msg]) from exc

    if not isinstance(payload, dict):
        raise ChatTurnParseError(
            "top-level value must be a JSON object",
            errors=[f"got {type(payload).__name__}"],
        )

    mode = payload.get("mode")
    if mode not in _VALID_MODES:
        errors.append(f"'mode' must be one of {sorted(_VALID_MODES)}, got {mode!r}")

    reply = payload.get("reply")
    if not isinstance(reply, str) or not reply.strip():
        errors.append("'reply' must be a non-empty string")
        reply = ""

    covered = _validate_covered(payload.get("covered"), errors)

    active_branch = payload.get("active_branch")
    if not isinstance(active_branch, str) or not active_branch.strip():
        errors.append("'active_branch' must be a non-empty string (1..6 or 'leaf')")
        active_branch = ""

    inferred = payload.get("inferred") or None
    if inferred is not None and not isinstance(inferred, dict):
        errors.append("'inferred' must be null or an object")
        inferred = None

    synthesis = payload.get("synthesis")
    if synthesis is not None and not isinstance(synthesis, dict):
        errors.append("'synthesis' must be null or an object")
        synthesis = None

    # On synthesize mode the prompt requires a non-null synthesis
    # object — surface as a parse error so the repair loop can fix
    # it before the service persists the turn.
    if mode == "synthesize" and not isinstance(synthesis, dict):
        errors.append("'synthesis' must be an object when mode='synthesize'")

    # Sprint C — structured validation of the synthesis payload via the
    # ``ChatSynthesis`` Pydantic model (paridad legacy iter). When the
    # model emits a shape we cannot coerce, surface as a parse error so
    # the repair loop can re-prompt. Importing locally avoids a circular
    # import (chat_schemas → models → exceptions).
    if isinstance(synthesis, dict):
        from feedback_widget.chat_schemas import ChatSynthesis
        from pydantic import ValidationError as _ValidationError

        try:
            validated = ChatSynthesis.model_validate(synthesis)
        except _ValidationError as exc:
            # Surface the first 3 validation errors so the repair hint
            # stays compact and the model can correct shape directly.
            for err in exc.errors()[:3]:
                loc = ".".join(str(p) for p in err.get("loc", ()))
                errors.append(f"synthesis.{loc}: {err.get('msg', 'invalid')}")
        else:
            # Re-export as plain dict so downstream JSONB persistence
            # keeps shape predictable (Pydantic drops extras).
            synthesis = validated.model_dump(mode="json")

    if errors:
        raise ChatTurnParseError("turn response failed shape validation", errors=errors)

    return {
        "mode": mode,
        "reply": reply,
        "covered": covered,
        "active_branch": active_branch,
        "inferred": inferred,
        "synthesis": synthesis,
    }


def build_repair_hint(validation_errors: str) -> str:
    """Repair-hint addendum sent on retry. Mirrors iter_prompts shape."""
    return (
        "\n"
        "<previous_response_invalid>\n"
        "Your previous response failed validation with the following errors:\n"
        f"{validation_errors}\n\n"
        "Return a STRICT JSON object matching the schema in the system "
        "prompt. No markdown, no comments, no extra text. Keep the same "
        "reply intent; only fix the validation errors.\n"
        "</previous_response_invalid>\n"
    )


async def parse_with_repair(
    raw_first_attempt: str,
    *,
    retry_runner: Callable[[str], Awaitable[str]],
    max_retries: int = 2,
) -> tuple[dict[str, Any], int]:
    """Parse the first response; on failure, re-prompt with repair hint.

    Parameters
    ----------
    raw_first_attempt
        Buffered text from the first ``provider.stream(...)`` pass.
    retry_runner
        Async callable that issues a one-shot non-streaming retry
        carrying the repair hint as an addendum on the user prompt
        (or as a separate system message — caller decides). Returns
        the raw model text for the retry attempt.
    max_retries
        Maximum number of repair attempts AFTER the first parse.
        Defaults to 2 matching the spec § "Error handling" line for
        ``chat_parser repair-hint loop, 2 retries``.

    Returns
    -------
    (parsed_dict, attempts) where ``attempts`` is 1 on first-shot
    success, 2..1+max_retries on subsequent successes.
    """
    try:
        return parse_turn_response(raw_first_attempt), 1
    except ChatTurnParseError as first_err:
        last_err = first_err
        last_raw = raw_first_attempt
        for attempt_index in range(max_retries):
            hint = build_repair_hint(last_err.render_for_repair_hint())
            try:
                raw_retry = await retry_runner(hint)
            except Exception as exc:
                # Wrap so callers can distinguish parse-side failure
                # from provider failure inside the repair loop.
                raise ChatTurnParseError(
                    "repair retry failed before producing JSON",
                    errors=[f"{type(exc).__name__}: {exc}"],
                ) from exc
            last_raw = raw_retry
            try:
                return parse_turn_response(raw_retry), 2 + attempt_index
            except ChatTurnParseError as err:
                last_err = err
                continue
        # Exhausted retries — surface the last error with a context
        # snippet so the service can persist it on the call audit row.
        snippet = (last_raw or "")[:2_000]
        raise ChatTurnParseError(
            "exhausted repair retries",
            errors=[
                *last_err.errors,
                f"--- last raw response (first 2KB) ---\n{snippet}",
            ],
        ) from last_err
