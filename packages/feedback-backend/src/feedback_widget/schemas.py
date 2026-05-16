"""Pydantic DTOs for the feedback router.

Decoupled from the SQLModel ORM so the wire contract is stable across
schema migrations and the OpenAPI spec stays clean.

Post 2026-05-16 unification: ``FeedbackRead`` is the canonical ticket
DTO. The legacy ``FeedbackComment*`` schemas were removed because
admin/user messages now live inside ``feedback_ticket.messages``
JSONB — clients render them directly from the timeline payload, no
separate fetch needed. A new :class:`FeedbackAdminActionPayload`
covers the admin-action endpoint that replaces the comments POST.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from feedback_widget.models import (
    FeedbackAttachmentKind,
    FeedbackSeverity,
    FeedbackStatus,
    FeedbackType,
)


class FeedbackElementInfo(BaseModel):
    """Captured details for the locked element in 'select element' mode."""

    selector: str | None = Field(default=None, max_length=1024)
    xpath: str | None = Field(default=None, max_length=2048)
    bounding_box: dict[str, float] | None = Field(
        default=None,
        description="x/y/w/h in CSS pixels",
    )


class FeedbackCreatePayload(BaseModel):
    """JSON body for the legacy multipart endpoint.

    NOTE: the multipart endpoint itself was removed in the 2026-05-16
    unification (target state: tickets must originate from the chat
    flow). The DTO is retained because :class:`FeedbackService.create`
    is still used internally by the chat-confirm path to materialise
    ticket header fields from a synthesised payload.
    """

    type: FeedbackType
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    expected_outcome: str | None = Field(default=None)
    url_captured: str = Field(min_length=1, max_length=2048)
    route_name: str | None = Field(default=None, max_length=200)
    element: FeedbackElementInfo | None = None
    metadata_bundle: dict[str, Any] = Field(default_factory=dict)
    app_version: str | None = Field(default=None, max_length=64)
    git_commit_sha: str | None = Field(default=None, max_length=40)
    user_agent: str | None = Field(default=None, max_length=512)


class FeedbackAttachmentRead(BaseModel):
    """One attachment row, with a presigned URL for downloadable kinds."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: FeedbackAttachmentKind
    bucket: str
    object_key: str
    content_type: str
    byte_size: int
    filename: str | None = None
    width: int | None = None
    height: int | None = None
    created_at: datetime | None = None
    # Presigned download URL — populated by the service when serving
    # the row to a caller. Not stored.
    presigned_url: str | None = None


class FeedbackRead(BaseModel):
    """One ticket row as returned by GET / and the chat endpoints.

    Carries every column needed by both the user-facing TicketDetail
    and the admin triage page so neither view requires a second fetch
    to render its primary affordances.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID | None = None
    user_id: uuid.UUID
    type: FeedbackType | None = None
    status: FeedbackStatus = Field(
        default=FeedbackStatus.OPEN, validation_alias="ticket_status"
    )
    title: str | None = None
    description: str | None = None
    expected_outcome: str | None = None
    url_captured: str | None = None
    route_name: str | None = None
    element_selector: str | None = None
    element_xpath: str | None = None
    element_bounding_box: dict[str, Any] | None = None
    metadata_bundle: dict[str, Any] = Field(default_factory=dict)
    app_version: str | None = None
    git_commit_sha: str | None = None
    user_agent: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    confirmed_at: datetime | None = None
    abandoned_at: datetime | None = None
    closed_at: datetime | None = None
    triaged_by: uuid.UUID | None = None
    triaged_at: datetime | None = None
    triage_note: str | None = None
    ticket_code: str | None = None
    severity: FeedbackSeverity | None = None
    synthesis_json: dict[str, Any] | None = None
    # Admin loop signals — frontend renders an "action required" badge
    # when ``user_action_required`` is true.
    user_action_required: bool = False
    last_user_msg_at: datetime | None = None
    last_admin_msg_at: datetime | None = None
    # Token / context accounting — denormalized totals so the UI bar
    # reads them in O(1).
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    context_usage_pct: float = 0.0
    model_id_pinned: str | None = None
    model_provider: str | None = None
    # Soft-delete fingerprints (admin-only view).
    deleted_at: datetime | None = None
    deleted_by_role: str | None = None
    # Attachments (presigned URLs populated by the service).
    attachments: list[FeedbackAttachmentRead] = Field(default_factory=list)
    # The conversation timeline — present when the caller wants the
    # full ticket workspace (TicketDetail / admin viewer). For list
    # endpoints we omit it to keep payloads light.
    messages: list[dict[str, Any]] | None = None


class FeedbackListResponse(BaseModel):
    """Paginated triage list."""

    data: list[FeedbackRead]
    count: int
    page: int
    page_size: int


class FeedbackStatusUpdate(BaseModel):
    """Body of PATCH /feedback/{id}/status."""

    status: FeedbackStatus
    triage_note: str | None = Field(default=None, max_length=2000)


class FeedbackAdminActionPayload(BaseModel):
    """Body of ``POST /feedback/{id}/admin-action`` (S3 unification).

    Combines state-change + message-injection into one call so the
    transition + the explanatory note land atomically. Either field
    may be omitted (set ``to_status=None`` for a pure message;
    ``message_text=None`` for a silent state change).
    """

    to_status: FeedbackStatus | None = None
    message_text: str | None = Field(default=None, max_length=5000)
    # Optional override of the LLM model used for subsequent turns on
    # this ticket. ``None`` keeps the current ticket-level pin (or the
    # host default when no pin is set).
    model_override: str | None = Field(default=None, max_length=200)
