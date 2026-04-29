"""LLM-handoff bundle (Block 12, ADR-051).

Builds an in-memory ZIP that an admin can hand to a coding LLM
(Claude / Codex / similar) so the LLM can resolve the feedback
ticket without access to the running app. The ZIP layout is locked
in ``docs/ux-mapping/2026-04-27/_feedback-widget-readiness.md`` §4.

This module is **pure rendering**: callers (the router) load the
``Feedback`` row, the ``FeedbackAttachment`` rows, the parent chain,
and a ``submitter`` summary, then call :func:`build_feedback_bundle`.
The module reads screenshot bytes through the ``StorageBackend``
protocol — no boto / MinIO imports here.

No audit row is written for the download (consistent with ADR-041:
the ``feedback`` table IS the widget's audit trail; download is a
read-only export).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from io import BytesIO
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

from feedback_widget.models import (
    Feedback,
    FeedbackAttachment,
    FeedbackAttachmentKind,
    FeedbackStatus,
)

# ────────────────────────────────────────────────────────────────────
# Public types
# ────────────────────────────────────────────────────────────────────


# Default repo URL surfaced in the README of the LLM-handoff ZIP so the
# coding LLM knows which codebase to apply patches against. Empty string
# means "let the host pass it via FeedbackSettings.REPO_URL or the
# router caller". The hosted CRM passes its own URL; sapphira passes its.
DEFAULT_REPO_URL = ""


# ────────────────────────────────────────────────────────────────────
# Filename
# ────────────────────────────────────────────────────────────────────


def _bundle_filename(ticket_code: str, created_at: datetime | None) -> str:
    """Return ``<ticket_code>_<YYYY-MM-DD>.zip``.

    ``created_at`` may be naïve in tests; treat naïve as UTC. A NULL
    falls back to today's date — the row should always have a
    timestamp via the model default, but we don't want to crash a
    download just because someone hand-inserted a row in dev.
    """
    if created_at is None:
        created_at = datetime.now(UTC)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=UTC)
    date = created_at.astimezone(UTC).date().isoformat()
    safe_ticket = ticket_code.strip() or "feedback"
    return f"{safe_ticket}_{date}.zip"


# ────────────────────────────────────────────────────────────────────
# Section renderers
# ────────────────────────────────────────────────────────────────────


_STATUS_LABEL: dict[FeedbackStatus, str] = {
    FeedbackStatus.NEW: "new (just submitted, no admin action yet)",
    FeedbackStatus.TRIAGED: "triaged (admin acknowledged, in queue)",
    FeedbackStatus.IN_PROGRESS: "in_progress (admin actively working on it)",
    FeedbackStatus.DONE: "done (admin finished; awaiting submitter accept/reject)",
    FeedbackStatus.WONT_FIX: "wont_fix (admin closed without fixing — final)",
    FeedbackStatus.ACCEPTED_BY_USER: "accepted_by_user (submitter accepted resolution)",
    FeedbackStatus.REJECTED_BY_USER: "rejected_by_user (submitter rejected; expect a child ticket)",
}


def _fmt_dt(dt: datetime | None) -> str:
    """Render an ISO-8601 UTC timestamp, ``—`` for None."""
    if dt is None:
        return "—"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).isoformat(timespec="seconds")


def _render_readme(
    fb: Feedback,
    *,
    submitter: dict[str, str | None] | None = None,
    parent_chain: list[Feedback] | None = None,
    repo_url: str = DEFAULT_REPO_URL,
) -> str:
    """For-LLM prompt block + ticket quick-summary.

    Opens with an instruction sentence the admin can paste verbatim
    into a coding LLM chat; closes with the structured summary the
    LLM can scan in one pass.
    """
    submitter = submitter or {}
    submitter_email = submitter.get("email") or fb.follow_up_email or "(unknown)"
    submitter_role = submitter.get("role") or "(unknown)"
    parent_chain = parent_chain or []
    parent_codes = ", ".join(p.ticket_code for p in parent_chain) if parent_chain else "none"

    lines: list[str] = [
        f"# Feedback ticket {fb.ticket_code}",
        "",
        "**Hand this to a coding LLM with this prompt**:",
        "",
        "> You are a senior engineer. Resolve this feedback ticket. The",
        "> screenshot shows the user's view at submission time. The",
        "> `metadata.json` file contains the full technical context (route,",
        "> viewport, console + network + breadcrumb tail, app version + git",
        "> sha). Read every file in this archive — `ticket.md`, `triage.md`,",
        "> `parent_chain.md` (if present), `magic_links.md` (if present),",
        "> and the `raw/` extracts. Return a plan and concrete patches",
        f"> against the codebase at {repo_url}.",
        "",
        "## Quick summary",
        "",
        f"- **Type**: {fb.type.value}",
        f"- **Status**: {_STATUS_LABEL.get(fb.status, fb.status.value)}",
        f"- **Submitter**: {submitter_email} ({submitter_role})",
        f"- **Tenant**: {fb.tenant_id}",
        f"- **Submitted at**: {_fmt_dt(fb.created_at)}",
        f"- **Route at submission**: {fb.route_name or '(unknown)'}",
        f"- **URL at submission**: {fb.url_captured}",
        f"- **App version**: {fb.app_version or '(unknown)'} "
        f"(commit {fb.git_commit_sha or 'unknown'})",
        f"- **User agent**: {fb.user_agent or '(unknown)'}",
        f"- **Parent chain**: {parent_codes}",
        f"- **Element selector** (if element-mode capture): "
        f"`{fb.element_selector or '(whole-page mode)'}`",
        "",
    ]
    return "\n".join(lines)


def _render_ticket(fb: Feedback) -> str:
    """Render the ticket body — title, description, persona, linked stories, type fields."""
    lines: list[str] = [
        f"# {fb.title}",
        "",
        "## Description",
        "",
        fb.description.strip() or "_(no description)_",
        "",
    ]

    if fb.persona and fb.persona.strip():
        lines += [
            "## Persona",
            "",
            fb.persona.strip(),
            "",
        ]

    if fb.linked_user_stories:
        lines += [
            "## Linked user stories",
            "",
        ]
        for entry in fb.linked_user_stories:
            story = str(entry.get("story") or "").strip()
            if not story:
                continue
            priority = entry.get("priority")
            criteria = entry.get("acceptance_criteria")
            lines.append(f"- **{story}**" + (f" _(priority: {priority})_" if priority else ""))
            if criteria:
                criteria_str = str(criteria).strip().replace("\n", "\n  ")
                lines.append(f"  - Acceptance criteria: {criteria_str}")
        lines.append("")

    if fb.type_fields:
        lines += [
            "## Type-specific fields",
            "",
        ]
        for key, value in sorted(fb.type_fields.items()):
            value_str = str(value).strip()
            if "\n" in value_str:
                lines.append(f"- **{key}**:")
                for sub in value_str.split("\n"):
                    lines.append(f"  > {sub}")
            else:
                lines.append(f"- **{key}**: {value_str}")
        lines.append("")

    return "\n".join(lines)


def _render_triage(fb: Feedback) -> str:
    """Render the triage state — current status, note, transition timestamps."""
    lines: list[str] = [
        f"# Triage state for {fb.ticket_code}",
        "",
        f"- **Current status**: {_STATUS_LABEL.get(fb.status, fb.status.value)}",
        f"- **Created at**: {_fmt_dt(fb.created_at)}",
        f"- **Last updated at**: {_fmt_dt(fb.updated_at)}",
        f"- **Triaged by (user_id)**: {fb.triaged_by or '—'}",
        f"- **Triaged at**: {_fmt_dt(fb.triaged_at)}",
        "",
        "## Triage note",
        "",
        (fb.triage_note.strip() if fb.triage_note else "_(no triage note yet)_"),
        "",
    ]
    return "\n".join(lines)


def _render_chain(parents: list[Feedback]) -> str:
    """Render the parent-chain ancestors. Caller passes deepest-first."""
    if not parents:
        return ""

    lines: list[str] = [
        "# Parent chain",
        "",
        "_This ticket was filed in response to the resolution of one or more "
        "earlier tickets. Most recent parent first._",
        "",
    ]
    for parent in parents:
        lines += [
            f"## {parent.ticket_code}",
            "",
            f"- **Type**: {parent.type.value}",
            f"- **Status**: {_STATUS_LABEL.get(parent.status, parent.status.value)}",
            f"- **Title**: {parent.title}",
            f"- **Created at**: {_fmt_dt(parent.created_at)}",
            "",
        ]
    return "\n".join(lines)


def _render_magic_links(fb: Feedback, *, deep_link_base: str) -> str:
    """Render accept/reject URLs ONLY when token is set + unexpired.

    Returns an empty string when no active token exists; the caller
    omits the file from the bundle in that case.
    """
    token = fb.acceptance_token
    expires = fb.acceptance_token_expires_at
    if token is None:
        return ""
    if expires is None:
        return ""
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires <= datetime.now(UTC):
        return ""

    base = (deep_link_base or "").rstrip("/")
    if not base:
        # No deep-link base configured — omit links rather than ship
        # localhost URLs that are useless to the LLM. This matches the
        # router's own posture (it refuses to email magic-link URLs in
        # non-local environments without a configured base).
        return ""

    accept_url = f"{base}/feedback/accept?token={token}"
    reject_url = f"{base}/feedback/reject?token={token}"

    lines = [
        f"# Magic links for {fb.ticket_code}",
        "",
        "_Single-use, expiring URLs the original submitter received in the "
        "status-transition email. The LLM should not click these — they're "
        "included so the admin handing off the ticket has the full audit "
        "context._",
        "",
        f"- **Token expires**: {_fmt_dt(expires)}",
        f"- **Accept URL**: {accept_url}",
        f"- **Reject URL**: {reject_url}",
        "",
    ]
    return "\n".join(lines)


# ────────────────────────────────────────────────────────────────────
# Orchestrator
# ────────────────────────────────────────────────────────────────────


def build_feedback_bundle(
    *,
    fb: Feedback,
    attachments: list[FeedbackAttachment],
    parent_chain: list[Feedback],
    storage: Any,
    deep_link_base: str,
    repo_url: str = DEFAULT_REPO_URL,
    submitter: dict[str, str | None] | None = None,
) -> bytes:
    """Build the LLM-handoff ZIP for ``fb`` and return its bytes.

    The caller (router) is responsible for tenant scoping — by the
    time we get here, every artefact has already been tenant-checked.

    ``storage`` must implement ``download(key, bucket) -> bytes``
    (the existing :class:`app.core.storage.StorageBackend` protocol).
    Typed as ``Any`` here so this module doesn't import the concrete
    backend — keeps the widget-extraction boundary clean.
    """
    metadata = fb.metadata_bundle or {}

    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr(
            "README.md",
            _render_readme(
                fb,
                submitter=submitter,
                parent_chain=parent_chain,
                repo_url=repo_url,
            ),
        )
        archive.writestr("ticket.md", _render_ticket(fb))
        archive.writestr("triage.md", _render_triage(fb))
        archive.writestr("metadata.json", json.dumps(metadata, indent=2, default=str))

        # Optional sections.
        if parent_chain:
            archive.writestr("parent_chain.md", _render_chain(parent_chain))

        magic_links = _render_magic_links(fb, deep_link_base=deep_link_base)
        if magic_links:
            archive.writestr("magic_links.md", magic_links)

        # Screenshot — first SCREENSHOT-kind attachment (one per row in MVP).
        screenshot_attachment = next(
            (a for a in attachments if a.kind == FeedbackAttachmentKind.SCREENSHOT),
            None,
        )
        if screenshot_attachment is not None:
            try:
                screenshot_bytes = storage.download(
                    screenshot_attachment.object_key,
                    bucket=screenshot_attachment.bucket,
                )
                archive.writestr("screenshot.png", screenshot_bytes)
            except (OSError, RuntimeError):
                # Storage transient failure — ship the bundle anyway. The
                # LLM still has the metadata + breadcrumbs; missing the
                # image is degraded but recoverable. We deliberately do
                # NOT swallow ``BotoCoreError`` etc. by name to keep this
                # module storage-backend-agnostic.
                pass

        # Raw extracts pulled out of metadata_bundle for direct LLM ingestion.
        # These keys are populated by the widget capture pipeline; if a row
        # was submitted with consent_metadata_capture=False they may be
        # absent or empty — in which case we ship the empty list, so the
        # LLM doesn't have to guess between 'absent' and 'no events'.
        archive.writestr(
            "raw/breadcrumbs.json",
            json.dumps(metadata.get("breadcrumbs") or [], indent=2, default=str),
        )
        archive.writestr(
            "raw/console_tail.json",
            json.dumps(metadata.get("console_tail") or [], indent=2, default=str),
        )
        archive.writestr(
            "raw/network_tail.json",
            json.dumps(metadata.get("network_tail") or [], indent=2, default=str),
        )

    buffer.seek(0)
    return buffer.read()


__all__ = [
    "DEFAULT_REPO_URL",
    "_bundle_filename",
    "_render_chain",
    "_render_magic_links",
    "_render_readme",
    "_render_ticket",
    "_render_triage",
    "build_feedback_bundle",
]
