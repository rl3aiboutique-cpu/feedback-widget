"""SQLModel for the chat-first redesign (v1.0.0).

One table: ``feedback_chat_session``. Source of truth during the
conversation; ``feedback`` row is created only at confirm.

Audio is NOT persisted (D-013) — voice clips are transcribed and
discarded; only the transcript lives in ``messages[].text``.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def _utc_now() -> datetime:
    return datetime.now(UTC)


class ChatSessionMode(StrEnum):
    CAPTURE = "capture"
    REFINE = "refine"


class ChatSessionStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    SYNTHESIZING = "synthesizing"
    AWAITING_CONFIRM = "awaiting_confirm"
    CONFIRMED = "confirmed"
    ABANDONED = "abandoned"


class FeedbackChatSession(SQLModel, table=True):
    __tablename__ = "feedback_chat_session"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # nullable for single-tenant hosts (sapphira) — mirrors Feedback table.
    tenant_id: uuid.UUID | None = Field(default=None, index=True)
    user_id: uuid.UUID = Field(index=True)

    mode: ChatSessionMode = Field(
        default=ChatSessionMode.CAPTURE,
        sa_column=Column(
            SAEnum(
                ChatSessionMode,
                name="chat_session_mode",
                create_constraint=False,
                values_callable=lambda enum: [m.value for m in enum],
            ),
            nullable=False,
            server_default=ChatSessionMode.CAPTURE.value,
        ),
    )
    status: ChatSessionStatus = Field(
        default=ChatSessionStatus.OPEN,
        sa_column=Column(
            SAEnum(
                ChatSessionStatus,
                name="chat_session_status",
                create_constraint=False,
                values_callable=lambda enum: [s.value for s in enum],
            ),
            nullable=False,
            server_default=ChatSessionStatus.OPEN.value,
        ),
    )

    messages: list[dict[str, Any]] = Field(
        default_factory=list,
        # NOTE: server_default lives in the migration (see 0007); the model
        # only declares default_factory so SQLAlchemy can emit INSERT without
        # the column when callers omit it. Mixing both confuses test SQLite
        # (no JSONB type) and integration Postgres (raw "[]" not cast).
        sa_column=Column(JSONB, nullable=False),
    )
    synthesis_json: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    auto_context: dict[str, Any] = Field(
        sa_column=Column(JSONB, nullable=False)
    )

    feedback_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            ForeignKey("feedback.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    glossary_snapshot: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    detected_language: str | None = Field(default=None, max_length=8)

    created_at: datetime = Field(
        default_factory=_utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    confirmed_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    abandoned_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
