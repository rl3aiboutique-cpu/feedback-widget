"""Pure markdown renderers shared by the iter packager and the admin bundle.

Extracted from :mod:`iter_packager` in v0.4.1 so the admin
``bundle.py`` (LLM hand-off ZIP) can include the same iter artefacts
the packager produces, without depending on the packager's S3 +
orchestration code.

Every function here is pure: input is a Pydantic model (or a sequence
of value objects from :mod:`iter_packager`), output is a Markdown
string. No DB access, no S3 access, no FastAPI imports.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from .iter_models import FeedbackIterAssumptionStatus
from .iter_schemas import (
    Persona,
    SpecDocument,
    UserStory,
)


def render_personas(personas: Sequence[Persona]) -> str:
    if not personas:
        return "# Personas\n\n(none generated)\n"
    out = ["# Personas\n"]
    for p in personas:
        out.append(f"## {p.name} — {p.role}\n")
        out.append(f"_Persona id: `{p.id}`_\n")
        if p.goals:
            out.append("\n**Goals**\n")
            out.extend(f"- {g}" for g in p.goals)
        if p.pain_points:
            out.append("\n**Pain points**\n")
            out.extend(f"- {pp}" for pp in p.pain_points)
        out.append(f"\n**Context**\n\n{p.context}\n")
    return "\n".join(out) + "\n"


def render_user_stories(
    stories: Sequence[UserStory],
    personas: Sequence[Persona],
) -> str:
    if not stories:
        return "# User Stories\n\n(none generated)\n"
    persona_by_id = {p.id: p for p in personas}
    by_persona: dict[str, list[UserStory]] = {}
    for s in stories:
        by_persona.setdefault(s.persona_id, []).append(s)

    out = ["# User Stories\n"]
    for pid, group in by_persona.items():
        persona_name = persona_by_id.get(pid)
        heading = persona_name.name if persona_name else pid
        out.append(f"## {heading}\n")
        for story in group:
            out.append(f"### {story.title}\n")
            out.append(f"_Story id: `{story.id}`_\n")
            out.append(
                f"\n**As a** {story.story.as_a}, "
                f"**I want** {story.story.i_want}, "
                f"**so that** {story.story.so_that}.\n"
            )
            for sc in story.acceptance_criteria:
                out.append(f"\n**Scenario:** {sc.scenario}\n")
                for g in sc.given:
                    out.append(f"- **Given** {g}")
                for w in sc.when:
                    out.append(f"- **When** {w}")
                for t in sc.then:
                    out.append(f"- **Then** {t}")
                out.append("")
    return "\n".join(out) + "\n"


def render_spec(spec: SpecDocument) -> str:
    out = [f"# {spec.title}\n", spec.summary, ""]
    for section in spec.sections:
        out.append(f"## {section.heading}")
        out.append(f"_Section id: `{section.id}`_\n")
        out.append(section.body_markdown)
        out.append("")
    return "\n".join(out) + "\n"


def render_diagram(diagram: Any) -> str:
    fence_lang = "mermaid" if diagram.format == "mermaid" else "text"
    caption = diagram.caption.strip() or "Diagram"
    return f"# {caption}\n\n```{fence_lang}\n{diagram.source}\n```\n"


def render_assumptions(items: Sequence[Any]) -> str:
    """Render an assumption-resolution table.

    Items must expose ``slot_key``, ``kind``, ``status``, ``statement``,
    ``user_response`` — i.e. :class:`AssumptionResolution` from
    :mod:`iter_packager`. Typed loose to avoid an import cycle when
    the bundle calls this with its own value-object shape.
    """
    if not items:
        return "# Assumptions Resolved\n\n(none)\n"
    out = [
        "# Assumptions Resolved\n",
        "| slot_key | kind | status | statement | user response |",
        "| --- | --- | --- | --- | --- |",
    ]
    irrelevant: list[Any] = []
    for a in items:
        if a.status == FeedbackIterAssumptionStatus.IRRELEVANT:
            irrelevant.append(a)
            continue
        response_cell = (a.user_response or "").replace("|", "\\|").replace("\n", " ")
        statement_cell = a.statement.replace("|", "\\|").replace("\n", " ")
        status_cell = a.status.value if hasattr(a.status, "value") else str(a.status)
        out.append(
            f"| `{a.slot_key}` | {a.kind} | {status_cell} | {statement_cell} | {response_cell} |"
        )
    if irrelevant:
        out.append("\n## Marked irrelevant\n")
        for a in irrelevant:
            out.append(f"- `{a.slot_key}` — {a.statement}")
    return "\n".join(out) + "\n"


def render_iteration_log(entries: Sequence[Any]) -> str:
    """Render the chronological iteration table.

    Entries must expose ``version_number``, ``created_at``,
    ``user_message``, ``restructure_allowed``, ``changes_summary``.
    """
    if not entries:
        return "# Iteration Log\n\n(none)\n"
    out = [
        "# Iteration Log\n",
        "| version | timestamp (UTC) | restructure | user message | changes summary |",
        "| --- | --- | --- | --- | --- |",
    ]
    for e in entries:
        msg = e.user_message.replace("|", "\\|").replace("\n", " ")[:120]
        summary = e.changes_summary.replace("|", "\\|").replace("\n", " ")[:200]
        out.append(
            f"| {e.version_number} | "
            f"{e.created_at.isoformat()} | "
            f"{'yes' if e.restructure_allowed else 'no'} | "
            f"{msg} | {summary} |"
        )
    return "\n".join(out) + "\n"
