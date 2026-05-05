"""Email builder for the Iterate-with-AI finalize notification.

Mirrors the existing ``feedback_notification`` builder shape but
renders the iter-finalized template pair. Sending uses the same
``mailer.send_email`` path as everywhere else in the widget.
"""

from __future__ import annotations

from dataclasses import dataclass

from .rendering import render_template


@dataclass(frozen=True)
class IterFinalizedEmail:
    subject: str
    html_body: str
    text_body: str


def build_iter_finalized_email(
    *,
    feedback: object,
    submitter_email: str,
    version_count: int,
    call_count: int,
    model_id: str,
    consumer_model: str,
    presigned_zip_url: str,
    deep_link: str | None,
    brand_name: str,
) -> IterFinalizedEmail:
    """Render the subject + html + plain text bodies."""
    subject = (
        f"[Iterate-with-AI finalized] "
        f"{getattr(feedback, 'title', 'Feedback')}"
    )
    context = {
        "feedback": feedback,
        "submitter_email": submitter_email,
        "version_count": version_count,
        "call_count": call_count,
        "model_id": model_id,
        "consumer_model": consumer_model or "Claude Code Opus 4.7",
        "presigned_zip_url": presigned_zip_url,
        "deep_link": deep_link,
        "brand_name": brand_name,
    }
    return IterFinalizedEmail(
        subject=subject,
        html_body=render_template("feedback_iter_finalized.html", **context),
        text_body=render_template("feedback_iter_finalized.txt", **context),
    )
