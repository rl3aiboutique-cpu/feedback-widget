"""SQLModel tables + enums for the Iterate-with-AI module.

Five tables:

* ``feedback_iter_session`` — one workspace open per ``feedback`` row.
  Partial unique index in the migration ensures at most one non-terminal
  session per feedback.
* ``feedback_iter_version`` — append-only working-document snapshots
  produced by each iteration call. ``version_number`` is 1-based.
* ``feedback_iter_call`` — one row per LLM call (success or failure)
  for audit, cost tracking, and rate-limit aggregation. Carries an
  optional ``idempotency_key`` so double-clicks on "Run iteration"
  short-circuit to a replay rather than burning tokens twice.
* ``feedback_iter_assumption`` — one row per assumption per version.
  ``slot_key`` is reused across versions for the same conceptual
  assumption so the user's resolution carries forward.
* ``feedback_iter_package`` — one row per finalized package. Immutable
  after creation; new sessions produce new packages.

Multi-tenant hosts apply RLS policies to these tables in their own
migration; the widget package itself stays host-agnostic and keeps
``tenant_id`` nullable, mirroring the existing ``feedback`` table.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

import sqlalchemy as sa
from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def _utc_now() -> datetime:
    return datetime.now(UTC)


# ────────────────────────────────────────────────────────────────────
# Enums (Postgres-native via SAEnum)
# ────────────────────────────────────────────────────────────────────


class FeedbackIterSessionStatus(StrEnum):
    """Workspace lifecycle.

    DRAFT       — session row exists, no version produced yet.
    ITERATING   — at least one version exists; user can still iterate.
    FINALIZED   — package built; immutable.
    ABANDONED   — user discarded; immutable.
    """

    DRAFT = "draft"
    ITERATING = "iterating"
    FINALIZED = "finalized"
    ABANDONED = "abandoned"


class FeedbackIterCallStatus(StrEnum):
    """Outcome of a single LLM call.

    SUCCESS         — JSON parsed, validated, version persisted.
    JSON_INVALID    — model returned malformed JSON twice in a row;
                      the user sees an error and may retry.
    TIMEOUT         — provider exceeded request timeout.
    PROVIDER_ERROR  — 5xx, network, or auth failure.
    CANCELLED       — user navigated away mid-stream.
    """

    SUCCESS = "success"
    JSON_INVALID = "json_invalid"
    TIMEOUT = "timeout"
    PROVIDER_ERROR = "provider_error"
    CANCELLED = "cancelled"


class FeedbackIterAssumptionKind(StrEnum):
    """Classification slot the LLM picks for each assumption."""

    TECHNICAL = "technical"
    BUSINESS = "business"
    UX = "ux"
    SCOPE = "scope"


class FeedbackIterAssumptionStatus(StrEnum):
    """Resolution state of an assumption.

    OPEN         — awaiting the user's decision; blocks "Run iteration".
    CONFIRMED    — user confirmed the assumption is correct as stated.
    CORRECTED    — user corrected with a free-text response stored
                   on ``user_response``; the next prompt treats the
                   correction as fact.
    IRRELEVANT   — user declared the assumption out-of-scope; the
                   next prompt ignores it (does not promote it to fact).
    """

    OPEN = "open"
    CONFIRMED = "confirmed"
    CORRECTED = "corrected"
    IRRELEVANT = "irrelevant"


# ────────────────────────────────────────────────────────────────────
# Tables
# ────────────────────────────────────────────────────────────────────


class FeedbackIterSession(SQLModel, table=True):
    """One Iterate-with-AI workspace open."""

    __tablename__ = "feedback_iter_session"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    feedback_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("feedback.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    tenant_id: uuid.UUID | None = Field(default=None, index=True)
    created_by_user_id: uuid.UUID = Field(index=True)

    status: FeedbackIterSessionStatus = Field(
        default=FeedbackIterSessionStatus.DRAFT,
        sa_column=Column(
            SAEnum(
                FeedbackIterSessionStatus,
                name="feedback_iter_session_status",
                create_constraint=True,
                values_callable=lambda enum_cls: [m.value for m in enum_cls],
            ),
            nullable=False,
            server_default=FeedbackIterSessionStatus.DRAFT.value,
        ),
    )

    # Resolved at session-create time so subsequent iterations remain
    # consistent even if the host changes its default mid-session.
    model_id: str = Field(max_length=200)
    model_provider: str = Field(max_length=50)
    language: str = Field(default="en", max_length=10)

    # Plain UUIDs (no FK) to avoid a circular dependency between
    # session ↔ version ↔ package. Code-side invariants enforce
    # referential integrity at write time.
    current_iteration_id: uuid.UUID | None = Field(default=None)
    final_package_id: uuid.UUID | None = Field(default=None)

    created_at: datetime | None = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )
    updated_at: datetime | None = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )
    finalized_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )


class FeedbackIterVersion(SQLModel, table=True):
    """Append-only working-document snapshot.

    ``output_json`` carries the full validated LLM output; ``output_markdown``
    is the rendered ``markdown_rendered`` field denormalized for cheap reads.
    """

    __tablename__ = "feedback_iter_version"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("feedback_iter_session.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    tenant_id: uuid.UUID | None = Field(default=None, index=True)
    version_number: int = Field(sa_column=Column(Integer, nullable=False))
    parent_version_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            ForeignKey("feedback_iter_version.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    user_message: str = Field(default="")
    restructure_allowed: bool = Field(default=False)

    output_json: dict[str, Any] = Field(
        sa_column=Column(JSONB, nullable=False),
    )
    output_markdown: str
    diff_json: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JSONB, nullable=False, server_default="[]"),
    )

    # Convergence signal from the model — when true, the UI swaps
    # "Run iteration" for "Mark ready" and shows ``completion_reason``.
    # Defaults to false on legacy rows that pre-date 0006.
    is_complete: bool = Field(
        default=False,
        sa_column=Column(
            "is_complete",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    completion_reason: str | None = Field(default=None)

    created_at: datetime | None = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )


class FeedbackIterCall(SQLModel, table=True):
    """One LLM call. Audit trail + rate-limit source."""

    __tablename__ = "feedback_iter_call"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("feedback_iter_session.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    tenant_id: uuid.UUID | None = Field(default=None, index=True)
    version_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            ForeignKey("feedback_iter_version.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    model_id: str = Field(max_length=200)
    model_provider: str = Field(max_length=50)

    input_tokens: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    output_tokens: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    cost_usd: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(precision=12, scale=6), nullable=True),
    )
    latency_ms: int = Field(default=0, sa_column=Column(Integer, nullable=False))

    status: FeedbackIterCallStatus = Field(
        sa_column=Column(
            SAEnum(
                FeedbackIterCallStatus,
                name="feedback_iter_call_status",
                create_constraint=True,
                values_callable=lambda enum_cls: [m.value for m in enum_cls],
            ),
            nullable=False,
        )
    )
    attempt_number: int = Field(default=1, sa_column=Column(Integer, nullable=False))
    error_message: str | None = Field(default=None)
    prompt_sha256: str = Field(max_length=64)

    # Per-session unique via partial index (see migration). Same key on
    # the same session replays the existing call's persisted events.
    idempotency_key: str | None = Field(default=None, max_length=128)

    # Audit trail of forbidden-word rewrites the iter scrubber applied
    # to this call's parsed output. Each entry: ``{"slot_key": str,
    # "original": str, "rewritten": str | None, "matched_words":
    # list[str], "action": "rewrite" | "drop"}``. Null when no scrub
    # ran (e.g. failed calls or rows pre-dating 0006).
    scrub_log: list[dict[str, Any]] | None = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )

    created_at: datetime | None = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )


class FeedbackIterAssumption(SQLModel, table=True):
    """One assumption surfaced by the LLM, with optional user resolution."""

    __tablename__ = "feedback_iter_assumption"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    version_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("feedback_iter_version.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    tenant_id: uuid.UUID | None = Field(default=None, index=True)

    slot_key: str = Field(max_length=200)
    kind: FeedbackIterAssumptionKind = Field(
        sa_column=Column(
            SAEnum(
                FeedbackIterAssumptionKind,
                name="feedback_iter_assumption_kind",
                create_constraint=True,
                values_callable=lambda enum_cls: [m.value for m in enum_cls],
            ),
            nullable=False,
        )
    )
    statement: str
    rationale: str
    confidence: Decimal = Field(
        sa_column=Column(Numeric(precision=3, scale=2), nullable=False),
    )

    status: FeedbackIterAssumptionStatus = Field(
        default=FeedbackIterAssumptionStatus.OPEN,
        sa_column=Column(
            SAEnum(
                FeedbackIterAssumptionStatus,
                name="feedback_iter_assumption_status",
                create_constraint=True,
                values_callable=lambda enum_cls: [m.value for m in enum_cls],
            ),
            nullable=False,
            server_default=FeedbackIterAssumptionStatus.OPEN.value,
        ),
    )
    user_response: str | None = Field(default=None)
    resolved_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )
    resolved_by_user_id: uuid.UUID | None = Field(default=None)

    # When the model phrased the assumption as a multiple-choice
    # question, ``options`` carries the 2-4 candidate answers so the
    # UI renders radio buttons instead of an open Confirm/Correct.
    # ``None`` when the assumption is open-ended.
    options: list[str] | None = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )

    created_at: datetime | None = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )


class FeedbackIterPackage(SQLModel, table=True):
    """Finalized package — immutable after creation."""

    __tablename__ = "feedback_iter_package"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("feedback_iter_session.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        )
    )
    tenant_id: uuid.UUID | None = Field(default=None, index=True)
    final_version_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("feedback_iter_version.id", ondelete="RESTRICT"),
            nullable=False,
        )
    )

    minio_zip_key: str = Field(max_length=1024)
    minio_folder_prefix: str = Field(max_length=1024)
    byte_size_zip: int = Field(sa_column=Column(BigInteger, nullable=False))

    created_at: datetime | None = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )
