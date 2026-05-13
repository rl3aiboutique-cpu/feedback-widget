"""Pydantic request/response DTOs for chat endpoints.

Kept separate from chat_models.py — DTOs are HTTP boundary types,
not DB types.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class AutoContext(BaseModel):
    url: str
    route: str | None = None
    viewport: dict[str, Any] | None = None
    app_version: str | None = None
    git_commit_sha: str | None = None
    user_role: str | None = None
    console_tail: list[str] = Field(default_factory=list)
    screenshot_attachment_id: uuid.UUID | None = None


class CreateChatSessionRequest(BaseModel):
    mode: Literal["capture", "refine"] = "capture"
    feedback_id: uuid.UUID | None = None  # required when mode=refine
    auto_context: AutoContext


class CreateChatSessionResponse(BaseModel):
    session_id: uuid.UUID
    greeting: str
    resume_available: bool = False


class ChatMessageRequest(BaseModel):
    """One user-authored chat turn. Streamed back as SSE events."""

    content: str = Field(min_length=1, max_length=10_000)
    via: Literal["text", "voice"] = "text"


class InProgressSessionItem(BaseModel):
    session_id: uuid.UUID
    last_message_preview: str | None
    updated_at: datetime
    mode: str


class InProgressSessionsResponse(BaseModel):
    sessions: list[InProgressSessionItem]


class ChatSessionDetailResponse(BaseModel):
    """Full chat session detail for resume — S3C.

    Returned by ``GET /chat/sessions/{sid}`` so the frontend can rebuild
    the timeline when the user clicks an in-progress entry in the
    "Conversaciones previas" header.

    Ownership is enforced server-side: 404 when the caller's
    ``(tenant_id, user_id)`` does not match the row.
    """

    session_id: uuid.UUID
    mode: Literal["capture", "refine"]
    status: str
    messages: list[dict[str, Any]]
    synthesis_json: dict[str, Any] | None
    auto_context: dict[str, Any]
    updated_at: datetime
