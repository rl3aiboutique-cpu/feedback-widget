"""Pydantic DTOs for the feedback router.

Decoupled from the SQLModel ORM so the wire contract is stable across
schema migrations and the OpenAPI spec stays clean.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from feedback_widget.models import (
    FeedbackAttachmentKind,
    FeedbackStatus,
    FeedbackType,
)


class LinkedUserStory(BaseModel):
    """One row in the feedback's linked_user_stories list."""

    story: str = Field(min_length=1, max_length=500)
    acceptance_criteria: str | None = Field(default=None, max_length=2000)
    priority: str | None = Field(
        default=None,
        max_length=8,
        description="MoSCoW priority: must / should / could / wont",
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
    """JSON body of POST /feedback (sent alongside the screenshot file).

    Multipart structure: a single ``payload`` field carrying this JSON
    plus a ``screenshot`` file part. The router parses both.
    """

    type: FeedbackType
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    url_captured: str = Field(min_length=1, max_length=2048)
    route_name: str | None = Field(default=None, max_length=200)
    element: FeedbackElementInfo | None = None
    type_fields: dict[str, Any] = Field(default_factory=dict)
    persona: str | None = None
    linked_user_stories: list[LinkedUserStory] = Field(default_factory=list)
    metadata_bundle: dict[str, Any] = Field(default_factory=dict)
    consent_metadata_capture: bool = True
    app_version: str | None = Field(default=None, max_length=64)
    git_commit_sha: str | None = Field(default=None, max_length=40)
    user_agent: str | None = Field(default=None, max_length=512)
    # ──── Ticketing workflow ──────────────────────────────────────────
    # Submitter wants status notifications routed here. Empty/None ⇒
    # opt-out (no transition emails sent). The frontend pre-fills with
    # the current user's email but they can override. Pydantic ``EmailStr``
    # rejects malformed values at 422 — defence-in-depth against an
    # attacker submitting feedback with ``follow_up_email`` pointed at a
    # third party to harvest the magic-link token + admin triage notes
    # via the status-transition email. The router additionally enforces
    # ``follow_up_email == current_user.email`` (see
    # router._validate_follow_up_email) so an authenticated user cannot
    # redirect notifications to an arbitrary recipient.
    follow_up_email: EmailStr | None = Field(default=None, max_length=320)
    # Optional reference to a previous ticket. The form's reject flow
    # auto-fills this when the user is filing a follow-up. The service
    # resolves it to parent_feedback_id at create time and validates
    # it belongs to the same tenant.
    parent_ticket_code: str | None = Field(default=None, max_length=24)

    @field_validator("follow_up_email", mode="before")
    @classmethod
    def _coerce_empty_to_none(cls, v: object) -> object:
        """Treat blank-string opt-out as None so Pydantic doesn't try to
        EmailStr-validate ``""``. Frontend sends empty string when the
        user clears the pre-filled field.
        """
        if isinstance(v, str) and not v.strip():
            return None
        return v


class FeedbackAttachmentRead(BaseModel):
    """One attachment row, with a presigned URL for the screenshot kind."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: FeedbackAttachmentKind
    bucket: str
    object_key: str
    content_type: str
    byte_size: int
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
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    type: FeedbackType
    status: FeedbackStatus
    title: str
    description: str
    url_captured: str
    route_name: str | None = None
    element_selector: str | None = None
    element_xpath: str | None = None
    element_bounding_box: dict[str, Any] | None = None
    type_fields: dict[str, Any]
    persona: str | None = None
    linked_user_stories: list[dict[str, Any]]
    metadata_bundle: dict[str, Any]
    consent_metadata_capture: bool
    app_version: str | None = None
    git_commit_sha: str | None = None
    user_agent: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    triaged_by: uuid.UUID | None = None
    triaged_at: datetime | None = None
    triage_note: str | None = None
    # Ticketing workflow
    ticket_code: str = ""
    follow_up_email: str | None = None
    parent_feedback_id: uuid.UUID | None = None
    parent_ticket_code: str | None = None  # joined-in by the service
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
