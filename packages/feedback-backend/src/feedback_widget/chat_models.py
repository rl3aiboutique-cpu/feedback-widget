"""SQLModel for the unified feedback ticket entity (v1.0.0).

After the 2026-05-16 unification (grilled decision in
``vault/wiki/captures/decision/2026-05-16_grilled-ticket-unification.md``)
this module owns the *single* ``feedback_ticket`` table. There is no
longer a separate ``feedback`` row that gets created at confirm — the
ticket exists from the moment the chat sheet opens, evolves through the
conversation, and stays addressable for the entire admin × user × LLM
lifecycle.

Three tables live here:

* :class:`FeedbackTicket` — the ticket itself. Carries the chat
  ``messages`` JSONB, the synthesis, the legacy form-capture fields
  (title / description / ticket_code / status), token accounting,
  soft-delete columns, and admin loop signals (``user_action_required``,
  ``last_admin_msg_at``).
* :class:`FeedbackChatCall` — one audit row per LLM stream attempted
  from :meth:`ChatService.run_turn`. Renamed FK column
  ``chat_session_id`` → ``ticket_id`` to match the unified entity.
* :class:`FeedbackAdminAction` — one row per state-change or message
  injection driven by an admin via ``POST /feedback/{id}/admin-action``.
  Forensic audit, separate from the conversational ``messages`` JSONB.

Audio is NOT persisted (D-013) — voice clips are transcribed and
discarded; only the transcript lives in ``messages[].text``.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def _utc_now() -> datetime:
    return datetime.now(UTC)


# ────────────────────────────────────────────────────────────────────
# Enums
# ────────────────────────────────────────────────────────────────────


class ChatSessionMode(StrEnum):
    """Chat conversational mode. Kept as a separate axis from ticket
    status — ``status`` is the lifecycle label visible to admin/user,
    ``mode`` is the conversation phase (capture vs. refine)."""

    CAPTURE = "capture"
    REFINE = "refine"


class ChatSessionStatus(StrEnum):
    """Internal conversation phase. Drives the SSE state machine on the
    backend and the bottom-button row in the frontend.

    Distinct from :class:`FeedbackStatus` (the ticket lifecycle), which
    lives in ``feedback_ticket.ticket_status`` and is admin-controlled.
    """

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    SYNTHESIZING = "synthesizing"
    AWAITING_CONFIRM = "awaiting_confirm"
    CONFIRMED = "confirmed"
    ABANDONED = "abandoned"


class FeedbackType(StrEnum):
    """Six first-class feedback flavours. LLM-inferred during capture.

    The taxonomy is intentionally small. Each type renders the same
    timeline + synthesis UI — the type chip is just a triage hint.
    """

    BUG = "bug"
    UI = "ui"
    PERFORMANCE = "performance"
    NEW_FEATURE = "new_feature"
    EXTEND_FEATURE = "extend_feature"
    OTHER = "other"


class FeedbackStatus(StrEnum):
    """Ticket lifecycle — admin-controlled. Default ``open`` on insert.

    Renamed from the legacy ``new/triaged/done`` triplet in the
    2026-05-16 unification. The values now match the visible labels
    directly so the DB never lies about what the user sees.

    * ``open`` — new ticket, no admin attention yet
    * ``in_review`` — admin acknowledged, in queue
    * ``in_progress`` — admin actively working
    * ``waiting_for_user`` — admin requested action; UI surfaces a
      "respond" affordance to the user
    * ``resolved`` — done positively
    * ``wont_fix`` — explicit rejection
    * ``closed`` — terminal umbrella close
    """

    OPEN = "open"
    IN_REVIEW = "in_review"
    IN_PROGRESS = "in_progress"
    WAITING_FOR_USER = "waiting_for_user"
    RESOLVED = "resolved"
    WONT_FIX = "wont_fix"
    CLOSED = "closed"

    @property
    def is_terminal(self) -> bool:
        """Terminal statuses block further chat turns (S7 decision 6A=C)."""

        return self in (
            FeedbackStatus.RESOLVED,
            FeedbackStatus.WONT_FIX,
            FeedbackStatus.CLOSED,
        )


class FeedbackSeverity(StrEnum):
    """LLM-inferred severity tag. Populated by synthesis."""

    BLOCKER = "blocker"
    MAJOR = "major"
    MINOR = "minor"
    IDEA = "idea"


class FeedbackAttachmentKind(StrEnum):
    """Kind of binary attached to a ticket.

    ``screenshot`` is the auto-captured page snapshot (≤1 per ticket).
    ``user_attachment`` is anything the user dropped (≤5 per ticket).
    """

    SCREENSHOT = "screenshot"
    USER_ATTACHMENT = "user_attachment"


class DeletedByRole(StrEnum):
    """Who soft-deleted a ticket. Tracked alongside ``deleted_at``."""

    USER = "user"
    ADMIN = "admin"


class AdminActionKind(StrEnum):
    """Discriminator for :class:`FeedbackAdminAction`."""

    STATE_CHANGE = "state_change"
    MESSAGE_INJECTION = "message_injection"
    STATE_CHANGE_WITH_MESSAGE = "state_change_with_message"
    MODEL_CHANGE = "model_change"
    SOFT_DELETE = "soft_delete"
    HARD_DELETE = "hard_delete"
    RESTORE = "restore"


# ────────────────────────────────────────────────────────────────────
# Tables
# ────────────────────────────────────────────────────────────────────


class FeedbackTicket(SQLModel, table=True):
    """The unified ticket — chat session + ticket header in one row.

    Created when the user opens the chat sheet (``POST /chat/sessions``)
    and lives forever (soft-delete via ``deleted_at`` if the user
    discards). The whole conversation, synthesis, attachments, admin
    actions, token accounting, and triage state hang off this single
    aggregate.
    """

    __tablename__ = "feedback_ticket"

    # ── Identity ────────────────────────────────────────────────────
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # nullable for single-tenant hosts (sapphira).
    tenant_id: uuid.UUID | None = Field(default=None, index=True)
    user_id: uuid.UUID = Field(index=True)

    # ── Ticket header (absorbed from legacy ``feedback`` table) ─────
    ticket_code: str | None = Field(default=None, max_length=24)
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    expected_outcome: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    type: FeedbackType | None = Field(
        default=None,
        sa_column=Column(
            SAEnum(
                FeedbackType,
                name="feedback_type",
                create_constraint=False,
                values_callable=lambda enum_cls: [m.value for m in enum_cls],
            ),
            nullable=True,
        ),
    )
    severity: FeedbackSeverity | None = Field(
        default=None,
        sa_column=Column(
            SAEnum(
                FeedbackSeverity,
                name="feedback_severity",
                create_constraint=False,
                values_callable=lambda enum_cls: [m.value for m in enum_cls],
            ),
            nullable=True,
        ),
    )
    ticket_status: FeedbackStatus = Field(
        default=FeedbackStatus.OPEN,
        sa_column=Column(
            SAEnum(
                FeedbackStatus,
                name="feedback_status",
                create_constraint=False,
                values_callable=lambda enum_cls: [m.value for m in enum_cls],
            ),
            nullable=False,
            server_default=FeedbackStatus.OPEN.value,
        ),
    )

    # ── Chat conversation ──────────────────────────────────────────
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
        sa_column=Column(JSONB, nullable=False),
    )
    synthesis_json: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    auto_context: dict[str, Any] = Field(sa_column=Column(JSONB, nullable=False))
    glossary_snapshot: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    detected_language: str | None = Field(default=None, max_length=8)

    # ── Capture context (legacy form fields, kept for downstream agent) ─
    url_captured: str | None = Field(default=None, max_length=2048)
    route_name: str | None = Field(default=None, max_length=200)
    element_selector: str | None = Field(default=None, max_length=1024)
    element_xpath: str | None = Field(default=None, max_length=2048)
    element_bounding_box: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    metadata_bundle: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False),
    )
    app_version: str | None = Field(default=None, max_length=64)
    git_commit_sha: str | None = Field(default=None, max_length=40)
    user_agent: str | None = Field(default=None, max_length=512)

    # ── Admin triage state ──────────────────────────────────────────
    triaged_by: uuid.UUID | None = Field(default=None)
    triaged_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    triage_note: str | None = Field(default=None, sa_column=Column(Text, nullable=True))

    # ── Admin loop signals ──────────────────────────────────────────
    user_action_required: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
    )
    last_user_msg_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    last_admin_msg_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )

    # ── Token + context accounting (denormalized from feedback_chat_call) ─
    total_input_tokens: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, server_default="0"),
    )
    total_output_tokens: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, server_default="0"),
    )
    context_usage_pct: float = Field(
        default=0.0,
        sa_column=Column(Float, nullable=False, server_default="0.0"),
    )

    # ── Model pinning (S14 — admin can override per-ticket model) ───
    model_id_pinned: str | None = Field(default=None, max_length=200)
    model_provider: str | None = Field(default=None, max_length=50)

    # ── Compaction (S16 — summarise older turns once context ≥90%) ──
    compacted_history: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    compacted_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )

    # ── Soft delete ─────────────────────────────────────────────────
    deleted_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    deleted_by_user_id: uuid.UUID | None = Field(default=None)
    deleted_by_role: DeletedByRole | None = Field(
        default=None,
        sa_column=Column(String(length=20), nullable=True),
    )

    # ── Timestamps ──────────────────────────────────────────────────
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
    closed_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class ChatCallStatus(StrEnum):
    """Terminal status of a single ``ChatService.run_turn`` LLM stream."""

    SUCCESS = "success"
    JSON_INVALID = "json_invalid"
    TIMEOUT = "timeout"
    PROVIDER_ERROR = "provider_error"
    CANCELLED = "cancelled"


class FeedbackChatCall(SQLModel, table=True):
    """Audit row per LLM stream attempt.

    Renamed FK column from ``chat_session_id`` → ``ticket_id`` in the
    2026-05-16 unification — the FK target table is the unified
    ``feedback_ticket``.
    """

    __tablename__ = "feedback_chat_call"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ticket_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("feedback_ticket.id", ondelete="CASCADE"),
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


class FeedbackAttachment(SQLModel, table=True):
    """Binary artefact attached to a ticket.

    Renamed FK column from ``feedback_id`` → ``ticket_id`` in the
    2026-05-16 unification.
    """

    __tablename__ = "feedback_attachment"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ticket_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("feedback_ticket.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    tenant_id: uuid.UUID | None = Field(default=None, index=True)

    kind: FeedbackAttachmentKind = Field(
        sa_column=Column(
            SAEnum(
                FeedbackAttachmentKind,
                name="feedback_attachment_kind",
                create_constraint=True,
                values_callable=lambda enum_cls: [m.value for m in enum_cls],
            ),
            nullable=False,
        )
    )
    bucket: str = Field(max_length=200)
    object_key: str = Field(max_length=512)
    content_type: str = Field(max_length=100)
    byte_size: int
    filename: str | None = Field(default=None, max_length=255)
    width: int | None = Field(default=None)
    height: int | None = Field(default=None)

    created_at: datetime | None = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),
    )


# Backwards-compatible alias — historically the chat row was a
# separate ``FeedbackChatSession`` SQLModel. Now it IS the ticket;
# the alias keeps existing call sites compiling unchanged.
FeedbackChatSession = FeedbackTicket


class FeedbackAdminAction(SQLModel, table=True):
    """Forensic audit row for admin-driven actions on a ticket.

    Created whenever an admin transitions status, injects a message,
    pins a model, soft/hard deletes, or restores. Separate from the
    conversational ``messages`` JSONB so the audit trail survives the
    chat transcript and can be queried as a normalized table.
    """

    __tablename__ = "feedback_admin_action"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ticket_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("feedback_ticket.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    tenant_id: uuid.UUID | None = Field(default=None)
    admin_user_id: uuid.UUID = Field()
    kind: AdminActionKind = Field(
        sa_column=Column(String(length=40), nullable=False),
    )
    from_status: str | None = Field(default=None, max_length=30)
    to_status: str | None = Field(default=None, max_length=30)
    message_text: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    payload: dict[str, Any] | None = Field(default=None, sa_column=Column(JSONB, nullable=True))
    created_at: datetime = Field(
        default_factory=_utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
