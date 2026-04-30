"""SQLModel tables + enums for the feedback module.

Two tables:

* ``feedback`` — one row per submission. Tenant-scoped (RLS), user-owned.
  v0.2.0 dropped the dynamic ``type_fields`` JSONB and the persona /
  linked_user_stories / parent-ticket / acceptance-token apparatus in
  favour of a uniform schema across the six feedback types.
* ``feedback_attachment`` — one row per binary artefact. Mirrors
  ``tenant_id`` so the same RLS policy applies without a join.

Both tables get RLS policies in the host's own migration (the package
itself is host-agnostic).

After v0.2.0 the schema is frozen: future destructive changes require
non-destructive migrations with backwards compatibility.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
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


class FeedbackType(StrEnum):
    """Six first-class feedback flavours.

    The taxonomy is intentionally small. Each type renders the same
    three-field form (title + description + expected_outcome) — the
    type chip is just a triage hint, not a different schema.
    """

    BUG = "bug"
    UI = "ui"
    PERFORMANCE = "performance"
    NEW_FEATURE = "new_feature"
    EXTEND_FEATURE = "extend_feature"
    OTHER = "other"


class FeedbackStatus(StrEnum):
    """Triage lifecycle. Default ``new`` on insert.

    NEW          — submitted, unread
    TRIAGED      — admin acknowledged, in queue
    IN_PROGRESS  — admin actively working on it
    DONE         — admin finished, submitter notified
    WONT_FIX     — admin closed without fixing (final)
    """

    NEW = "new"
    TRIAGED = "triaged"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    WONT_FIX = "wont_fix"


class FeedbackAttachmentKind(StrEnum):
    """Kind of binary attached to a feedback row.

    ``screenshot`` is the auto-captured page snapshot (at most one per
    feedback). ``user_attachment`` is anything the user dropped in the
    form themselves (wireframes, drawings, log files, notes — up to 5).
    """

    SCREENSHOT = "screenshot"
    USER_ATTACHMENT = "user_attachment"


# ────────────────────────────────────────────────────────────────────
# Tables
# ────────────────────────────────────────────────────────────────────


class Feedback(SQLModel, table=True):
    """One in-app feedback submission."""

    __tablename__ = "feedback"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    tenant_id: uuid.UUID = Field(index=True)
    user_id: uuid.UUID = Field(index=True)

    type: FeedbackType = Field(
        sa_column=Column(
            SAEnum(
                FeedbackType,
                name="feedback_type",
                create_constraint=True,
                values_callable=lambda enum_cls: [member.value for member in enum_cls],
            ),
            nullable=False,
        )
    )
    status: FeedbackStatus = Field(
        default=FeedbackStatus.NEW,
        sa_column=Column(
            SAEnum(
                FeedbackStatus,
                name="feedback_status",
                create_constraint=True,
                values_callable=lambda enum_cls: [member.value for member in enum_cls],
            ),
            nullable=False,
            server_default=FeedbackStatus.NEW.value,
        ),
    )

    title: str = Field(max_length=200)
    description: str  # markdown — "What's happening?"
    expected_outcome: str | None = Field(default=None)  # markdown — "How should it work?"

    # Where the user was when they submitted.
    url_captured: str = Field(max_length=2048)
    route_name: str | None = Field(default=None, max_length=200)

    # Element-mode capture details. NULL when whole-page mode.
    element_selector: str | None = Field(default=None, max_length=1024)
    element_xpath: str | None = Field(default=None, max_length=2048)
    element_bounding_box: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )

    # Redacted technical metadata captured client-side (URL, viewport, console
    # tail, network tail, breadcrumbs, etc.). Server-side redactor runs as
    # defence-in-depth.
    metadata_bundle: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False, server_default="{}"),
    )

    # Build provenance — useful when triaging a bug against a specific build.
    app_version: str | None = Field(default=None, max_length=64)
    git_commit_sha: str | None = Field(default=None, max_length=40)
    user_agent: str | None = Field(default=None, max_length=512)

    created_at: datetime | None = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )
    updated_at: datetime | None = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )

    triaged_by: uuid.UUID | None = Field(default=None)
    triaged_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )
    triage_note: str | None = Field(default=None)

    # Human-readable identifier ``FB-YYYY-NNNN`` unique per tenant. Generated
    # by the service on insert so the row is meaningful in emails and deep
    # links from day one.
    ticket_code: str = Field(max_length=24, default="")


class FeedbackAttachment(SQLModel, table=True):
    """Binary artefact attached to a feedback row.

    ``bucket`` + ``object_key`` together identify the underlying MinIO/S3
    object so multi-bucket deployments are straightforward to query.
    """

    __tablename__ = "feedback_attachment"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    feedback_id: uuid.UUID = Field(
        sa_column=Column(
            ForeignKey("feedback.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    # Mirrored from parent row so the RLS predicate applies without a join.
    tenant_id: uuid.UUID = Field(index=True)

    kind: FeedbackAttachmentKind = Field(
        sa_column=Column(
            SAEnum(
                FeedbackAttachmentKind,
                name="feedback_attachment_kind",
                create_constraint=True,
                values_callable=lambda enum_cls: [member.value for member in enum_cls],
            ),
            nullable=False,
        )
    )
    bucket: str = Field(max_length=200)
    object_key: str = Field(max_length=512)
    content_type: str = Field(max_length=100)
    byte_size: int

    # Original filename for user_attachments (sanitized before storage).
    # NULL for auto-captured screenshots which derive their filename
    # from the feedback id.
    filename: str | None = Field(default=None, max_length=255)

    # Image-only metadata; null for non-image kinds.
    width: int | None = Field(default=None)
    height: int | None = Field(default=None)

    created_at: datetime | None = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )
