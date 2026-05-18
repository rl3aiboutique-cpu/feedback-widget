"""Unit tests for chat_models.py SQLModel."""

from __future__ import annotations

import uuid
from datetime import datetime

from feedback_widget.chat_models import (
    ChatSessionMode,
    ChatSessionStatus,
    FeedbackChatSession,
)


def test_chat_session_defaults() -> None:
    session = FeedbackChatSession(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        auto_context={"url": "https://example.com", "route": "/foo"},
    )
    assert session.id is not None
    assert session.mode == ChatSessionMode.CAPTURE
    assert session.status == ChatSessionStatus.OPEN
    assert session.messages == []
    assert session.synthesis_json is None
    assert session.detected_language is None
    assert isinstance(session.created_at, datetime)


def test_chat_session_mode_enum_values() -> None:
    assert ChatSessionMode.CAPTURE.value == "capture"
    assert ChatSessionMode.REFINE.value == "refine"


def test_chat_session_status_enum_values() -> None:
    statuses = {s.value for s in ChatSessionStatus}
    assert statuses == {
        "open",
        "in_progress",
        "synthesizing",
        "awaiting_confirm",
        "confirmed",
        "abandoned",
    }
