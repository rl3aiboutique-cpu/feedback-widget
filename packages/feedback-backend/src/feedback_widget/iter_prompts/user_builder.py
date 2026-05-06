"""Tagged-block user prompt assembly — spec §5.2.

The order of blocks is the contract: prompt_sha256 changes if any
block content shifts, so re-ordering would change the audit hash
and confuse cached-prompt analysis.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class _AttachmentMeta:
    """Just the filename + mime + kind for the listing block; binary
    content is passed separately as :class:`LLMAttachment` objects."""

    filename: str
    mime_type: str
    kind: str


@dataclass(frozen=True)
class _PriorVersion:
    version_number: int
    markdown_rendered: str


@dataclass(frozen=True)
class _ResolvedAssumption:
    slot_key: str
    kind: str
    status: str  # "confirmed" | "corrected" | "irrelevant"
    statement: str
    user_response: str  # empty for confirmed/irrelevant


@dataclass(frozen=True)
class _TechnicalMetadata:
    """Cherry-picked technical-metadata fields the LLM cares about.

    Anything not in this list is intentionally dropped — the prompt
    is a contract, not a dumping ground for the metadata bundle.
    """

    url: str
    viewport_w: int | None
    viewport_h: int | None
    user_agent: str | None
    route: str | None
    framework: str | None
    app_version: str | None
    git_sha: str | None
    selected_element_selector: str | None
    selected_element_outer_html: str | None
    console_errors_tail: list[dict[str, Any]]
    network_errors_tail: list[dict[str, Any]]


def _format_attachments(items: Sequence[_AttachmentMeta]) -> str:
    if not items:
        return "(none)"
    lines = [f"- {a.filename} ({a.mime_type}) [{a.kind}]" for a in items]
    return "\n".join(lines)


def _format_metadata(meta: _TechnicalMetadata) -> str:
    viewport = (
        f"{meta.viewport_w}x{meta.viewport_h}"
        if meta.viewport_w and meta.viewport_h
        else "(unknown)"
    )
    return (
        f"url: {meta.url}\n"
        f"viewport: {viewport}\n"
        f"user_agent: {meta.user_agent or '(unknown)'}\n"
        f"route: {meta.route or '(unknown)'}\n"
        f"framework: {meta.framework or 'unknown'}\n"
        f"app_version: {meta.app_version or '(unknown)'}\n"
        f"git_sha: {meta.git_sha or '(unknown)'}\n"
        f"selected_element_selector: "
        f"{meta.selected_element_selector or '(whole page)'}\n"
        f"selected_element_outer_html: "
        f"{meta.selected_element_outer_html or '(whole page)'}\n"
        "console_errors_tail:\n"
        f"{json.dumps(meta.console_errors_tail, ensure_ascii=False)}\n"
        "network_errors_tail:\n"
        f"{json.dumps(meta.network_errors_tail, ensure_ascii=False)}"
    )


def _format_prior_versions(versions: Sequence[_PriorVersion]) -> str:
    if not versions:
        return "(none — this is the first iteration)"
    blocks = []
    for v in versions:
        blocks.append(
            f'  <version number="{v.version_number}">\n{v.markdown_rendered.rstrip()}\n  </version>'
        )
    return "\n".join(blocks)


def _format_resolved(items: Sequence[_ResolvedAssumption]) -> str:
    if not items:
        return "(none)"
    lines = []
    for a in items:
        body = (
            f"- slot_key={a.slot_key} kind={a.kind} status={a.status} "
            f'statement="{a.statement}" '
            f'user_response="{a.user_response}"'
        )
        lines.append(body)
    return "\n".join(lines)


def _format_glossary(glossary: dict[str, str] | None) -> str:
    """Render the host's domain glossary as a tag block.

    Empty / None ⇒ ``(none)`` so the prompt stays a constant shape.
    Multiple-word keys are quoted to keep the rendering scannable.
    """
    if not glossary:
        return "(none)"
    rows = [f'- "{k}": {v}' for k, v in glossary.items() if k and v]
    return "\n".join(rows) if rows else "(none)"


def build_user_prompt(
    *,
    feedback_text: str,
    attachments: Sequence[_AttachmentMeta],
    technical_metadata: _TechnicalMetadata,
    prior_versions: Sequence[_PriorVersion],
    resolved_assumptions: Sequence[_ResolvedAssumption],
    user_iteration_message: str,
    restructure_allowed: bool,
    glossary: dict[str, str] | None = None,
) -> str:
    """Assemble the tagged-block user prompt per spec §5.2.

    The order MUST NOT change — the audit hash and the system
    prompt's instructions both depend on it. ``glossary`` is the
    only optional parameter; it appends a ``<glossary>`` block at
    the top so existing prompt hashes stay stable for empty hosts.
    """
    return (
        "<glossary>\n"
        f"{_format_glossary(glossary)}\n"
        "</glossary>\n"
        "\n"
        "<original_feedback>\n"
        f"{feedback_text.rstrip()}\n"
        "</original_feedback>\n"
        "\n"
        "<original_attachments>\n"
        f"{_format_attachments(attachments)}\n"
        "</original_attachments>\n"
        "\n"
        "<technical_metadata>\n"
        f"{_format_metadata(technical_metadata)}\n"
        "</technical_metadata>\n"
        "\n"
        "<previous_versions>\n"
        f"{_format_prior_versions(prior_versions)}\n"
        "</previous_versions>\n"
        "\n"
        "<resolved_assumptions>\n"
        f"{_format_resolved(resolved_assumptions)}\n"
        "</resolved_assumptions>\n"
        "\n"
        "<user_iteration_message>\n"
        f"{user_iteration_message.rstrip()}\n"
        "</user_iteration_message>\n"
        "\n"
        "<restructure_allowed>\n"
        f"{'true' if restructure_allowed else 'false'}\n"
        "</restructure_allowed>\n"
    )


def build_repair_hint(validation_errors: str) -> str:
    """Addendum appended to the user prompt on the SECOND attempt
    when the first response failed JSON / business-rule validation.

    Spec §6.9 — preserves the structured content the model already
    produced; only fixes the validation errors.
    """
    return (
        "\n"
        "<previous_response_invalid>\n"
        "Your previous response failed validation with the following "
        "errors:\n"
        f"{validation_errors}\n"
        "\n"
        "Return a strict JSON object matching the schema. No markdown, "
        "no comments, no extra text. Preserve the structured content "
        "you produced; only fix the validation errors.\n"
        "</previous_response_invalid>\n"
    )


def prompt_sha256(system_prompt: str, user_prompt: str) -> str:
    """Hash of the full prompt for the audit-trail column."""
    h = hashlib.sha256()
    h.update(system_prompt.encode("utf-8"))
    h.update(b"\n---\n")
    h.update(user_prompt.encode("utf-8"))
    return h.hexdigest()


# Re-export the dataclasses so callers don't reach into the private
# names. They're intentionally trivial value types.
AttachmentMeta = _AttachmentMeta
PriorVersion = _PriorVersion
ResolvedAssumption = _ResolvedAssumption
TechnicalMetadata = _TechnicalMetadata
