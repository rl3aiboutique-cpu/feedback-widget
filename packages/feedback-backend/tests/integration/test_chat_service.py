"""Integration tests for ChatService — exercises real Postgres + JSONB."""

from __future__ import annotations

import uuid

import pytest
from feedback_widget.chat_models import (
    ChatSessionMode,
    ChatSessionStatus,
    FeedbackChatSession,
)
from feedback_widget.chat_schemas import AutoContext, CreateChatSessionRequest
from feedback_widget.chat_service import ChatService
from sqlmodel import Session, select


@pytest.fixture
def db_session(engine):  # uses the integration `engine` fixture (Postgres)
    with Session(engine) as s:
        yield s


def test_start_session_capture_mode(db_session: Session) -> None:
    svc = ChatService()
    req = CreateChatSessionRequest(
        mode="capture",
        auto_context=AutoContext(url="https://example.com"),
    )
    tenant = uuid.uuid4()
    user = uuid.uuid4()

    resp = svc.start_session(
        session=db_session,
        tenant_id=tenant,
        user_id=user,
        payload=req,
    )

    assert resp.session_id is not None
    assert resp.greeting == "Cuéntame qué tienes en mente."
    assert resp.resume_available is False

    rows = db_session.exec(select(FeedbackChatSession)).all()
    assert len(rows) == 1
    assert rows[0].mode == ChatSessionMode.CAPTURE
    assert rows[0].status == ChatSessionStatus.OPEN
    assert rows[0].tenant_id == tenant
    assert rows[0].user_id == user


def test_start_session_refine_requires_feedback_id(db_session: Session) -> None:
    svc = ChatService()
    req = CreateChatSessionRequest(
        mode="refine",
        auto_context=AutoContext(url="https://example.com"),
    )

    with pytest.raises(ValueError, match="feedback_id required for refine mode"):
        svc.start_session(
            session=db_session,
            tenant_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            payload=req,
        )


def test_start_session_resume_available_flag(db_session: Session) -> None:
    """If user has an in_progress session, resume_available=True."""
    svc = ChatService()
    tenant = uuid.uuid4()
    user = uuid.uuid4()

    # Seed an in_progress session
    db_session.add(
        FeedbackChatSession(
            tenant_id=tenant,
            user_id=user,
            mode=ChatSessionMode.CAPTURE,
            status=ChatSessionStatus.IN_PROGRESS,
            auto_context={"url": "https://example.com"},
        )
    )
    db_session.commit()

    resp = svc.start_session(
        session=db_session,
        tenant_id=tenant,
        user_id=user,
        payload=CreateChatSessionRequest(
            mode="capture",
            auto_context=AutoContext(url="https://example.com"),
        ),
    )

    assert resp.resume_available is True


def test_list_in_progress_orders_newest_first(db_session: Session) -> None:
    svc = ChatService()
    tenant = uuid.uuid4()
    user = uuid.uuid4()

    older = FeedbackChatSession(
        tenant_id=tenant,
        user_id=user,
        mode=ChatSessionMode.CAPTURE,
        status=ChatSessionStatus.IN_PROGRESS,
        auto_context={"url": "x"},
        messages=[{"role": "user", "text": "old"}],
    )
    newer = FeedbackChatSession(
        tenant_id=tenant,
        user_id=user,
        mode=ChatSessionMode.CAPTURE,
        status=ChatSessionStatus.IN_PROGRESS,
        auto_context={"url": "x"},
        messages=[{"role": "user", "text": "new"}],
    )
    db_session.add(older)
    db_session.flush()
    db_session.add(newer)
    db_session.commit()

    result = svc.list_in_progress(session=db_session, tenant_id=tenant, user_id=user)
    assert [s.last_message_preview for s in result.sessions] == ["new", "old"]


def test_list_in_progress_preview_truncates_at_80_chars(db_session: Session) -> None:
    svc = ChatService()
    tenant = uuid.uuid4()
    user = uuid.uuid4()
    long_text = "x" * 200

    db_session.add(
        FeedbackChatSession(
            tenant_id=tenant,
            user_id=user,
            mode=ChatSessionMode.CAPTURE,
            status=ChatSessionStatus.IN_PROGRESS,
            auto_context={"url": "x"},
            messages=[{"role": "user", "text": long_text}],
        )
    )
    db_session.commit()

    result = svc.list_in_progress(session=db_session, tenant_id=tenant, user_id=user)
    assert len(result.sessions) == 1
    assert result.sessions[0].last_message_preview == "x" * 80


def test_list_in_progress_handles_empty_messages(db_session: Session) -> None:
    svc = ChatService()
    tenant = uuid.uuid4()
    user = uuid.uuid4()

    db_session.add(
        FeedbackChatSession(
            tenant_id=tenant,
            user_id=user,
            mode=ChatSessionMode.CAPTURE,
            status=ChatSessionStatus.IN_PROGRESS,
            auto_context={"url": "x"},
            messages=[],
        )
    )
    db_session.commit()

    result = svc.list_in_progress(session=db_session, tenant_id=tenant, user_id=user)
    assert len(result.sessions) == 1
    assert result.sessions[0].last_message_preview is None


def test_list_in_progress_filters_by_user_and_tenant(db_session: Session) -> None:
    svc = ChatService()
    tenant_a = uuid.uuid4()
    tenant_b = uuid.uuid4()
    user = uuid.uuid4()

    for status in [
        ChatSessionStatus.IN_PROGRESS,
        ChatSessionStatus.OPEN,
        ChatSessionStatus.CONFIRMED,
    ]:
        db_session.add(
            FeedbackChatSession(
                tenant_id=tenant_a,
                user_id=user,
                mode=ChatSessionMode.CAPTURE,
                status=status,
                auto_context={"url": "x"},
            )
        )
    # Cross-tenant noise
    db_session.add(
        FeedbackChatSession(
            tenant_id=tenant_b,
            user_id=user,
            mode=ChatSessionMode.CAPTURE,
            status=ChatSessionStatus.IN_PROGRESS,
            auto_context={"url": "x"},
        )
    )
    db_session.commit()

    result = svc.list_in_progress(
        session=db_session, tenant_id=tenant_a, user_id=user
    )

    assert len(result.sessions) == 1
    assert result.sessions[0].mode == "capture"
