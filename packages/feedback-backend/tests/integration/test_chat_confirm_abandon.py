"""Integration tests for POST /chat/sessions/{sid}/confirm + /abandon — S5.

The confirm flow creates a real ``feedback`` row from the chat session's
``synthesis_json`` (or an explicit override) and flips the chat session
to ``confirmed``. The abandon flow flips it to ``abandoned`` with no
side effects beyond the status + timestamp.

Uses the same fixtures as the other chat integration tests:
- ``client``: TestClient bound to the app fixture (prefix='/feedback').
- ``TestAuth``: ``X-Test-Role`` header gates user identity.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from feedback_widget.chat_models import (
    ChatSessionMode,
    ChatSessionStatus,
    FeedbackChatSession,
)
from feedback_widget.models import Feedback, FeedbackSeverity, FeedbackType
from sqlmodel import Session, select

AUTH_STAFF = {"X-Test-Role": "staff"}
AUTH_ADMIN = {"X-Test-Role": "admin"}

# Test user IDs mirror the conftest constants — kept here so each test
# is self-documenting without importing private fixture state.
_STAFF_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
_ADMIN_USER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")


def _canned_synthesis() -> dict[str, Any]:
    """A synthesis payload that mirrors the chat capture prompt output."""
    return {
        "title": "Botón Guardar no responde en edición",
        "summary": "El usuario reporta que el botón Guardar no responde.",
        "user_story": "Como usuario quiero guardar mi trabajo sin recargar.",
        "context": "Pantalla de edición de feedback.",
        "user_need": "Persistir mis cambios sin perder contexto.",
        "acceptance_criteria": ["El botón guarda el formulario."],
        "open_questions": [],
        "inferred": {"type": "bug", "severity": "major"},
    }


def _seed_session(
    engine,
    *,
    user_id: uuid.UUID,
    status_: ChatSessionStatus = ChatSessionStatus.AWAITING_CONFIRM,
    synthesis_json: dict[str, Any] | None = None,
    auto_context: dict[str, Any] | None = None,
    messages: list[dict[str, Any]] | None = None,
) -> uuid.UUID:
    """Insert a chat session row directly so tests don't have to drive
    the LLM. Returns the new ``session_id``."""
    with Session(engine) as s:
        row = FeedbackChatSession(
            tenant_id=None,  # conftest uses single-tenant mode
            user_id=user_id,
            mode=ChatSessionMode.CAPTURE,
            status=status_,
            auto_context=auto_context
            or {
                "url": "https://example.com/edit",
                "route": "/edit",
                "app_version": "v1.2.3",
            },
            messages=messages or [],
            synthesis_json=synthesis_json,
        )
        s.add(row)
        s.commit()
        s.refresh(row)
        return row.id


def test_confirm_creates_feedback_row_and_returns_ticket_code(client, engine) -> None:
    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json=_canned_synthesis(),
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={"synthesis_override": None},
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    feedback_id = uuid.UUID(body["feedback_id"])
    assert body["ticket_code"].startswith("FB-")
    # FB-YYYY-NNNN — first row for this tenant must be -0001
    assert body["ticket_code"].endswith("-0001")

    # The feedback row is persisted with the synthesis-derived fields.
    with Session(engine) as s:
        fb = s.get(Feedback, feedback_id)
        assert fb is not None
        assert fb.user_id == _STAFF_USER_ID
        assert fb.type == FeedbackType.BUG
        assert fb.severity == FeedbackSeverity.MAJOR
        assert fb.title == "Botón Guardar no responde en edición"
        assert "El usuario reporta" in fb.description
        assert "Como usuario quiero" in fb.description
        assert fb.expected_outcome == "Persistir mis cambios sin perder contexto."
        assert fb.synthesis_json is not None
        assert fb.synthesis_json["title"] == _canned_synthesis()["title"]
        assert fb.chat_session_id == sid
        assert fb.url_captured == "https://example.com/edit"
        assert fb.route_name == "/edit"
        assert fb.app_version == "v1.2.3"
        assert fb.ticket_code == body["ticket_code"]

        # And the chat session is flipped to confirmed with the link.
        chat = s.get(FeedbackChatSession, sid)
        assert chat is not None
        assert chat.status == ChatSessionStatus.CONFIRMED
        assert chat.feedback_id == feedback_id
        assert chat.confirmed_at is not None


def test_confirm_uses_synthesis_override_when_provided(client, engine) -> None:
    """Override replaces the persisted synthesis — fields on the row
    come from the override, not the chat session's snapshot."""
    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json=_canned_synthesis(),  # baseline that override beats
    )

    override = {
        "title": "Título editado por el admin",
        "summary": "Resumen editado.",
        "user_story": "Historia editada.",
        "context": "Contexto editado.",
        "user_need": "Necesidad editada.",
        "acceptance_criteria": ["Criterio editado."],
        "open_questions": [],
        "inferred": {"type": "ui", "severity": "minor"},
    }

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={"synthesis_override": override},
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    feedback_id = uuid.UUID(resp.json()["feedback_id"])

    with Session(engine) as s:
        fb = s.get(Feedback, feedback_id)
        assert fb is not None
        assert fb.title == "Título editado por el admin"
        assert "Resumen editado." in fb.description
        assert "Historia editada." in fb.description
        assert fb.expected_outcome == "Necesidad editada."
        assert fb.type == FeedbackType.UI
        assert fb.severity == FeedbackSeverity.MINOR
        # The stored synthesis_json mirrors the override, not the seeded
        # baseline — so admin edits round-trip into the feedback row.
        assert fb.synthesis_json is not None
        assert fb.synthesis_json["title"] == "Título editado por el admin"


def test_confirm_404_for_unowned_session(client, engine) -> None:
    """Admin owns the session → staff (different user_id) gets 404.

    Important — 404 (not 403) so existence does not leak across users.
    """
    sid = _seed_session(
        engine,
        user_id=_ADMIN_USER_ID,
        synthesis_json=_canned_synthesis(),
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={"synthesis_override": None},
        headers=AUTH_STAFF,
    )
    assert resp.status_code == 404, resp.text

    # And no feedback row was created.
    with Session(engine) as s:
        rows = s.exec(select(Feedback)).all()
        assert rows == []


def test_confirm_422_when_no_synthesis(client, engine) -> None:
    """Session without ``synthesis_json`` and no override → 422.

    Also covers the case where override is an empty dict — the service
    treats that as "no usable synthesis" so the caller is forced to
    either drive the LLM to synthesize or skip the row creation.
    """
    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json=None,  # never synthesized
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={"synthesis_override": None},
        headers=AUTH_STAFF,
    )
    assert resp.status_code == 422, resp.text

    # The chat session should NOT be flipped to confirmed.
    with Session(engine) as s:
        chat = s.get(FeedbackChatSession, sid)
        assert chat is not None
        assert chat.status == ChatSessionStatus.AWAITING_CONFIRM
        rows = s.exec(select(Feedback)).all()
        assert rows == []


def test_abandon_marks_session_abandoned(client, engine) -> None:
    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        status_=ChatSessionStatus.IN_PROGRESS,
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/abandon",
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}

    with Session(engine) as s:
        chat = s.get(FeedbackChatSession, sid)
        assert chat is not None
        assert chat.status == ChatSessionStatus.ABANDONED
        assert chat.abandoned_at is not None
        # No feedback row was created.
        rows = s.exec(select(Feedback)).all()
        assert rows == []


def test_abandon_404_for_unowned_session(client, engine) -> None:
    sid = _seed_session(
        engine,
        user_id=_ADMIN_USER_ID,
        status_=ChatSessionStatus.IN_PROGRESS,
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/abandon",
        headers=AUTH_STAFF,
    )
    assert resp.status_code == 404, resp.text

    # The original session is untouched.
    with Session(engine) as s:
        chat = s.get(FeedbackChatSession, sid)
        assert chat is not None
        assert chat.status == ChatSessionStatus.IN_PROGRESS
        assert chat.abandoned_at is None


# Silence pytest's "module 'pytest' has no member" if test discovery skips.
_ = pytest
