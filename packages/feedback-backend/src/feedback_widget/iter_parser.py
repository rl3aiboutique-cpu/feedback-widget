"""LLM output parser — Pydantic + business rules + retry-once.

Pipeline per spec §6.9:

1. Strip optional code fences (the system prompt forbids them but
   defensively accept them anyway).
2. Parse JSON.
3. Validate against :class:`IterationOutput` (Pydantic).
4. Apply business rules that the schema can't capture in one shot:
   * persona FK validity for each user story
   * stories-per-persona <= 5
   * unique assumption slot_keys
   * no ``remove`` ops when ``restructure_allowed`` is false
5. On any failure raise :class:`IterationParseError`. The
   :func:`parse_with_one_retry` wrapper catches it once and re-asks
   the model with a repair hint; a second failure surfaces to the
   service layer.
"""

from __future__ import annotations

import json
import re
from typing import Any

from pydantic import ValidationError

from .iter_prompts import build_repair_hint
from .iter_schemas import (
    DiffOpRemove,
    IterationOutput,
)

_FENCE_RE = re.compile(
    r"^\s*```(?:json|javascript|js)?\s*\n(.*?)\n\s*```\s*$",
    re.DOTALL | re.IGNORECASE,
)


class IterationParseError(ValueError):
    """LLM produced output that failed JSON parse or business-rule
    validation. Carries a multi-line error description suitable for
    a repair-hint addendum."""

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


def _parse_json(raw: str) -> Any:
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        msg = f"JSON decode failed at line {exc.lineno} col {exc.colno}: {exc.msg}"
        raise IterationParseError("model returned malformed JSON", errors=[msg]) from exc


# Common aliases models reach for when they don't follow the schema
# verbatim. Coerce them in-place before Pydantic validation rather
# than burning a retry round-trip.
_DIFF_OP_ALIASES: dict[str, str] = {
    "replace": "modify",
    "update": "modify",
    "change": "modify",
    "edit": "modify",
    "delete": "remove",
    "obsolete": "mark_obsolete",
    "deprecate": "mark_obsolete",
}


def _coerce_diff_aliases(payload: Any) -> None:
    """Rewrite well-known diff-op aliases to the canonical names."""
    if not isinstance(payload, dict):
        return
    diff = payload.get("diff")
    if not isinstance(diff, list):
        return
    for op in diff:
        if isinstance(op, dict):
            current = op.get("op")
            if isinstance(current, str):
                canonical = _DIFF_OP_ALIASES.get(current.lower())
                if canonical:
                    op["op"] = canonical
                    # ``replace``/``update``-style ops often arrive with
                    # ``value`` instead of the {before, after} pair the
                    # ``modify`` shape requires. Move the field over so
                    # the schema validator accepts it.
                    if canonical == "modify" and "value" in op and "after" not in op:
                        op["after"] = op.pop("value")
                        op.setdefault("before", None)


def _validate_schema(payload: Any) -> IterationOutput:
    try:
        return IterationOutput.model_validate(payload)
    except ValidationError as exc:
        # Render a short, location-aware error list for the repair
        # hint. Avoid dumping the full Pydantic blob — the LLM does
        # better with concise pointers.
        errors = [f"{'/'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()]
        raise IterationParseError("schema validation failed", errors=errors) from exc


def _apply_business_rules(
    output: IterationOutput,
    *,
    restructure_allowed: bool,
) -> None:
    errors: list[str] = []

    # Persona-FK validity + stories-per-persona cap.
    persona_ids = {p.id for p in output.personas}
    persona_id_list = [p.id for p in output.personas]
    duplicate_persona_ids = [pid for pid in persona_id_list if persona_id_list.count(pid) > 1]
    if duplicate_persona_ids:
        errors.append("duplicate persona ids: " + ", ".join(sorted(set(duplicate_persona_ids))))

    stories_by_persona: dict[str, int] = {}
    for story in output.user_stories:
        if story.persona_id not in persona_ids:
            errors.append(
                f"user story {story.id!r} references unknown persona {story.persona_id!r}"
            )
        stories_by_persona[story.persona_id] = stories_by_persona.get(story.persona_id, 0) + 1
    for pid, count in stories_by_persona.items():
        if count > 5:
            errors.append(f"persona {pid!r} has {count} stories; cap is 5")

    # Unique assumption slot_keys within this response.
    slot_counts: dict[str, int] = {}
    for asm in output.assumptions:
        slot_counts[asm.slot_key] = slot_counts.get(asm.slot_key, 0) + 1
    duplicates = sorted(k for k, c in slot_counts.items() if c > 1)
    if duplicates:
        errors.append("duplicate assumption slot_keys: " + ", ".join(duplicates))

    # No ``remove`` ops without restructure_allowed.
    if not restructure_allowed:
        for op in output.diff:
            if isinstance(op, DiffOpRemove):
                errors.append(
                    f"diff op 'remove' on path {op.path!r} is not allowed "
                    "when restructure_allowed is false"
                )

    # Story id uniqueness — silent collision would corrupt diff paths.
    story_ids = [s.id for s in output.user_stories]
    if len(story_ids) != len(set(story_ids)):
        dupes = sorted({sid for sid in story_ids if story_ids.count(sid) > 1})
        errors.append("duplicate user-story ids: " + ", ".join(dupes))

    if errors:
        raise IterationParseError("business-rule validation failed", errors=errors)


_DIAGRAM_HEADING_RE = re.compile(
    r"^(#{1,6}\s*Diagram(?:\s|$).*)$",
    re.MULTILINE | re.IGNORECASE,
)
# Mermaid-style declarations the model commonly drops as bare text.
# Anchored to start-of-line and a small whitelist of Mermaid kinds
# so we don't false-positive on prose.
_MERMAID_OPENER_RE = re.compile(
    r"^(graph\s+(?:TB|TD|BT|RL|LR)\b|flowchart\s+(?:TB|TD|BT|RL|LR)\b|sequenceDiagram\b|"
    r"classDiagram\b|stateDiagram(?:-v2)?\b|erDiagram\b|gantt\b|pie\b|"
    r"journey\b|mindmap\b|timeline\b)",
    re.MULTILINE,
)


def normalise_markdown_diagrams(md: str) -> str:
    r"""Wrap unfenced Mermaid / ASCII diagram bodies that follow a
    Diagram heading in a code fence.

    Open-weight models routinely emit the Diagram section's body as
    bare text (``# Diagram\ngraph LR\n  A --> B``) instead of
    wrapping it in a fenced code block. The bare text reads as
    paragraph soup on every Markdown renderer that doesn't have a
    Mermaid plugin (we don't bundle one).

    Pure string→string and idempotent on already-fenced input, so
    the read-side DTO mapper can apply this to legacy rows that
    pre-date the parse-time normaliser without a data migration.
    """
    if not md:
        return md
    lines = md.split("\n")
    result: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Already inside a fence — copy through to the closing fence.
        if line.lstrip().startswith("```"):
            result.append(line)
            i += 1
            while i < len(lines) and not lines[i].lstrip().startswith("```"):
                result.append(lines[i])
                i += 1
            if i < len(lines):
                result.append(lines[i])
                i += 1
            continue

        if _DIAGRAM_HEADING_RE.match(line):
            result.append(line)
            i += 1
            # Skip blank lines between heading and body.
            while i < len(lines) and lines[i].strip() == "":
                result.append(lines[i])
                i += 1
            if i >= len(lines):
                continue
            # Already fenced? Pass through.
            if lines[i].lstrip().startswith("```"):
                continue
            # Detect Mermaid vs. ASCII art for the lang hint.
            body_start = i
            is_mermaid = bool(_MERMAID_OPENER_RE.match(lines[i].lstrip()))
            # Pull lines until we hit the next ATX heading or EOF.
            while i < len(lines) and not lines[i].lstrip().startswith("#"):
                i += 1
            body_end = i
            body = "\n".join(lines[body_start:body_end]).rstrip()
            # Leave a trailing blank line if the original had one.
            trailing_blank = body_end > body_start and lines[body_end - 1].strip() == ""
            lang = "mermaid" if is_mermaid else "text"
            result.append(f"```{lang}")
            result.append(body)
            result.append("```")
            if trailing_blank:
                result.append("")
            continue

        result.append(line)
        i += 1
    return "\n".join(result)


def _normalise_unfenced_diagrams(payload: Any) -> None:
    """Dict-mutation adapter for the parse pipeline. Runs the public
    :func:`normalise_markdown_diagrams` over ``payload["markdown_rendered"]``."""
    if not isinstance(payload, dict):
        return
    md = payload.get("markdown_rendered")
    if isinstance(md, str) and md:
        payload["markdown_rendered"] = normalise_markdown_diagrams(md)


def parse_iteration_output(
    raw_text: str,
    *,
    restructure_allowed: bool,
) -> IterationOutput:
    """Parse + validate a single LLM response. Raises on any defect."""
    cleaned = _strip_fences(raw_text)
    payload = _parse_json(cleaned)
    _coerce_diff_aliases(payload)
    _normalise_unfenced_diagrams(payload)
    output = _validate_schema(payload)
    _apply_business_rules(output, restructure_allowed=restructure_allowed)
    return output


# ────────────────────────────────────────────────────────────────────
# Retry-once wrapper
# ────────────────────────────────────────────────────────────────────


async def parse_with_one_retry(
    *,
    raw_first_attempt: str,
    user_prompt: str,
    restructure_allowed: bool,
    second_attempt_runner: SecondAttemptRunner,
) -> tuple[IterationOutput, int]:
    """Parse the first response; on failure, ask the model once more
    with a repair hint. Returns ``(output, attempts)`` where
    ``attempts`` is 1 or 2.
    """
    try:
        return (
            parse_iteration_output(
                raw_first_attempt,
                restructure_allowed=restructure_allowed,
            ),
            1,
        )
    except IterationParseError as first_err:
        repair_hint = build_repair_hint(first_err.render_for_repair_hint())
        retried_user_prompt = user_prompt + repair_hint
        raw_second = await second_attempt_runner(retried_user_prompt)
        return (
            parse_iteration_output(
                raw_second,
                restructure_allowed=restructure_allowed,
            ),
            2,
        )


# ── Typing-only helper ──────────────────────────────────────────────
# The runner is a callable the service layer passes in; declared
# here as a Protocol for clarity without dragging the LLM provider
# import into this module.

from typing import Protocol  # noqa: E402 — kept at bottom for clarity


class SecondAttemptRunner(Protocol):
    async def __call__(self, repaired_user_prompt: str) -> str: ...
