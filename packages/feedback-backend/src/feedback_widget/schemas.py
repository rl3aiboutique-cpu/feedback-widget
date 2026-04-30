"""Pydantic DTOs for the feedback router.

Decoupled from the SQLModel ORM so the wire contract is stable across
schema migrations and the OpenAPI spec stays clean.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from feedback_widget.models import (
    FeedbackAttachmentKind,
    FeedbackCommentAuthorRole,
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
    """JSON body of POST /feedback (sent alongside the optional screenshot
    and zero-to-five user attachments).

    Multipart structure: a ``payload`` field carrying this JSON, an
    optional ``screenshot`` file part (auto-captured), and zero-to-five
    repeated ``attachments`` parts (user-uploaded). The router parses
    all three.
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
    # Presigned download URL — populated by the service when serving the
    # row to a triager. Not stored.
    presigned_url: str | None = None


class FeedbackRead(BaseModel):
    """One feedback row as returned by GET / and POST /feedback."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # Single-tenant hosts (FEEDBACK_MULTI_TENANT_MODE=false) leave the
    # tenant_id column NULL — the schema must accept that, otherwise
    # POST /feedback succeeds at the DB level but the response
    # serialization 500s on pydantic validation. Multi-tenant hosts
    # always populate it.
    tenant_id: uuid.UUID | None = None
    user_id: uuid.UUID
    type: FeedbackType
    status: FeedbackStatus
    title: str
    description: str
    expected_outcome: str | None = None
    url_captured: str
    route_name: str | None = None
    element_selector: str | None = None
    element_xpath: str | None = None
    element_bounding_box: dict[str, Any] | None = None
    metadata_bundle: dict[str, Any]
    app_version: str | None = None
    git_commit_sha: str | None = None
    user_agent: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    triaged_by: uuid.UUID | None = None
    triaged_at: datetime | None = None
    triage_note: str | None = None
    ticket_code: str = ""
    attachments: list[FeedbackAttachmentRead] = Field(default_factory=list)


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


class FeedbackCommentRead(BaseModel):
    """One comment in the conversation thread."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    feedback_id: uuid.UUID
    author_user_id: uuid.UUID
    author_role: FeedbackCommentAuthorRole
    body: str
    created_at: datetime | None = None


class FeedbackCommentCreatePayload(BaseModel):
    """Body of POST /feedback/{id}/comments."""

    body: str = Field(min_length=1, max_length=5000)


class FeedbackCommentListResponse(BaseModel):
    """List of comments on one feedback ticket, oldest first."""

    data: list[FeedbackCommentRead]
    count: int
