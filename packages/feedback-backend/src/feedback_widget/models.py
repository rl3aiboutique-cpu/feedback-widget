"""SQLModel tables + enums for the feedback module.

Two tables:

* ``feedback`` — one row per submission. Tenant-scoped (RLS), user-owned.
  Type-specific fields live in the ``type_fields`` JSONB column so the
  taxonomy can evolve in beta without a schema migration. Linked user
  stories ride along in ``linked_user_stories`` JSONB.
* ``feedback_attachment`` — one row per binary artefact (the screenshot in
  MVP, future kinds reserved). Cascades on delete from feedback. Mirrors
  ``tenant_id`` so the same RLS policy applies without a join.

Both tables get RLS policies in the accompanying Alembic migration so a
``MASTER_ADMIN`` of tenant A cannot list tenant B's feedback. RL3-internal
cross-tenant visibility is the email distribution list, not a DB read.
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
    """Eight first-class feedback flavours.

    ``new_user_story`` and the persona-aware Bug / NewFeature / ExtendFeature
    types double as a business-mapping mechanism: every submission either
    *uses* an existing persona or *introduces* one.
    """

    BUG = "bug"
    NEW_FEATURE = "new_feature"
    EXTEND_FEATURE = "extend_feature"
    NEW_USER_STORY = "new_user_story"
    QUESTION = "question"
    UX_POLISH = "ux_polish"
    PERFORMANCE = "performance"
    DATA_ISSUE = "data_issue"


class FeedbackStatus(StrEnum):
    """Triage lifecycle. Default ``new`` on insert.

    The ticket workflow:

      NEW                 — submitted, unread
      TRIAGED             — admin acknowledged, in queue
      IN_PROGRESS         — admin actively working on it
      DONE                — admin finished + emailed submitter for confirmation
      WONT_FIX            — admin closed without fixing (final)
      ACCEPTED_BY_USER    — submitter clicked "accept" in the email
      REJECTED_BY_USER    — submitter clicked "reject" in the email
                            (typically followed by a child feedback
                             linked via parent_feedback_id)
    """

    NEW = "new"
    TRIAGED = "triaged"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    WONT_FIX = "wont_fix"
    ACCEPTED_BY_USER = "accepted_by_user"
    REJECTED_BY_USER = "rejected_by_user"


class FeedbackAttachmentKind(StrEnum):
    """Kind of binary attached to a feedback row.

    ``screenshot`` is the only kind in MVP. ``log_dump`` is reserved for
    a future v2 hook (e.g. attaching a console-log JSON blob as a file
    rather than embedding it in metadata_bundle).
    """

    SCREENSHOT = "screenshot"
    LOG_DUMP = "log_dump"


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
                # Use the enum *value* (lowercase, matches the Postgres enum
                # type the migration created), not the StrEnum member *name*
                # (uppercase). Without this, INSERT sends "BUG" and Postgres
                # rejects it with InvalidTextRepresentation.
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
    description: str  # markdown

    # Where the user was when they submitted.
    url_captured: str = Field(max_length=2048)
    route_name: str | None = Field(default=None, max_length=200)

    # Element-mode capture details. NULL when whole-page mode.
    element_selector: str | None = Field(default=None, max_length=1024)
    element_xpath: str | None = Field(default=None, max_length=2048)
    element_bounding_box: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )

    # Type-specific fields. JSONB so the taxonomy can evolve without a
    # backend migration during the beta. Frequently-queried fields (e.g.
    # severity, priority) graduate to columns once the schema settles.
    type_fields: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False, server_default="{}"),
    )

    # Persona block (markdown-friendly free text). Required only for
    # NEW_FEATURE / EXTEND_FEATURE / NEW_USER_STORY at the schema level —
    # validation is service-layer.
    persona: str | None = Field(default=None)

    # List of {story, acceptance_criteria, priority} objects.
    linked_user_stories: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_column=Column(JSONB, nullable=False, server_default="[]"),
    )

    # Redacted technical metadata captured client-side (URL, viewport, console
    # tail, network tail, breadcrumbs, etc.). The server-side redactor in
    # app/feedback/redaction.py runs as defence-in-depth.
    metadata_bundle: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False, server_default="{}"),
    )
    consent_metadata_capture: bool = Field(default=True)

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

    # ──── Ticketing workflow (added in d7c4a8e91f23) ─────────────────
    # Human-readable identifier ``FB-YYYY-NNNN`` unique per tenant.
    # Generated by the service on insert so the row is meaningful in
    # emails and deep links from day one.
    ticket_code: str = Field(max_length=24, default="")
    # Optional address the submitter wants status notifications routed
    # to. NULL means the submitter opted out. The form pre-fills it
    # with the user's account email but they can override.
    follow_up_email: str | None = Field(default=None, max_length=320)
    # Self-FK: when this feedback is filed in response to a previous
    # submission (typical: user rejected a resolution), the parent's
    # acceptance cascades here when this child is accepted.
    parent_feedback_id: uuid.UUID | None = Field(default=None)
    # Opaque single-use token for the magic-link accept/reject emails.
    # Set when the row transitions to DONE; cleared on consumption.
    acceptance_token: uuid.UUID | None = Field(default=None)
    acceptance_token_expires_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )


class FeedbackAttachment(SQLModel, table=True):
    """Binary artefact attached to a feedback row.

    Screenshot only in MVP. ``bucket`` + ``object_key`` together identify
    the underlying MinIO/S3 object so multi-bucket deployments are
    straightforward to query.
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

    # Image-only metadata; null for non-image kinds.
    width: int | None = Field(default=None)
    height: int | None = Field(default=None)

    created_at: datetime | None = Field(
        default_factory=_utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )
