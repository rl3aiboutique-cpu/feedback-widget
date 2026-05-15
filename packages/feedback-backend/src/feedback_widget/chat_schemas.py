"""Pydantic request/response DTOs for chat endpoints.

Kept separate from chat_models.py — DTOs are HTTP boundary types,
not DB types.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AutoContext(BaseModel):
    """Browser/runtime context the widget snapshots and sends to the
    backend on chat session start. Sprint B / capture_v3 expanded the
    payload to recover legacy iter-module's technical fingerprint
    (framework, network errors, element outerHTML) while keeping the
    forward shape extensible (``extra="ignore"`` on the inner config
    so unknown fields from older or newer widgets don't trip
    validation)."""

    model_config = {"extra": "ignore"}

    url: str
    route: str | None = None
    viewport: dict[str, Any] | None = None
    app_version: str | None = None
    git_commit_sha: str | None = None
    user_role: str | None = None
    framework: str | None = None
    console_tail: list[str] = Field(default_factory=list)
    network_errors_tail: list[str] = Field(default_factory=list)
    element_selector: str | None = None
    element_xpath: str | None = None
    element_bounding_box: dict[str, Any] | None = None
    element_outer_html: str | None = Field(default=None, max_length=4096)


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


# ── S5: confirm / abandon ────────────────────────────────────────────


class ChatSynthesisPersona(BaseModel):
    """One persona entry inside an enriched synthesis (Sprint C, paridad
    legacy iter Persona). Typed so the frontend SynthesisCard can render
    deterministically and admin tooling can filter / query."""

    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=120)
    goal: str = Field(default="", max_length=400)
    frustration: str = Field(default="", max_length=400)


class ChatSynthesis(BaseModel):
    """Structured synthesis output produced by the LLM on ``mode='synthesize'``.

    Sprint C tightens the schema: required base fields (title, summary,
    user_story, context, user_need, acceptance_criteria, open_questions)
    + optional typed enrichment fields (personas, user_stories,
    assumptions, diagram). ``extra="ignore"`` so the model can emit
    extra keys without breaking the parser — they are dropped silently
    and logged so we can spot prompt drift.

    Validation runs in :func:`chat_turn_parser.parse_turn_response`;
    failures trigger the repair-hint retry loop mirroring legacy iter.
    """

    model_config = ConfigDict(extra="ignore")

    # ── Required base (capture_v2 contract) ─────────────────────────────
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(default="", max_length=4000)
    user_story: str = Field(default="", max_length=1000)
    context: str = Field(default="", max_length=2000)
    user_need: str = Field(default="", max_length=2000)
    acceptance_criteria: list[str] = Field(default_factory=list, max_length=20)
    open_questions: list[str] = Field(default_factory=list, max_length=20)

    # ── Optional enrichment (capture_v3 / Sprint B paridad legacy iter) ─
    personas: list[ChatSynthesisPersona] = Field(default_factory=list, max_length=5)
    user_stories: list[str] = Field(default_factory=list, max_length=10)
    assumptions: list[str] = Field(default_factory=list, max_length=15)
    diagram: str | None = Field(default=None, max_length=8000)


class ConfirmChatSessionRequest(BaseModel):
    """Body of ``POST /chat/sessions/{sid}/confirm`` (S5).

    ``synthesis_override`` lets the caller submit an edited synthesis
    instead of the one already on ``feedback_chat_session.synthesis_json``
    (D-012 — Ajustar returns to chat, but the admin/user can also patch
    the synthesis here for direct edits). When ``None`` the persisted
    synthesis on the session row is used as-is.

    ``screenshot_b64`` carries the auto-captured page screenshot as base64
    PNG so the backend can upload it to the feedback bucket and create
    the matching :class:`FeedbackAttachment` row — paridad con el endpoint
    legacy multipart. ``None`` when capture failed client-side; the
    confirm still succeeds but without the visual evidence.
    """

    synthesis_override: dict[str, Any] | None = None
    screenshot_b64: str | None = Field(default=None, max_length=16_777_216)
    screenshot_content_type: str | None = Field(default=None, max_length=64)


class ConfirmChatSessionResponse(BaseModel):
    """Response of ``POST /chat/sessions/{sid}/confirm`` (S5)."""

    feedback_id: uuid.UUID
    ticket_code: str


class AbandonChatSessionResponse(BaseModel):
    """Response of ``POST /chat/sessions/{sid}/abandon`` (S5)."""

    ok: Literal[True] = True


# ── S4: voice transcription ──────────────────────────────────────────


class VoiceTranscriptionResponse(BaseModel):
    """Response of ``POST /chat/sessions/{sid}/voice`` (S4 — Whisper proxy).

    ``transcript`` is the raw text Whisper produced; the frontend renders
    it in an editable preview so the user can correct mistakes before
    sending. ``lang`` is the detected ISO-639-1 code (e.g. ``"es"``,
    ``"en"``) — passed back so subsequent LLM turns receive the language
    hint (D-009).

    Audio is NEVER persisted (D-013). The endpoint reads the multipart
    bytes, calls Whisper, and discards them.
    """

    transcript: str
    lang: str
