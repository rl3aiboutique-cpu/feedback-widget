"""Final-package builder.

When the user clicks "Finalize" the service calls
:func:`build_iter_package` which:

1. Renders 7 role-tagged Markdown files from the final iteration's
   structured ``IterationOutput`` plus the session history.
2. Copies the original feedback's attachments (screenshot + any
   user uploads) under ``attachments/`` via S3 server-side copy
   (no streaming through the API process).
3. Uploads each Markdown file under
   ``feedback/YYYY/MM/DD/{feedback_id}/iter/sessions/{sid}/packages/{pid}/folder/``
   and the bundled ``package.zip`` alongside.
4. Returns the ZIP key + folder prefix + byte size so the service
   can persist a :class:`FeedbackIterPackage` row.

The ``_AI_INSTRUCTIONS.md`` body is a verbatim render of spec §9.2
with the host's ``ITER_DOWNSTREAM_CONSUMER_MODEL`` interpolated.
"""

from __future__ import annotations

import io
import json
import uuid
import zipfile
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from .iter_models import (
    FeedbackIterAssumptionStatus,
)
from .iter_schemas import (
    Assumption,
    IterationOutput,
    Persona,
    SpecDocument,
    UserStory,
)
from .settings import FeedbackSettings
from .storage.s3 import StorageBackend

# ────────────────────────────────────────────────────────────────────
# Inputs (decoupled from ORM types so unit tests can build value objects
# without an actual DB session)
# ────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class FeedbackContext:
    """Just the bits of the parent feedback row the packager renders."""

    feedback_id: uuid.UUID
    title: str
    description: str
    expected_outcome: str | None
    url_captured: str
    route_name: str | None
    metadata_bundle: dict[str, Any]
    app_version: str | None
    git_commit_sha: str | None


@dataclass(frozen=True)
class AttachmentRef:
    """One feedback attachment to copy into the package's
    ``attachments/`` subfolder."""

    object_key: str  # source key
    filename: str  # destination filename inside attachments/
    content_type: str
    byte_size: int
    # Source bucket. ``None`` means "use the storage backend's
    # default bucket"; for multi-bucket deployments where
    # attachments live in their own bucket, set this so
    # ``copy_object`` and ``download`` both read from the right
    # place.
    bucket: str | None = None


@dataclass(frozen=True)
class AssumptionResolution:
    """A row from ``feedback_iter_assumption`` with its final status —
    the packager renders these into ``05_assumptions_resolved.md``."""

    slot_key: str
    kind: str
    statement: str
    status: FeedbackIterAssumptionStatus
    user_response: str | None


@dataclass(frozen=True)
class IterationLogEntry:
    """One row for the chronological table in ``06_iteration_log.md``."""

    version_number: int
    created_at: datetime
    user_message: str
    restructure_allowed: bool
    changes_summary: str


@dataclass(frozen=True)
class PackageBuildInputs:
    feedback: FeedbackContext
    final_output: IterationOutput
    session_id: uuid.UUID
    package_id: uuid.UUID
    attachments: Sequence[AttachmentRef]
    assumptions: Sequence[AssumptionResolution]
    iteration_log: Sequence[IterationLogEntry]


@dataclass(frozen=True)
class PackageBuildResult:
    folder_prefix: str
    zip_key: str
    zip_byte_size: int


# ────────────────────────────────────────────────────────────────────
# Markdown renderers — each returns the body of one file
# ────────────────────────────────────────────────────────────────────


_AI_INSTRUCTIONS_TEMPLATE = """\
# AI Consumer Instructions

> **You are {consumer_model}.**
> Read every file in this folder, in order, before producing any
> output or writing any code.

## What this package is

A finalized product specification produced by the RL3 Feedback
Widget's "Iterate with AI" module. The user iterated with an
upstream LLM until every assumption was resolved. Treat this
package as the source of truth.

## Reading order and roles

1. `00_context.md` — the original raw feedback, technical metadata,
   and attachments inventory. **Role: read only context. Do not act
   on this directly; act on the spec.**
2. `01_personas.md` — the user personas. **Role: actors.**
3. `02_user_stories.md` — Gherkin user stories. **Role: acceptance
   criteria.**
4. `03_spec.md` — the specification body. **Role: implementation
   contract.**
5. `04_diagram.md` — the architecture or flow diagram. **Role:
   visual aid.**
6. `05_assumptions_resolved.md` — every assumption with its final
   status. **Role: constraints.**
7. `06_iteration_log.md` — the full iteration history. **Role:
   audit trail. Use only to disambiguate, not as a primary source.**

## Hard rules for you, the consumer

1. The spec is final. If `03_spec.md` says X, assume X. Do not
   second guess.
2. Every story in `02_user_stories.md` must be reflected in your
   output.
3. Every confirmed or corrected assumption in
   `05_assumptions_resolved.md` is a fact. Every irrelevant one is
   to be ignored.
4. The diagram in `04_diagram.md` describes structure; reproduce
   it in your plan if you produce one.
5. Attachments under `attachments/` are evidence; treat them as
   you would any user uploaded reference material.
6. If anything is genuinely ambiguous, list the ambiguity and ask
   before coding. Do not invent.

## What to produce

Produce whatever the user asks of you next. Do not produce
anything yet just because you read this file.
"""


def render_ai_instructions(*, consumer_model: str) -> str:
    return _AI_INSTRUCTIONS_TEMPLATE.format(
        consumer_model=consumer_model or "Claude Code Opus 4.7",
    )


def render_context(
    feedback: FeedbackContext,
    attachments: Sequence[AttachmentRef],
) -> str:
    metadata_yaml = json.dumps(feedback.metadata_bundle, indent=2, default=str)
    attachments_block = (
        "\n".join(
            f"- `{a.filename}` — `{a.content_type}`, {a.byte_size} bytes" for a in attachments
        )
        or "(none)"
    )
    expected = feedback.expected_outcome or "(none provided)"
    return (
        "# Original Feedback\n\n"
        f"## Title\n\n{feedback.title}\n\n"
        f"## Description\n\n{feedback.description}\n\n"
        f"## Expected Outcome\n\n{expected}\n\n"
        "## Technical Metadata\n\n"
        f"- url: `{feedback.url_captured}`\n"
        f"- route: `{feedback.route_name or '(unknown)'}`\n"
        f"- app_version: `{feedback.app_version or '(unknown)'}`\n"
        f"- git_commit_sha: `{feedback.git_commit_sha or '(unknown)'}`\n\n"
        "### Captured metadata bundle\n\n"
        f"```json\n{metadata_yaml}\n```\n\n"
        "## Attachments\n\n"
        f"{attachments_block}\n"
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


def render_assumptions(items: Sequence[AssumptionResolution]) -> str:
    if not items:
        return "# Assumptions Resolved\n\n(none)\n"
    out = [
        "# Assumptions Resolved\n",
        "| slot_key | kind | status | statement | user response |",
        "| --- | --- | --- | --- | --- |",
    ]
    irrelevant: list[AssumptionResolution] = []
    for a in items:
        if a.status == FeedbackIterAssumptionStatus.IRRELEVANT:
            irrelevant.append(a)
            continue
        response_cell = (a.user_response or "").replace("|", "\\|").replace("\n", " ")
        statement_cell = a.statement.replace("|", "\\|").replace("\n", " ")
        out.append(
            f"| `{a.slot_key}` | {a.kind} | {a.status.value} | {statement_cell} | {response_cell} |"
        )
    if irrelevant:
        out.append("\n## Marked irrelevant\n")
        for a in irrelevant:
            out.append(f"- `{a.slot_key}` — {a.statement}")
    return "\n".join(out) + "\n"


def render_readme(
    feedback: FeedbackContext,
    attachments: Sequence[AttachmentRef],
    iteration_log: Sequence[IterationLogEntry],
    *,
    consumer_model: str,
) -> str:
    """Top-level human-readable index of the package contents.

    Distinct from ``_AI_INSTRUCTIONS.md`` (which primes a downstream
    LLM consumer); this is what an admin sees first when they open
    the ZIP. Lists every file with a one-line role, separates the
    raw user inputs from the AI-generated artifacts, and shows the
    attachment manifest with byte sizes for completeness checks.
    """
    iter_count = len(iteration_log)
    final_iter = iteration_log[-1] if iteration_log else None
    final_summary = (final_iter.changes_summary if final_iter else "").strip()
    attachments_block = (
        "\n".join(
            f"- `attachments/{a.filename}` &mdash; `{a.content_type}`, {a.byte_size:,} bytes"
            for a in attachments
        )
        or "(no attachments on the original feedback)"
    )

    return (
        "# Iterate-with-AI Package\n\n"
        f"_Generated from feedback **{feedback.title}** "
        f"(`{feedback.feedback_id}`) after {iter_count} "
        f"iteration{'s' if iter_count != 1 else ''}._\n\n"
        "This ZIP bundles **everything** about one feedback session "
        "in a single, durable hand-off:\n\n"
        "- The user's original report (free text + technical "
        "metadata + every attachment they uploaded).\n"
        "- The AI-iterated working document the user reviewed and "
        "approved (personas, user stories, spec, diagram, "
        "assumptions).\n"
        "- A complete iteration log + the prompt that primes the "
        "downstream consumer model.\n\n"
        "## File index\n\n"
        "### Read first\n\n"
        "- `README.md` &mdash; this file.\n"
        "- `_AI_INSTRUCTIONS.md` &mdash; the prompt for the "
        f"downstream consumer (currently `{consumer_model}`). "
        "Hand the consumer this file plus everything else.\n\n"
        "### Raw user input\n\n"
        "- `00_context.md` &mdash; original feedback text, "
        "expected outcome, technical metadata bundle, and the "
        "attachment manifest.\n"
        "- `attachments/` &mdash; every file the user uploaded "
        "with the original feedback, in its original format.\n\n"
        "### AI-generated specification\n\n"
        "- `01_personas.md` &mdash; user personas the AI proposed.\n"
        "- `02_user_stories.md` &mdash; Gherkin-style user stories "
        "linked to the personas.\n"
        "- `03_spec.md` &mdash; the implementation contract.\n"
        "- `04_diagram.md` &mdash; ASCII (or Mermaid) diagram of "
        "the flow.\n"
        "- `05_assumptions_resolved.md` &mdash; every assumption "
        "the AI made + the user's resolution.\n\n"
        "### Audit trail\n\n"
        "- `06_iteration_log.md` &mdash; chronological log of each "
        "iteration with the user's notes.\n\n"
        "## Attachment manifest\n\n"
        f"{attachments_block}\n\n"
        + (f"## Final iteration summary\n\n{final_summary}\n\n" if final_summary else "")
        + "## Provenance\n\n"
        f"- Feedback id: `{feedback.feedback_id}`\n"
        f"- URL captured: `{feedback.url_captured}`\n"
        f"- App version: `{feedback.app_version or '(unknown)'}`\n"
        f"- Git SHA: `{feedback.git_commit_sha or '(unknown)'}`\n"
        f"- Iterations: {iter_count}\n"
    )


def render_iteration_log(entries: Sequence[IterationLogEntry]) -> str:
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


# ────────────────────────────────────────────────────────────────────
# MinIO key layout
# ────────────────────────────────────────────────────────────────────


def _date_partition(when: datetime) -> str:
    return f"{when.year:04d}/{when.month:02d}/{when.day:02d}"


def _build_folder_prefix(
    feedback_created_at: datetime,
    feedback_id: uuid.UUID,
    session_id: uuid.UUID,
    package_id: uuid.UUID,
) -> str:
    return (
        f"feedback/{_date_partition(feedback_created_at)}/{feedback_id}"
        f"/iter/sessions/{session_id}/packages/{package_id}"
    )


# ────────────────────────────────────────────────────────────────────
# Orchestration
# ────────────────────────────────────────────────────────────────────


def _render_all_files(inputs: PackageBuildInputs, *, consumer_model: str) -> dict[str, str]:
    """Map of relative path → markdown body for every text file in
    the package (everything except attachments)."""
    out = inputs.final_output
    return {
        "README.md": render_readme(
            inputs.feedback,
            inputs.attachments,
            inputs.iteration_log,
            consumer_model=consumer_model,
        ),
        "_AI_INSTRUCTIONS.md": render_ai_instructions(consumer_model=consumer_model),
        "00_context.md": render_context(inputs.feedback, inputs.attachments),
        "01_personas.md": render_personas(out.personas),
        "02_user_stories.md": render_user_stories(out.user_stories, out.personas),
        "03_spec.md": render_spec(out.spec),
        "04_diagram.md": render_diagram(out.diagram),
        "05_assumptions_resolved.md": render_assumptions(inputs.assumptions),
        "06_iteration_log.md": render_iteration_log(inputs.iteration_log),
    }


def _build_zip(
    text_files: dict[str, str],
    attachment_blobs: dict[str, bytes],
) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as z:
        for name, body in text_files.items():
            z.writestr(name, body)
        for name, blob in attachment_blobs.items():
            z.writestr(f"attachments/{name}", blob)
    return buf.getvalue()


def build_iter_package(
    *,
    inputs: PackageBuildInputs,
    storage: StorageBackend,
    settings: FeedbackSettings,
    feedback_created_at: datetime,
) -> PackageBuildResult:
    """Render, upload, and bundle the package.

    Returns a :class:`PackageBuildResult` carrying the folder prefix,
    zip key, and zip byte size for the service to persist.
    """
    folder_prefix = _build_folder_prefix(
        feedback_created_at,
        inputs.feedback.feedback_id,
        inputs.session_id,
        inputs.package_id,
    )

    text_files = _render_all_files(
        inputs,
        consumer_model=settings.ITER_DOWNSTREAM_CONSUMER_MODEL,
    )

    # Upload each text file to MinIO under .../folder/
    for relpath, body in text_files.items():
        storage.upload(
            key=f"{folder_prefix}/folder/{relpath}",
            data=body.encode("utf-8"),
            content_type="text/markdown; charset=utf-8",
        )

    # Server-side copy attachments + collect bytes for the ZIP. We
    # download once for the ZIP body but the canonical objects live
    # under attachments/ via copy_object so we don't pay double
    # storage.
    attachment_blobs: dict[str, bytes] = {}
    for att in inputs.attachments:
        dest_key = f"{folder_prefix}/folder/attachments/{att.filename}"
        storage.copy_object(
            source_key=att.object_key,
            dest_key=dest_key,
            source_bucket=att.bucket,
        )
        attachment_blobs[att.filename] = storage.download(att.object_key, bucket=att.bucket)

    zip_bytes = _build_zip(text_files, attachment_blobs)
    zip_key = f"{folder_prefix}/package.zip"
    storage.upload(
        key=zip_key,
        data=zip_bytes,
        content_type="application/zip",
    )

    return PackageBuildResult(
        folder_prefix=folder_prefix,
        zip_key=zip_key,
        zip_byte_size=len(zip_bytes),
    )


# ────────────────────────────────────────────────────────────────────
# Helper for converting Pydantic model rows → AssumptionResolution
# ────────────────────────────────────────────────────────────────────


def assumption_resolution(
    *,
    slot_key: str,
    kind: str,
    statement: str,
    status: FeedbackIterAssumptionStatus,
    user_response: str | None,
) -> AssumptionResolution:
    """Tiny helper so callers don't need to import the dataclass."""
    return AssumptionResolution(
        slot_key=slot_key,
        kind=kind,
        statement=statement,
        status=status,
        user_response=user_response,
    )


def reference_assumption(asm: Assumption) -> AssumptionResolution:
    """Project a freshly-emitted Assumption to a resolution row with
    status=open. The service builds the real list from the DB once
    the user has resolved them; this helper exists for tests."""
    return AssumptionResolution(
        slot_key=asm.slot_key,
        kind=asm.kind.value,
        statement=asm.statement,
        status=FeedbackIterAssumptionStatus.OPEN,
        user_response=None,
    )
