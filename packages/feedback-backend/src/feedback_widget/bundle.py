"""LLM-handoff bundle (Sprint C — chat-first only).

Builds an in-memory ZIP an admin can drop into a coding LLM
(Claude / Codex / etc.) so the LLM can resolve the feedback ticket
without access to the running app.

ZIP layout::

    README.md            ← for-LLM prompt + quick summary
    ticket.md            ← markdown render of the feedback row
    triage.md            ← admin triage / status notes
    feedback.json        ← raw Feedback row JSON (full audit)
    metadata.json        ← auto_context technical fingerprint
    screenshot.png       ← auto-captured screenshot (if any)
    attachments/         ← user-uploaded files
    chat/                ← present when feedback came from chat-first
        session.json     ← full chat session (messages + synthesis +
                           auto_context + detected_language + status)
        transcript.md    ← human-readable conversation
        synthesis.md     ← rendered structured spec from synthesis_json
        calls.json       ← LLM call audit (model / latency / status /
                           prompt_sha256 / prompt_version per turn)

Sprint C removed the dependency on the legacy iter-module. The ZIP is
self-contained and works for both legacy multipart feedback and
chat-first feedback. No iter tables are read.
"""

from __future__ import annotations

import json
import logging
import uuid
from contextlib import suppress
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

logger = logging.getLogger(__name__)


def _import_boto_errors() -> tuple[type[BaseException], ...]:
    """Storage backends raise these (boto3 BotoCoreError / ClientError,
    file-backend OSError) plus generic stragglers (RuntimeError,
    ValueError on truncated downloads). Catch the union so we can log +
    record which artefact was missed without taking a hard dependency
    on boto3 here."""
    with suppress(ImportError):
        from botocore.exceptions import BotoCoreError, ClientError

        return (BotoCoreError, ClientError, OSError, RuntimeError)
    return (OSError, RuntimeError)


_STORAGE_DOWNLOAD_ERRORS: tuple[type[BaseException], ...] = _import_boto_errors()


DEFAULT_REPO_URL = ""


_STATUS_LABEL: dict[FeedbackStatus, str] = {
    FeedbackStatus.OPEN: "open (just submitted, no admin action yet)",
    FeedbackStatus.IN_REVIEW: "in_review (admin acknowledged, in queue)",
    FeedbackStatus.IN_PROGRESS: "in_progress (admin actively working on it)",
    FeedbackStatus.WAITING_FOR_USER: "waiting_for_user (admin requested action)",
    FeedbackStatus.RESOLVED: "resolved (admin finished, submitter notified)",
    FeedbackStatus.WONT_FIX: "wont_fix (admin closed without fixing — final)",
    FeedbackStatus.CLOSED: "closed (terminal umbrella close)",
}


def _bundle_filename(ticket_code: str, created_at: datetime | None) -> str:
    """Return ``<ticket_code>_<YYYY-MM-DD>.zip``."""
    if created_at is None:
        created_at = datetime.now(UTC)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=UTC)
    date = created_at.astimezone(UTC).date().isoformat()
    safe_ticket = ticket_code.strip() or "feedback"
    return f"{safe_ticket}_{date}.zip"


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
    missing: list[str] | None = None,
    has_chat: bool = False,
) -> str:
    """For-LLM prompt block + ticket quick-summary."""
    submitter = submitter or {}
    submitter_email = submitter.get("email") or "(unknown)"
    submitter_role = submitter.get("role") or "(unknown)"

    chat_hint = (
        "> Read `chat/transcript.md` for the user's own words, "
        "`chat/synthesis.md` for the user-validated specification, and "
        "`chat/calls.json` for the LLM audit trail (model / latency / "
        "status per turn).\n"
        if has_chat
        else ""
    )

    lines: list[str] = [
        f"# Feedback ticket {fb.ticket_code}",
        "",
        "**Hand this to a coding LLM with this prompt**:",
        "",
        "> You are a senior engineer. Resolve this feedback ticket. The",
        "> screenshot shows the user's view at submission time. The",
        "> `metadata.json` file contains the technical context (route,",
        "> viewport, console + network tail, app version + git sha).",
        "> Read every file in this archive — `ticket.md`, `triage.md`,",
        f"> `attachments/*` (user-uploaded wireframes, logs, notes).",
        chat_hint,
        f"> Return a plan and concrete patches against the codebase at "
        f"{repo_url or '(repo URL not configured)'}.",
        "",
        "## Quick summary",
        "",
        f"- **Type**: {fb.type.value}",
        f"- **Severity**: {fb.severity.value if fb.severity else '(unset)'}",
        f"- **Status**: {_STATUS_LABEL.get(fb.status, fb.status.value)}",
        f"- **Title**: {fb.title}",
        f"- **Submitter**: {submitter_email} ({submitter_role})",
        f"- **Created**: {_fmt_dt(fb.created_at)}",
        f"- **URL captured**: {fb.url_captured}",
        f"- **Route**: {fb.route_name or '—'}",
        f"- **Element**: {fb.element_selector or '(whole-page)'}",
        f"- **App version**: {fb.app_version or '—'}",
        f"- **Git SHA**: {fb.git_commit_sha or '—'}",
    ]
    if missing:
        lines.extend(
            [
                "",
                "## ⚠️ Missing artefacts",
                "",
                "These files were referenced by the ticket but could not be",
                "embedded in this bundle (transient storage error). The LLM",
                "should not assume they are absent — flag them in the response:",
                "",
                *(f"- `{m}`" for m in missing),
            ]
        )
    return "\n".join(lines) + "\n"


def _render_ticket(fb: Feedback) -> str:
    """Long-form markdown of the feedback row."""
    lines: list[str] = [
        f"# {fb.title}",
        "",
        f"- **Ticket**: `{fb.ticket_code}`",
        f"- **Type**: {fb.type.value}",
        f"- **Severity**: {fb.severity.value if fb.severity else '(unset)'}",
        f"- **Created**: {_fmt_dt(fb.created_at)}",
        "",
        "## Description",
        "",
        fb.description or "_(no description)_",
        "",
    ]
    if fb.expected_outcome:
        lines.extend(["## Expected outcome", "", fb.expected_outcome, ""])
    return "\n".join(lines)


def _render_triage(fb: Feedback) -> str:
    """Status + triage note markdown."""
    lines: list[str] = [
        "# Triage",
        "",
        f"- **Current status**: `{fb.status.value}` "
        f"({_STATUS_LABEL.get(fb.status, fb.status.value)})",
        f"- **Triaged by**: {fb.triaged_by or '—'}",
        f"- **Triaged at**: {_fmt_dt(fb.triaged_at)}",
        "",
        "## Note",
        "",
        (fb.triage_note.strip() if fb.triage_note else "_(no triage note yet)_"),
        "",
    ]
    return "\n".join(lines)


def _render_chat_transcript(messages: list[dict[str, Any]]) -> str:
    """Render the chat conversation as readable markdown."""
    if not messages:
        return "# Chat transcript\n\n_(empty)_\n"
    lines: list[str] = ["# Chat transcript", ""]
    for msg in messages:
        role = str(msg.get("role", "?")).upper()
        text = str(msg.get("text", ""))
        ts = msg.get("ts", "")
        lines.extend([f"## {role}  _{ts}_", "", text, ""])
        if msg.get("role") == "assistant":
            covered = msg.get("covered")
            if isinstance(covered, dict) and covered:
                covered_summary = ", ".join(
                    f"{k}={v:.1f}" for k, v in covered.items()
                )
                lines.append(f"_coverage: {covered_summary}_")
            inferred = msg.get("inferred")
            if isinstance(inferred, dict) and inferred:
                lines.append(
                    f"_inferred: type={inferred.get('type')} "
                    f"severity={inferred.get('severity')}_"
                )
            lines.append("")
    return "\n".join(lines)


def _render_chat_synthesis(synthesis: dict[str, Any]) -> str:
    """Render the structured synthesis (ChatSynthesis shape) as markdown."""
    lines: list[str] = [f"# {synthesis.get('title', '(no title)')}", ""]
    summary = synthesis.get("summary")
    if summary:
        lines.extend(["## Summary", "", str(summary), ""])
    user_story = synthesis.get("user_story")
    if user_story:
        lines.extend(["## User story", "", f"> {user_story}", ""])
    context = synthesis.get("context")
    if context:
        lines.extend(["## Context", "", str(context), ""])
    user_need = synthesis.get("user_need")
    if user_need:
        lines.extend(["## User need", "", str(user_need), ""])
    personas = synthesis.get("personas") or []
    if personas:
        lines.extend(["## Personas", ""])
        for p in personas:
            if not isinstance(p, dict):
                continue
            lines.append(f"- **{p.get('name', '(unnamed)')}**")
            if p.get("goal"):
                lines.append(f"  - goal: {p['goal']}")
            if p.get("frustration"):
                lines.append(f"  - frustration: {p['frustration']}")
        lines.append("")
    user_stories = synthesis.get("user_stories") or []
    if user_stories:
        lines.extend(["## Additional user stories", ""])
        for s in user_stories:
            lines.append(f"- {s}")
        lines.append("")
    ac = synthesis.get("acceptance_criteria") or []
    if ac:
        lines.extend(["## Acceptance criteria", ""])
        for c in ac:
            lines.append(f"- {c}")
        lines.append("")
    assumptions = synthesis.get("assumptions") or []
    if assumptions:
        lines.extend(["## Assumptions", ""])
        for a in assumptions:
            lines.append(f"- {a}")
        lines.append("")
    diagram = synthesis.get("diagram")
    if diagram:
        lines.extend(["## Diagram", "", "```mermaid", str(diagram), "```", ""])
    open_questions = synthesis.get("open_questions") or []
    if open_questions:
        lines.extend(["## Open questions", ""])
        for q in open_questions:
            lines.append(f"- {q}")
        lines.append("")
    return "\n".join(lines)


def _resolve_chat_artifacts(
    db: Any,
    chat_session_id: uuid.UUID,
) -> dict[str, str] | None:
    """Build the ``chat/`` directory entries for the ZIP.

    Returns ``None`` when the chat session row does not exist (admin
    deleted it, or feedback came from legacy multipart endpoint). Errors
    are logged and swallowed so the rest of the bundle still ships.
    """
    from sqlmodel import select

    from feedback_widget.chat_models import (
        FeedbackChatCall,
        FeedbackChatSession,
    )

    try:
        chat_row = db.get(FeedbackChatSession, chat_session_id)
    except Exception as exc:
        logger.exception(
            "feedback bundle: chat session lookup failed (id=%s): %s",
            chat_session_id,
            exc,
        )
        return None
    if chat_row is None:
        return None

    files: dict[str, str] = {}
    messages = list(chat_row.messages or [])
    synthesis = chat_row.synthesis_json or {}

    files["chat/session.json"] = json.dumps(
        {
            "id": str(chat_row.id),
            "mode": chat_row.mode.value,
            "status": chat_row.status.value,
            "messages": messages,
            "synthesis_json": synthesis,
            "auto_context": chat_row.auto_context or {},
            "detected_language": chat_row.detected_language,
            "created_at": _fmt_dt(chat_row.created_at),
            "confirmed_at": _fmt_dt(chat_row.confirmed_at),
        },
        indent=2,
        default=str,
        ensure_ascii=False,
    )
    files["chat/transcript.md"] = _render_chat_transcript(messages)
    if isinstance(synthesis, dict) and synthesis:
        files["chat/synthesis.md"] = _render_chat_synthesis(synthesis)

    try:
        calls = list(
            db.exec(
                select(FeedbackChatCall)
                .where(FeedbackChatCall.chat_session_id == chat_session_id)
                .order_by(FeedbackChatCall.created_at)  # type: ignore[arg-type]
            ).all()
        )
    except Exception as exc:
        logger.exception(
            "feedback bundle: chat calls lookup failed (id=%s): %s",
            chat_session_id,
            exc,
        )
        calls = []

    files["chat/calls.json"] = json.dumps(
        [
            {
                "id": str(c.id),
                "turn_index": c.turn_index,
                "model_id": c.model_id,
                "model_provider": c.model_provider,
                "input_tokens": c.input_tokens,
                "output_tokens": c.output_tokens,
                "cost_usd": float(c.cost_usd) if c.cost_usd is not None else None,
                "latency_ms": c.latency_ms,
                "status": c.status.value,
                "attempt_number": c.attempt_number,
                "error_message": c.error_message,
                "prompt_sha256": c.prompt_sha256,
                "prompt_version": c.prompt_version,
                "created_at": _fmt_dt(c.created_at),
            }
            for c in calls
        ],
        indent=2,
        default=str,
        ensure_ascii=False,
    )
    return files


def _serialise_feedback_row(fb: Feedback) -> str:
    """Full Feedback row JSON dump for the LLM to inspect raw."""
    return json.dumps(
        {
            "id": str(fb.id),
            "tenant_id": str(fb.tenant_id) if fb.tenant_id else None,
            "user_id": str(fb.user_id),
            "type": fb.type.value,
            "status": fb.status.value,
            "severity": fb.severity.value if fb.severity else None,
            "title": fb.title,
            "description": fb.description,
            "expected_outcome": fb.expected_outcome,
            "url_captured": fb.url_captured,
            "route_name": fb.route_name,
            "element_selector": fb.element_selector,
            "element_xpath": fb.element_xpath,
            "element_bounding_box": fb.element_bounding_box,
            "metadata_bundle": fb.metadata_bundle,
            "app_version": fb.app_version,
            "git_commit_sha": fb.git_commit_sha,
            "user_agent": fb.user_agent,
            "ticket_code": fb.ticket_code,
            "chat_session_id": str(fb.chat_session_id)
            if fb.chat_session_id
            else None,
            "synthesis_json": fb.synthesis_json,
            "created_at": _fmt_dt(fb.created_at),
            "updated_at": _fmt_dt(fb.updated_at),
            "triaged_by": str(fb.triaged_by) if fb.triaged_by else None,
            "triaged_at": _fmt_dt(fb.triaged_at),
            "triage_note": fb.triage_note,
        },
        indent=2,
        default=str,
        ensure_ascii=False,
    )


def build_feedback_bundle(
    *,
    fb: Feedback,
    attachments: list[FeedbackAttachment],
    storage: Any,
    repo_url: str = DEFAULT_REPO_URL,
    submitter: dict[str, str | None] | None = None,
    db: Any = None,
) -> bytes:
    """Build the LLM-handoff ZIP for ``fb`` and return its bytes.

    Sprint C: the iter-module artefacts are gone. When the feedback has
    a linked chat session AND ``db`` is provided, the ZIP includes a
    ``chat/`` directory with the conversation + structured synthesis +
    call audit trail. Otherwise the ZIP carries only the feedback row +
    attachments.

    ``storage`` must implement ``download(key, bucket) -> bytes`` (the
    :class:`feedback_widget.storage.StorageBackend` protocol). Typed as
    ``Any`` so this module stays storage-agnostic.
    """
    metadata = fb.metadata_bundle or {}
    missing: list[str] = []

    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("ticket.md", _render_ticket(fb))
        archive.writestr("triage.md", _render_triage(fb))
        archive.writestr("feedback.json", _serialise_feedback_row(fb))
        archive.writestr(
            "metadata.json", json.dumps(metadata, indent=2, default=str)
        )

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
            except _STORAGE_DOWNLOAD_ERRORS as exc:
                logger.warning(
                    "feedback bundle: screenshot download failed for ticket=%s key=%s: %s",
                    fb.ticket_code or fb.id,
                    screenshot_attachment.object_key,
                    exc,
                )
                missing.append("screenshot.png")

        # User-uploaded attachments under attachments/.
        for a in attachments:
            if a.kind != FeedbackAttachmentKind.USER_ATTACHMENT:
                continue
            safe_name = a.filename or "attachment"
            try:
                content = storage.download(a.object_key, bucket=a.bucket)
                archive.writestr(f"attachments/{safe_name}", content)
            except _STORAGE_DOWNLOAD_ERRORS as exc:
                logger.warning(
                    "feedback bundle: attachment download failed for ticket=%s key=%s: %s",
                    fb.ticket_code or fb.id,
                    a.object_key,
                    exc,
                )
                missing.append(f"attachments/{safe_name}")
                continue

        # Chat-first artefacts (Sprint C). Only when the feedback row
        # links to a chat session AND the caller passed a db handle.
        has_chat = False
        if fb.chat_session_id is not None and db is not None:
            chat_files = _resolve_chat_artifacts(db, fb.chat_session_id)
            if chat_files:
                has_chat = True
                for relpath, body in chat_files.items():
                    archive.writestr(relpath, body)

        # README is written AFTER the file fetches so it can list any
        # artefacts that failed to embed and mention chat presence.
        readme_body = _render_readme(
            fb,
            submitter=submitter,
            repo_url=repo_url,
            missing=missing,
            has_chat=has_chat,
        )
        archive.writestr("README.md", readme_body)

        # Raw extracts pulled out of metadata_bundle for direct LLM
        # ingestion. Ship empty list when missing so the LLM doesn't
        # have to guess between 'absent' and 'no events'.
        archive.writestr(
            "raw/console_tail.json",
            json.dumps(metadata.get("console_tail") or [], indent=2, default=str),
        )
        archive.writestr(
            "raw/network_errors_tail.json",
            json.dumps(
                metadata.get("network_errors_tail") or [], indent=2, default=str
            ),
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
