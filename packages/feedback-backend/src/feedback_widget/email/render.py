"""Build the feedback notification email from a Feedback row.

Pure rendering — no SMTP. Returns ``(subject, html, text)``. The router
hands the result to :func:`feedback_widget.email.send_email` via a
FastAPI ``BackgroundTasks`` hop so the SMTP round-trip happens out of
the request path.
"""

from __future__ import annotations

import json
from typing import Any

from feedback_widget.email.rendering import render_template
from feedback_widget.models import Feedback
from feedback_widget.settings import FeedbackSettings, get_settings

_TYPE_LABELS = {
    "bug": "BUG",
    "ui": "UI",
    "performance": "PERFORMANCE",
    "new_feature": "NEW FEATURE",
    "extend_feature": "EXTEND FEATURE",
    "other": "OTHER",
}

_STATUS_LABELS = {
    "new": "New",
    "triaged": "Triaged",
    "in_progress": "In progress",
    "done": "Resolved",
    "wont_fix": "Won't fix",
}

_STATUS_INTROS = {
    "triaged": (
        "Our team has acknowledged your feedback and added it to the queue. "
        "We'll let you know when something changes."
    ),
    "in_progress": "Someone's actively working on this now.",
    "done": (
        "We believe this is fixed. Reply to this email or submit a fresh "
        "feedback if it's still not right."
    ),
    "wont_fix": (
        "We've decided not to act on this for now. The team's note explains "
        "why; you can submit a fresh feedback if you want to make the case "
        "again."
    ),
}


def _safe_pretty_json(value: Any) -> str:
    """Pretty-print arbitrary JSON-shaped values for the metadata block.

    Falls back to ``str(value)`` for anything not serialisable so the email
    never fails on a weird metadata payload.
    """
    try:
        return json.dumps(value, indent=2, default=str, ensure_ascii=False)
    except (TypeError, ValueError):
        return str(value)


def build_feedback_email(
    *,
    feedback: Feedback,
    submitter_email: str,
    presigned_url: str | None,
    extra_attachment_count: int = 0,
    settings: FeedbackSettings | None = None,
) -> tuple[str, str, str]:
    """Render the notification email for one feedback row.

    Returns ``(subject, html_body, text_body)``.

    ``presigned_url`` points at the auto-captured screenshot (inlined
    into the email). ``extra_attachment_count`` reports the number of
    user-uploaded attachments, which are not inlined — the body just
    mentions them and points the reader at the bundle ZIP.
    """
    cfg = settings or get_settings()
    type_label = _TYPE_LABELS.get(feedback.type.value, feedback.type.value.upper())
    brand = cfg.BRAND_NAME or "Feedback"
    subject = f"[{brand} Feedback] [{type_label}] {feedback.title}"

    deep_link: str | None = None
    if cfg.ADMIN_DEEP_LINK_BASE:
        base = cfg.ADMIN_DEEP_LINK_BASE.rstrip("/")
        deep_link = f"{base}/admin/feedback?id={feedback.id}"

    metadata_pretty = _safe_pretty_json(feedback.metadata_bundle)

    ctx = {
        "subject": subject,
        "brand_name": brand,
        "feedback": feedback,
        "type_label": type_label,
        "submitter_email": submitter_email,
        "presigned_url": presigned_url,
        "extra_attachment_count": extra_attachment_count,
        "deep_link": deep_link,
        "metadata_pretty": metadata_pretty,
    }

    html = render_template("feedback_notification.html", **ctx)
    text = render_template("feedback_notification.txt", **ctx)
    return subject, html, text


def build_status_transition_email(
    *,
    feedback: Feedback,
    settings: FeedbackSettings | None = None,
) -> tuple[str, str, str]:
    """Render the email sent to the submitter when feedback status transitions.

    Informational only — v0.2.0 dropped the magic-link accept/reject
    flow. The submitter learns the new state and can reply by email
    or file fresh feedback in the app.
    """
    cfg = settings or get_settings()
    brand = cfg.BRAND_NAME or "Feedback"
    status_value = feedback.status.value
    status_label = _STATUS_LABELS.get(status_value, status_value.upper())
    intro_html = _STATUS_INTROS.get(status_value)
    subject = f"[{brand} Feedback] [{feedback.ticket_code}] {status_label} — {feedback.title}"

    deep_link: str | None = None
    if cfg.ADMIN_DEEP_LINK_BASE:
        base = cfg.ADMIN_DEEP_LINK_BASE.rstrip("/")
        deep_link = f"{base}/admin/feedback?id={feedback.id}"

    ctx = {
        "subject": subject,
        "brand_name": brand,
        "feedback": feedback,
        "ticket_code": feedback.ticket_code,
        "status_label": status_label,
        "intro_html": intro_html,
        "triage_note": feedback.triage_note,
        "deep_link": deep_link,
    }

    html = render_template("feedback_status_transition.html", **ctx)
    text = render_template("feedback_status_transition.txt", **ctx)
    return subject, html, text
