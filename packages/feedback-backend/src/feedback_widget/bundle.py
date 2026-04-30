"""LLM-handoff bundle.

Builds an in-memory ZIP that an admin can hand to a coding LLM
(Claude / Codex / similar) so the LLM can resolve the feedback
ticket without access to the running app.

This module is **pure rendering**: callers (the router) load the
``Feedback`` row, the ``FeedbackAttachment`` rows, and a ``submitter``
summary, then call :func:`build_feedback_bundle`. The module reads
attachment bytes through the ``StorageBackend`` protocol — no boto /
MinIO imports here.

No audit row is written for the download — the ``feedback`` table IS
the widget's audit trail; download is a read-only export.
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

# Default repo URL surfaced in the README of the LLM-handoff ZIP so the
# coding LLM knows which codebase to apply patches against. Empty string
# means "let the host pass it via FeedbackSettings.REPO_URL".
DEFAULT_REPO_URL = ""


def _bundle_filename(ticket_code: str, created_at: datetime | None) -> str:
    """Return ``<ticket_code>_<YYYY-MM-DD>.zip``."""
    if created_at is None:
        created_at = datetime.now(UTC)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=UTC)
    date = created_at.astimezone(UTC).date().isoformat()
    safe_ticket = ticket_code.strip() or "feedback"
    return f"{safe_ticket}_{date}.zip"


_STATUS_LABEL: dict[FeedbackStatus, str] = {
    FeedbackStatus.NEW: "new (just submitted, no admin action yet)",
    FeedbackStatus.TRIAGED: "triaged (admin acknowledged, in queue)",
    FeedbackStatus.IN_PROGRESS: "in_progress (admin actively working on it)",
    FeedbackStatus.DONE: "done (admin finished, submitter notified)",
    FeedbackStatus.WONT_FIX: "wont_fix (admin closed without fixing — final)",
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
    repo_url: str = DEFAULT_REPO_URL,
) -> str:
    """For-LLM prompt block + ticket quick-summary.

    Opens with an instruction sentence the admin can paste verbatim
    into a coding LLM chat; closes with the structured summary the
    LLM can scan in one pass.
    """
    submitter = submitter or {}
    submitter_email = submitter.get("email") or "(unknown)"
    submitter_role = submitter.get("role") or "(unknown)"

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
        "> `attachments/*` (user-uploaded wireframes, logs, notes), and the",
        "> `raw/` extracts. Return a plan and concrete patches against the",
        f"> codebase at {repo_url}.",
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
        f"- **Element selector** (if element-mode capture): "
        f"`{fb.element_selector or '(whole-page mode)'}`",
        "",
    ]
    return "\n".join(lines)


def _render_ticket(fb: Feedback) -> str:
    """Render the ticket body — title, description, expected outcome."""
    lines: list[str] = [
        f"# {fb.title}",
        "",
        "## What's happening?",
        "",
        fb.description.strip() or "_(no description)_",
        "",
    ]
    if fb.expected_outcome and fb.expected_outcome.strip():
        lines += [
            "## How should it work?",
            "",
            fb.expected_outcome.strip(),
            "",
        ]
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


def build_feedback_bundle(
    *,
    fb: Feedback,
    attachments: list[FeedbackAttachment],
    storage: Any,
    repo_url: str = DEFAULT_REPO_URL,
    submitter: dict[str, str | None] | None = None,
) -> bytes:
    """Build the LLM-handoff ZIP for ``fb`` and return its bytes.

    The caller (router) is responsible for tenant scoping — by the
    time we get here, every artefact has already been tenant-checked.

    ``storage`` must implement ``download(key, bucket) -> bytes``
    (the existing :class:`feedback_widget.storage.StorageBackend`
    protocol). Typed as ``Any`` here so this module doesn't import the
    concrete backend.
    """
    metadata = fb.metadata_bundle or {}

    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr(
            "README.md",
            _render_readme(fb, submitter=submitter, repo_url=repo_url),
        )
        archive.writestr("ticket.md", _render_ticket(fb))
        archive.writestr("triage.md", _render_triage(fb))
        archive.writestr("metadata.json", json.dumps(metadata, indent=2, default=str))

        # Auto-captured screenshot — first SCREENSHOT-kind attachment.
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
                # Storage transient failure — ship the bundle anyway.
                pass

        # User-uploaded attachments — wireframes, logs, notes, extra
        # screenshots. Embedded under ``attachments/`` so the LLM can
        # walk them directly.
        for a in attachments:
            if a.kind != FeedbackAttachmentKind.USER_ATTACHMENT:
                continue
            safe_name = a.filename or "attachment"
            try:
                content = storage.download(a.object_key, bucket=a.bucket)
                archive.writestr(f"attachments/{safe_name}", content)
            except (OSError, RuntimeError):
                continue

        # Raw extracts pulled out of metadata_bundle for direct LLM ingestion.
        # These keys are populated by the widget capture pipeline; ship the
        # empty list when missing so the LLM doesn't have to guess between
        # 'absent' and 'no events'.
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
    "_render_readme",
    "_render_ticket",
    "_render_triage",
    "build_feedback_bundle",
]
