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
import logging
from contextlib import suppress
from datetime import UTC, datetime
from io import BytesIO
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

from feedback_widget.iter_models import (
    FeedbackIterAssumption,
    FeedbackIterSession,
    FeedbackIterSessionStatus,
    FeedbackIterVersion,
)
from feedback_widget.iter_packager import (
    AssumptionResolution,
    IterationLogEntry,
)
from feedback_widget.iter_render import (
    render_assumptions,
    render_diagram,
    render_iteration_log,
    render_personas,
    render_spec,
    render_user_stories,
)
from feedback_widget.iter_schemas import IterationOutput
from feedback_widget.models import (
    Feedback,
    FeedbackAttachment,
    FeedbackAttachmentKind,
    FeedbackStatus,
)

logger = logging.getLogger(__name__)


# Storage backends the widget supports raise these (boto3 BotoCoreError
# / ClientError, file-backend OSError) plus generic stragglers
# (RuntimeError, ValueError on truncated downloads). Catch the union so
# we can log + record which artefact was missed without taking a hard
# dependency on boto3 here.
def _import_boto_errors() -> tuple[type[BaseException], ...]:
    with suppress(ImportError):
        from botocore.exceptions import BotoCoreError, ClientError

        return (BotoCoreError, ClientError, OSError, RuntimeError)
    return (OSError, RuntimeError)


_STORAGE_DOWNLOAD_ERRORS: tuple[type[BaseException], ...] = _import_boto_errors()

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
    missing: list[str] | None = None,
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
    if missing:
        lines += [
            "## ⚠️ Missing artefacts",
            "",
            "The following file(s) were expected in this archive but the storage",
            "backend failed to deliver them. Triage with this caveat in mind —",
            "the LLM is reading reduced context.",
            "",
        ]
        lines += [f"- `{path}`" for path in missing]
        lines.append("")
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


_ITER_STATUS_PRECEDENCE: dict[FeedbackIterSessionStatus, int] = {
    FeedbackIterSessionStatus.FINALIZED: 0,
    FeedbackIterSessionStatus.ITERATING: 1,
    FeedbackIterSessionStatus.DRAFT: 2,
    FeedbackIterSessionStatus.ABANDONED: 3,
}


def _resolve_active_iter_session(
    db: Any,
    feedback_id: Any,
) -> FeedbackIterSession | None:
    """Pick the most informative iter session for this feedback.

    Preference order: FINALIZED > ITERATING > DRAFT > ABANDONED. Within
    a tier, pick the most-recently-created. Returns ``None`` if the
    feedback has no iter session at all.
    """
    from sqlalchemy import select

    rows = (
        db.execute(
            select(FeedbackIterSession)
            .where(FeedbackIterSession.feedback_id == feedback_id)
            .order_by(FeedbackIterSession.created_at.desc())
        )
        .scalars()
        .all()
    )
    if not rows:
        return None
    rows.sort(
        key=lambda s: (
            _ITER_STATUS_PRECEDENCE.get(s.status, 99),
            -(s.created_at.timestamp() if s.created_at else 0),
        )
    )
    return rows[0]


def _render_iter_artifacts(
    db: Any,
    session: FeedbackIterSession,
) -> dict[str, str]:
    """Render every iter artefact for ``session`` as a relative-path → body map.

    Mirrors the layout :mod:`iter_packager` produces, but rooted under
    ``iter/`` so the admin bundle can drop them in directly. Adds an
    ``iter/versions/v0N.md`` per persisted version so the audit trail is
    inline and not just summarised in ``06_iteration_log.md``.
    """
    from sqlalchemy import select

    files: dict[str, str] = {}

    versions = list(
        db.execute(
            select(FeedbackIterVersion)
            .where(FeedbackIterVersion.session_id == session.id)
            .order_by(FeedbackIterVersion.version_number)
        )
        .scalars()
        .all()
    )

    if not versions:
        files["iter/STATUS.md"] = (
            "# Iter session — no versions yet\n\n"
            f"Session id: `{session.id}`\n"
            f"Status: `{session.status.value}`\n"
            "No iteration has produced a working document yet.\n"
        )
        return files

    final_version = versions[-1]
    final_output = IterationOutput.model_validate(final_version.output_json)

    # Assumptions: latest resolution per slot_key across all versions.
    asm_rows = list(
        db.execute(
            select(FeedbackIterAssumption)
            .join(
                FeedbackIterVersion,
                FeedbackIterVersion.id == FeedbackIterAssumption.version_id,
            )
            .where(FeedbackIterVersion.session_id == session.id)
        )
        .scalars()
        .all()
    )
    by_slot: dict[str, FeedbackIterAssumption] = {}
    for r in asm_rows:
        ex = by_slot.get(r.slot_key)
        if ex is None or (r.created_at and ex.created_at and r.created_at > ex.created_at):
            by_slot[r.slot_key] = r
    assumption_resolutions = [
        AssumptionResolution(
            slot_key=r.slot_key,
            kind=r.kind.value,
            statement=r.statement,
            status=r.status,
            user_response=r.user_response,
        )
        for r in by_slot.values()
    ]

    iteration_log = [
        IterationLogEntry(
            version_number=v.version_number,
            created_at=v.created_at or datetime.now(UTC),
            user_message=v.user_message,
            restructure_allowed=v.restructure_allowed,
            changes_summary=(
                v.output_json.get("changes_summary", "") if isinstance(v.output_json, dict) else ""
            ),
        )
        for v in versions
    ]

    files["iter/_AI_INSTRUCTIONS.md"] = (
        "# AI Consumer Instructions (admin bundle copy)\n\n"
        "This is the iter half of the admin bundle. The user's original\n"
        "feedback + attachments + technical metadata live at the top of\n"
        "the bundle (00_feedback.md, screenshot.png, attachments/, etc).\n"
        "Read those first as raw input; treat the iter/ artefacts as\n"
        "the user-validated specification.\n"
    )
    files["iter/01_personas.md"] = render_personas(final_output.personas)
    files["iter/02_user_stories.md"] = render_user_stories(
        final_output.user_stories, final_output.personas
    )
    files["iter/03_spec.md"] = render_spec(final_output.spec)
    files["iter/04_diagram.md"] = render_diagram(final_output.diagram)
    files["iter/05_assumptions_resolved.md"] = render_assumptions(assumption_resolutions)
    files["iter/06_iteration_log.md"] = render_iteration_log(iteration_log)

    # Per-version markdown — audit trail. v01.md, v02.md, …, vN.md
    # (N is the last persisted iteration). Width-2 zero-pad up to v99,
    # then natural width — sessions hit the ITER_MAX_TURNS=5 cap long
    # before that's a problem.
    for v in versions:
        files[f"iter/versions/v{v.version_number:02d}.md"] = v.output_markdown or ""

    return files


def _render_iter_summary(
    session: FeedbackIterSession | None,
    versions_count: int,
    open_count: int,
    total_count: int,
) -> str:
    """Top-of-README block summarising iter state for the admin."""
    if session is None:
        return "## Iteration summary\n\n_No AI iteration was run for this ticket._\n"
    if versions_count == 0:
        return (
            "## Iteration summary\n\n"
            f"- Status: `{session.status.value}`\n"
            f"- Rounds: 0\n"
            "- No working document yet.\n"
        )
    resolved = max(0, total_count - open_count)
    return (
        "## Iteration summary\n\n"
        f"- Status: `{session.status.value}`\n"
        f"- Rounds: {versions_count}\n"
        f"- Resolved assumptions: {resolved} of {total_count}\n"
        f"- Open assumptions: {open_count}\n"
        f"- See `iter/03_spec.md` for the implementation contract; "
        f"`iter/versions/v{versions_count:02d}.md` for the verbatim last iteration.\n"
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

    The caller (router) is responsible for tenant scoping — by the
    time we get here, every artefact has already been tenant-checked.

    ``storage`` must implement ``download(key, bucket) -> bytes``
    (the existing :class:`feedback_widget.storage.StorageBackend`
    protocol). Typed as ``Any`` here so this module doesn't import the
    concrete backend.
    """
    metadata = fb.metadata_bundle or {}
    missing: list[str] = []

    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
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
            except _STORAGE_DOWNLOAD_ERRORS as exc:
                # Log loudly so transient storage failures don't ship
                # silent broken bundles. Surface in the README so the
                # LLM (and the admin) know the screenshot was supposed
                # to be there.
                logger.warning(
                    "feedback bundle: screenshot download failed for ticket=%s key=%s: %s",
                    fb.ticket_code or fb.id,
                    screenshot_attachment.object_key,
                    exc,
                )
                missing.append("screenshot.png")

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
            except _STORAGE_DOWNLOAD_ERRORS as exc:
                logger.warning(
                    "feedback bundle: attachment download failed for ticket=%s key=%s: %s",
                    fb.ticket_code or fb.id,
                    a.object_key,
                    exc,
                )
                missing.append(f"attachments/{safe_name}")
                continue

        # Iter artefacts — added in v0.4.1 so a single download
        # captures the whole story (feedback + every iteration + final
        # spec + clarifications). When the caller didn't pass a DB
        # session, we write a status marker and skip the rest so the
        # bundle still builds in tests / scripts that don't have one.
        iter_session = None
        iter_files: dict[str, str] = {}
        iter_summary_block: str | None = None
        if db is not None:
            iter_session = _resolve_active_iter_session(db, fb.id)
            if iter_session is None:
                iter_files["iter/STATUS.md"] = (
                    "# Iter session\n\nNo AI iteration was run for this ticket.\n"
                )
                iter_summary_block = _render_iter_summary(None, 0, 0, 0)
            else:
                iter_files = _render_iter_artifacts(db, iter_session)
                # Counts for the summary block. Pull cheap stats here
                # instead of re-running queries inside the renderer.
                from sqlalchemy import select

                versions_count = int(
                    db.execute(
                        select(FeedbackIterVersion).where(
                            FeedbackIterVersion.session_id == iter_session.id
                        )
                    )
                    .scalars()
                    .all()
                    .__len__()
                )
                latest_version_id = iter_session.current_iteration_id
                open_count = 0
                total_count = 0
                if latest_version_id is not None:
                    asm_on_latest = list(
                        db.execute(
                            select(FeedbackIterAssumption).where(
                                FeedbackIterAssumption.version_id == latest_version_id
                            )
                        )
                        .scalars()
                        .all()
                    )
                    user_facing = [a for a in asm_on_latest if a.kind.value != "technical"]
                    total_count = len(user_facing)
                    open_count = sum(1 for a in user_facing if a.status.value == "open")
                iter_summary_block = _render_iter_summary(
                    iter_session, versions_count, open_count, total_count
                )

        for relpath, body in iter_files.items():
            archive.writestr(relpath, body)

        # README is written AFTER the file fetches so it can list any
        # artefacts that failed to embed — gives the LLM a clear signal
        # rather than guessing why context is missing.
        readme_body = _render_readme(
            fb,
            submitter=submitter,
            repo_url=repo_url,
            missing=missing,
        )
        if iter_summary_block:
            # Inject the iter summary right after the H1 + bold prompt
            # paragraph so admins see it before they scan the file list.
            readme_body = readme_body + "\n" + iter_summary_block
        archive.writestr("README.md", readme_body)

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
