"""SQLModel for the chat-first redesign (v1.0.0).

Two tables:

* ``feedback_chat_session`` — source of truth during the conversation;
  ``feedback`` row is created only at confirm.
* ``feedback_chat_call`` (Sprint C) — one audit row per LLM stream
  attempted from :meth:`ChatService.run_turn`; mirrors the legacy
  ``feedback_iter_call`` shape so admin tooling can track token cost,
  latency, and prompt revisions across the chat fleet.

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


class ChatCallStatus(StrEnum):
    """Terminal status of a single ``ChatService.run_turn`` LLM stream.

    Mirrors :class:`feedback_widget.iter_models.FeedbackIterCallStatus`
    so admin tooling can reuse the same legends.
    """

    SUCCESS = "success"
    JSON_INVALID = "json_invalid"
    TIMEOUT = "timeout"
    PROVIDER_ERROR = "provider_error"
    CANCELLED = "cancelled"


class FeedbackChatCall(SQLModel, table=True):
    """Audit row per LLM stream attempt (Sprint C / paridad iter).

    One row is appended after every ``run_turn`` call regardless of
    outcome. ``status`` tags failure modes so we can chart abandon /
    repair / timeout rates across the fleet without pulling provider
    logs. ``prompt_sha256`` lets admin tooling correlate behaviour with
    prompt revisions.
    """

    __tablename__ = "feedback_chat_call"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    chat_session_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("feedback_chat_session.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    tenant_id: uuid.UUID | None = Field(default=None)
    turn_index: int = Field(default=0)
    model_id: str = Field(max_length=200)
    model_provider: str = Field(max_length=50)
    input_tokens: int = Field(default=0)
    output_tokens: int = Field(default=0)
    cost_usd: float | None = Field(default=None)
    latency_ms: int = Field(default=0)
    status: ChatCallStatus = Field(
        sa_column=Column(
            SAEnum(
                ChatCallStatus,
                name="feedback_chat_call_status",
                create_constraint=False,
                values_callable=lambda enum_cls: [m.value for m in enum_cls],
            ),
            nullable=False,
        ),
    )
    attempt_number: int = Field(default=1)
    error_message: str | None = Field(default=None)
    prompt_sha256: str = Field(max_length=64)
    prompt_version: str | None = Field(default=None, max_length=32)
    created_at: datetime = Field(
        default_factory=_utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
