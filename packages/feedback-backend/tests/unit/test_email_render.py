"""Email render: every Jinja template renders without exceptions."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest

from feedback_widget.email.render import (
    build_feedback_email,
    build_status_transition_email,
)
from feedback_widget.email.rendering import render_template
from feedback_widget.models import Feedback, FeedbackStatus, FeedbackType
from feedback_widget.settings import FeedbackSettings


def _row(**overrides: object) -> Feedback:
    """Build a minimally populated Feedback row for template rendering."""
    base: dict[str, object] = {
        "id": uuid.uuid4(),
        "tenant_id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "type": FeedbackType.BUG,
        "status": FeedbackStatus.NEW,
        "title": "Login fails",
        "description": "Steps to reproduce: open /login, ...",
        "url_captured": "http://localhost/login",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
        "ticket_code": "FB-2026-0001",
        "metadata_bundle": {"viewport": "1280x720"},
        "linked_user_stories": [],
        "type_fields": {},
        "consent_metadata_capture": True,
    }
    base.update(overrides)
    return Feedback(**base)  # type: ignore[arg-type]


@pytest.fixture
def settings() -> FeedbackSettings:
    return FeedbackSettings()


def test_render_base_html_does_not_explode() -> None:
    html = render_template("base.html", brand_name="X", subject="hello")
    assert "X" in html


@pytest.mark.parametrize(
    "ftype",
    [
        FeedbackType.BUG,
        FeedbackType.NEW_FEATURE,
        FeedbackType.EXTEND_FEATURE,
        FeedbackType.NEW_USER_STORY,
        FeedbackType.QUESTION,
        FeedbackType.UX_POLISH,
        FeedbackType.PERFORMANCE,
        FeedbackType.DATA_ISSUE,
    ],
)
def test_notification_email_renders_for_every_type(
    ftype: FeedbackType, settings: FeedbackSettings
) -> None:
    fb = _row(type=ftype)
    subject, html, text = build_feedback_email(
        feedback=fb,
        submitter_email="user@test.local",
        presigned_url=None,
        settings=settings,
    )
    assert fb.title in subject
    assert ftype.value.upper().replace("_", " ") in subject
    assert fb.title in html
    assert fb.title in text


@pytest.mark.parametrize(
    "status",
    [
        FeedbackStatus.TRIAGED,
        FeedbackStatus.IN_PROGRESS,
        FeedbackStatus.DONE,
        FeedbackStatus.WONT_FIX,
        FeedbackStatus.ACCEPTED_BY_USER,
        FeedbackStatus.REJECTED_BY_USER,
    ],
)
def test_status_transition_email_renders_for_every_status(
    status: FeedbackStatus, settings: FeedbackSettings
) -> None:
    fb = _row(status=status)
    subject, html, text = build_status_transition_email(
        feedback=fb,
        accept_url="http://x/accept",
        reject_url="http://x/reject",
        settings=settings,
    )
    assert fb.ticket_code in subject
    # Renderer uses human-friendly labels (new->New, done->Resolved,
    # wont_fix->Won't fix, ...). We just want a non-empty body; tighter
    # label assertions would over-couple to template wording.
    assert html
    assert fb.ticket_code in text
