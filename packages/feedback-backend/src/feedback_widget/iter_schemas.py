"""Pydantic wire schemas for the Iterate-with-AI module.

Two shape families:

1. The **LLM output schema** (``IterationOutput`` and its nested types).
   This is what the model MUST return on every call — strict JSON, no
   markdown wrapper, no comments. The parser (``iter_parser.py``)
   validates against this schema and retries once with a repair hint
   on validation failure (spec §6.9).

2. The **HTTP wire DTOs** — request and response bodies for
   ``iter_router.py`` plus the discriminated union of SSE events the
   ``runs`` endpoint streams.

Frontend TypeScript mirrors live at
``packages/feedback-frontend/src/client/types.ts``; the widget package
intentionally has no OpenAPI codegen so the two halves stay readable
and reviewable side by side.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from .iter_models import (
    FeedbackIterAssumptionKind,
    FeedbackIterAssumptionStatus,
    FeedbackIterCallStatus,
    FeedbackIterSessionStatus,
)

# ────────────────────────────────────────────────────────────────────
# LLM output schema (spec §6)
# ────────────────────────────────────────────────────────────────────


class GherkinScenario(BaseModel):
    """One ``Given/When/Then`` block; multiple steps per phase allowed."""

    model_config = ConfigDict(extra="forbid")

    scenario: str
    given: list[str] = Field(default_factory=list)
    when: list[str] = Field(default_factory=list)
    then: list[str] = Field(default_factory=list)


class UserStoryNarrative(BaseModel):
    """The ``As a / I want / So that`` triplet."""

    model_config = ConfigDict(extra="forbid")

    as_a: str
    i_want: str
    so_that: str


class UserStory(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str  # stable across versions
    persona_id: str  # FK to Persona.id
    title: str
    story: UserStoryNarrative
    acceptance_criteria: list[GherkinScenario] = Field(min_length=1)


class Persona(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str  # stable across versions, e.g. "p_buyer_admin"
    name: str
    role: str
    goals: list[str] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    context: str  # short paragraph


class SpecSection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str  # stable, e.g. "sec_data_model"
    heading: str
    body_markdown: str


class SpecDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    summary: str
    sections: list[SpecSection] = Field(default_factory=list)


class Diagram(BaseModel):
    model_config = ConfigDict(extra="forbid")

    format: Literal["ascii", "mermaid"]
    source: str
    caption: str = ""


class Assumption(BaseModel):
    """Assumption surfaced by the LLM, classified and self-scored."""

    model_config = ConfigDict(extra="forbid")

    slot_key: str  # stable across versions
    kind: FeedbackIterAssumptionKind
    statement: str
    rationale: str
    confidence: float = Field(ge=0.0, le=1.0)


class DiffOpAdd(BaseModel):
    model_config = ConfigDict(extra="forbid")

    op: Literal["add"]
    path: str  # JSON Pointer (RFC 6901)
    value: Any
    note: str | None = None


class DiffOpModify(BaseModel):
    model_config = ConfigDict(extra="forbid")

    op: Literal["modify"]
    path: str
    before: Any
    after: Any
    note: str | None = None


class DiffOpRemove(BaseModel):
    """Only allowed when the iteration's ``restructure_allowed`` is true."""

    model_config = ConfigDict(extra="forbid")

    op: Literal["remove"]
    path: str
    before: Any
    note: str


class DiffOpMarkObsolete(BaseModel):
    """Soft removal; content stays, marked grey."""

    model_config = ConfigDict(extra="forbid")

    op: Literal["mark_obsolete"]
    path: str
    reason: str


DiffOperation = Annotated[
    DiffOpAdd | DiffOpModify | DiffOpRemove | DiffOpMarkObsolete,
    Field(discriminator="op"),
]


class ArchivedItem(BaseModel):
    """Content removed under ``restructure_allowed=true`` — preserved
    so the user can review what disappeared (spec §6.4)."""

    model_config = ConfigDict(extra="forbid")

    archived_in_version: int
    kind: Literal["persona", "user_story", "spec_section", "diagram"]
    id: str
    snapshot: Any
    reason: str


class IterationOutput(BaseModel):
    """Root shape the LLM MUST return on every call (spec §6.1)."""

    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1"] = "1"
    language: Literal["en"] = "en"

    personas: list[Persona] = Field(default_factory=list, max_length=3)
    user_stories: list[UserStory] = Field(default_factory=list, max_length=15)
    spec: SpecDocument
    diagram: Diagram
    assumptions: list[Assumption] = Field(default_factory=list)
    unresolved_questions: list[str] = Field(default_factory=list)

    diff: list[DiffOperation] = Field(default_factory=list)
    changes_summary: str = ""
    archived: list[ArchivedItem] = Field(default_factory=list)

    markdown_rendered: str = Field(min_length=1)


# ────────────────────────────────────────────────────────────────────
# HTTP wire DTOs — read shapes (response bodies)
# ────────────────────────────────────────────────────────────────────


class IterSessionRead(BaseModel):
    """One ``feedback_iter_session`` row, projected for the wire."""

    id: uuid.UUID
    feedback_id: uuid.UUID
    created_by_user_id: uuid.UUID
    status: FeedbackIterSessionStatus
    model_id: str
    model_provider: str
    language: str
    current_iteration_id: uuid.UUID | None
    final_package_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    finalized_at: datetime | None


class IterVersionRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    version_number: int
    parent_version_id: uuid.UUID | None
    user_message: str
    restructure_allowed: bool
    output_markdown: str
    diff_json: list[dict[str, Any]]
    changes_summary: str
    created_at: datetime


class IterAssumptionRead(BaseModel):
    id: uuid.UUID
    version_id: uuid.UUID
    slot_key: str
    kind: FeedbackIterAssumptionKind
    statement: str
    rationale: str
    confidence: Decimal
    status: FeedbackIterAssumptionStatus
    user_response: str | None
    resolved_at: datetime | None
    resolved_by_user_id: uuid.UUID | None
    created_at: datetime


class IterCallRead(BaseModel):
    """Audit-trail projection. Returned to admins; users see a slim
    version under ``IterUsageRead``."""

    id: uuid.UUID
    session_id: uuid.UUID
    version_id: uuid.UUID | None
    model_id: str
    model_provider: str
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal | None
    latency_ms: int
    status: FeedbackIterCallStatus
    attempt_number: int
    error_message: str | None
    prompt_sha256: str
    created_at: datetime


class IterPackageRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    final_version_id: uuid.UUID
    minio_zip_key: str
    minio_folder_prefix: str
    byte_size_zip: int
    created_at: datetime
    # Filled by the router; not stored on the row.
    presigned_zip_url: str | None = None


class IterUsageRead(BaseModel):
    """Per-user weekly usage — what the iter-button tooltip reads."""

    user_id: uuid.UUID
    used_this_week: int
    weekly_limit: int
    remaining_this_week: int
    window_resets_at: datetime


# ────────────────────────────────────────────────────────────────────
# HTTP wire DTOs — request bodies
# ────────────────────────────────────────────────────────────────────


class IterStartRequest(BaseModel):
    """Body of ``POST /sessions``. Idempotent on ``feedback_id`` per
    the partial unique index — a duplicate POST returns the existing
    non-terminal session for that feedback."""

    model_config = ConfigDict(extra="forbid")

    feedback_id: uuid.UUID


class IterRunRequest(BaseModel):
    """Body of ``POST /sessions/{sid}/iterations``."""

    model_config = ConfigDict(extra="forbid")

    user_message: str = ""
    restructure_allowed: bool = False


class IterAssumptionResolveRequest(BaseModel):
    """Body of ``PATCH /assumptions/{aid}``. ``user_response`` is
    required when ``status == 'corrected'`` and ignored otherwise."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["confirmed", "corrected", "irrelevant"]
    user_response: str | None = None


class IterFinalizeRequest(BaseModel):
    """Body of ``POST /sessions/{sid}/finalize``. Currently empty
    but reserved for future per-finalize knobs (e.g. consumer
    model override)."""

    model_config = ConfigDict(extra="forbid")


class IterVersionMarkdownEditRequest(BaseModel):
    """Body of ``PATCH /sessions/{sid}/versions/{vid}/markdown``.
    Lets the user hand-edit the rendered working document before
    finalizing — only the latest non-finalized version is editable.
    """

    model_config = ConfigDict(extra="forbid")

    output_markdown: str = Field(min_length=1, max_length=200_000)


# ────────────────────────────────────────────────────────────────────
# SSE event union — what the ``iterations`` endpoint streams
# ────────────────────────────────────────────────────────────────────


class SSEEventToken(BaseModel):
    """A partial chunk of ``markdown_rendered`` while the LLM streams."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["token"] = "token"
    chunk: str


class SSEEventSection(BaseModel):
    """The streaming parser detected we entered a new top-level
    section in ``markdown_rendered``. Lets the UI light up sections
    progressively."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["section"] = "section"
    section: Literal[
        "personas",
        "user_stories",
        "spec",
        "diagram",
        "assumptions",
    ]


class SSEEventDone(BaseModel):
    """Stream closed cleanly; ``version_id`` and number identify the
    persisted version row the client should fetch in detail."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["done"] = "done"
    version_id: uuid.UUID
    version_number: int


class SSEEventError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["error"] = "error"
    error_code: str
    message: str


class SSEEventHeartbeat(BaseModel):
    """Periodic ping so reverse proxies don't drop the connection."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["heartbeat"] = "heartbeat"


SSEEvent = Annotated[
    SSEEventToken
    | SSEEventSection
    | SSEEventDone
    | SSEEventError
    | SSEEventHeartbeat,
    Field(discriminator="type"),
]


# ────────────────────────────────────────────────────────────────────
# Rate-limit error body (spec §7.2)
# ────────────────────────────────────────────────────────────────────


class IterRateLimitError(BaseModel):
    """JSON body of HTTP 429 responses from iter endpoints."""

    error: Literal["rate_limited"] = "rate_limited"
    scope: Literal["session", "user_week"]
    limit: int
    current: int
    retry_after_seconds: int
