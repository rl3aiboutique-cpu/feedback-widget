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
        "expected_outcome": "Login should succeed for valid credentials.",
        "url_captured": "http://localhost/login",
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
        "ticket_code": "FB-2026-0001",
        "metadata_bundle": {"viewport": "1280x720"},
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
        FeedbackType.UI,
        FeedbackType.PERFORMANCE,
        FeedbackType.NEW_FEATURE,
        FeedbackType.EXTEND_FEATURE,
        FeedbackType.OTHER,
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
        extra_attachment_count=2,
        settings=settings,
    )
    assert fb.title in subject
    assert fb.title in html
    assert fb.title in text
    # Extra-attachment count should be surfaced in the body when > 0.
    assert "2 additional file" in html
    assert "2 additional file" in text


@pytest.mark.parametrize(
    "status",
    [
        FeedbackStatus.TRIAGED,
        FeedbackStatus.IN_PROGRESS,
        FeedbackStatus.DONE,
        FeedbackStatus.WONT_FIX,
    ],
)
def test_status_transition_email_renders_for_every_status(
    status: FeedbackStatus, settings: FeedbackSettings
) -> None:
    fb = _row(status=status)
    subject, html, text = build_status_transition_email(
        feedback=fb,
        settings=settings,
    )
    assert fb.ticket_code in subject
    # Renderer uses human-friendly labels (new->New, done->Resolved,
    # wont_fix->Won't fix, ...). We just want a non-empty body.
    assert html
    assert fb.ticket_code in text
    # No accept/reject magic-link URLs after v0.2.0.
    assert "/accept" not in html
    assert "/reject" not in html
