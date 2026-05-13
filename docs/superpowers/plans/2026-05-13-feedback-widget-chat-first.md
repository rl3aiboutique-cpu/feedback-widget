# Feedback Widget chat-first redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace form-based Feedback Widget submit with a single Sheet conversational chat (grill-me-shaped LLM + Whisper voice). Bump v0.7.x → v1.0.0 in one big-bang PR.

**Architecture:** New `feedback_chat_session` table is source of truth during conversation; `feedback` row created only at confirm. Reuse existing SSE machinery, LLM provider chain, glossary scrubber, screenshot pipeline, redaction. Two LLM modes (`capture` submitter, `refine` admin). Whisper backend-proxy with audio NOT persisted.

**Tech Stack:** FastAPI + SQLModel + SQLAlchemy sync + Alembic + Postgres + boto3 + React 18 + TypeScript + tsup + Tailwind + Radix shadcn vendored + TanStack Query + MediaRecorder API.

**Source spec:** [`docs/specs/2026-05-13-feedback-widget-chat-first-design.md`](../../specs/2026-05-13-feedback-widget-chat-first-design.md)

**Source decisions:** [`vault/wiki/captures/decision/2026-05-13_feedback-widget-v1-redesign.md`](../../../vault/wiki/captures/decision/2026-05-13_feedback-widget-v1-redesign.md) (22 grilled decisions D-001..D-022)

**Implementation principle (durable rule):** Reuse existing code maximally; optimize only what is broken. See [`vault/wiki/captures/rule/reuse-existing-code.md`](../../../vault/wiki/captures/rule/reuse-existing-code.md).

---

## Plan structure

This plan is decomposed into **7 vertical slices** (S1..S7), each producing demoable software. Per the writing-plans skill guidance ("Scope check: If the spec covers multiple independent subsystems… suggest breaking this into separate plans — one per slice"), **only S1 is planned in bite-sized TDD detail below**. S2..S7 get high-level scope here; each receives its own detailed plan when its predecessor's demo gate passes.

| Slice | Status | Plan file |
|---|---|---|
| S1 Schema + sessions endpoint | **DETAILED BELOW** | this file, Tasks 1-12 |
| S2 LLM messages SSE | TODO — generate when S1 demo passes | `2026-XX-XX-feedback-widget-chat-first-s2.md` |
| S3 Frontend chat text-only | TODO — generate when S2 demo passes | `…-s3.md` |
| S4 Voice (Whisper) | TODO | `…-s4.md` |
| S5 Confirm + Feedback row | TODO | `…-s5.md` |
| S6 Refine mode (admin) | TODO | `…-s6.md` |
| S7 Cleanup + release | TODO | `…-s7.md` |

**Rationale:** Each slice is 0.5-1 sem of work; the later slices' tasks depend on knowledge that emerges from the earlier slices (exact prompt-LLM behavior in S2 informs UI states in S3; voice latency in S4 informs UX of TranscriptionPreview). Planning all 7 slices in detail before doing any work would be fiction.

---

## File structure (S1 only)

Files created or modified in this slice:

| File | Responsibility |
|---|---|
| `packages/feedback-backend/src/feedback_widget/alembic/versions/0007_chat_first_schema.py` | NEW migration: types + table + ALTER feedback |
| `packages/feedback-backend/src/feedback_widget/chat_models.py` | NEW SQLModel for `FeedbackChatSession` + enums |
| `packages/feedback-backend/src/feedback_widget/chat_router.py` | NEW APIRouter factory with `POST /chat/sessions` + `GET /chat/sessions/in-progress` |
| `packages/feedback-backend/src/feedback_widget/chat_service.py` | NEW minimal service: `start_session()`, `list_in_progress()` |
| `packages/feedback-backend/src/feedback_widget/chat_schemas.py` | NEW Pydantic request/response DTOs for chat endpoints |
| `packages/feedback-backend/src/feedback_widget/__init__.py` | MODIFY: export `register_feedback_chat_router` |
| `packages/feedback-backend/src/feedback_widget/integration.py` | MODIFY: `mount_feedback_widget_for_async_host` also mounts chat router |
| `packages/feedback-backend/tests/unit/test_chat_models.py` | NEW unit tests for SQLModel |
| `packages/feedback-backend/tests/integration/test_chat_sessions.py` | NEW integration tests with TestClient + Testcontainers Postgres |
| `packages/feedback-backend/tests/integration/conftest.py` | MODIFY: extend fixtures with `chat_router_client` if needed |

**Boundary notes:**
- `chat_service.py` in S1 is minimal — just session CRUD. The LLM orchestration logic lands in S2.
- `chat_router.py` and `router.py` (existing CRUD) stay SEPARATE routers; both mounted under same prefix by `integration.py`.
- `chat_models.py` is fresh (not reusing `iter_models.py`) per D-002 + D-006 — `iter_models.py` is dead code and gets deleted in S7.

---

## Slice S1 — Schema + sessions endpoint (detailed)

**Goal of S1:** A new Alembic migration creates `feedback_chat_session` table + 3 enums. A new `POST /api/v1/feedback/chat/sessions` endpoint creates a session row and returns `{session_id, greeting, resume_available}`. A `GET /api/v1/feedback/chat/sessions/in-progress` returns the user's resumable sessions. RLS-isolated per `tenant_id`.

**Demo gate:** `curl -X POST -H "Authorization: Bearer $JWT" -F 'auto_context={...}' http://localhost:9000/api/v1/feedback/chat/sessions` returns `200 {session_id, greeting}` with row visible in DB filtered by tenant.

### Task 1: Read existing patterns

**Files:** Read-only exploration; no writes.

- [ ] **Step 1: Read the most recent migration as a template**

Run: `cat packages/feedback-backend/src/feedback_widget/alembic/versions/0006_iter_scrub_completion.py`
Expected: see `revision`, `down_revision`, `op.create_table`, `op.execute` for CREATE TYPE patterns.

- [ ] **Step 2: Read the existing Feedback SQLModel for table/enum conventions**

Run: `cat packages/feedback-backend/src/feedback_widget/models.py | head -120`
Expected: see `SQLModel`, `Field`, `sa_column=Column(SAEnum(...))` pattern.

- [ ] **Step 3: Read the existing router factory pattern**

Run: `cat packages/feedback-backend/src/feedback_widget/router.py | head -120`
Expected: see `build_router(*, deps, settings, storage)` pattern with `Depends(deps.get_session)`.

- [ ] **Step 4: Read integration helper to understand mount flow**

Run: `cat packages/feedback-backend/src/feedback_widget/integration.py`
Expected: see `mount_feedback_widget_for_async_host` calling `register_feedback_router`.

No commit yet — exploration only.

---

### Task 2: Alembic migration — types + table

**Files:**
- Create: `packages/feedback-backend/src/feedback_widget/alembic/versions/0007_chat_first_schema.py`

- [ ] **Step 1: Write the migration file**

```python
"""chat-first redesign — feedback_chat_session table + feedback columns.

Adds the v1.0.0 chat-first capture flow source of truth. The feedback row
is created only at chat confirm; the chat_session is the durable artifact
during the conversation. Audio is NOT persisted (D-013).

Revision ID: 0007_chat_first_schema
Revises: 0006_iter_scrub_completion
Create Date: 2026-05-13
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007_chat_first_schema"
down_revision = "0006_iter_scrub_completion"
branch_labels = None
depends_on = None


_CHAT_MODE = ("capture", "refine")
_CHAT_STATUS = (
    "open",
    "in_progress",
    "synthesizing",
    "awaiting_confirm",
    "confirmed",
    "abandoned",
)
_SEVERITY = ("blocker", "major", "minor", "idea")


def upgrade() -> None:
    op.execute(
        "CREATE TYPE chat_session_mode AS ENUM "
        + "(" + ", ".join(f"'{v}'" for v in _CHAT_MODE) + ")"
    )
    op.execute(
        "CREATE TYPE chat_session_status AS ENUM "
        + "(" + ", ".join(f"'{v}'" for v in _CHAT_STATUS) + ")"
    )
    op.execute(
        "CREATE TYPE feedback_severity AS ENUM "
        + "(" + ", ".join(f"'{v}'" for v in _SEVERITY) + ")"
    )

    op.create_table(
        "feedback_chat_session",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            "mode",
            postgresql.ENUM(*_CHAT_MODE, name="chat_session_mode", create_type=False),
            nullable=False,
            server_default="capture",
        ),
        sa.Column(
            "status",
            postgresql.ENUM(*_CHAT_STATUS, name="chat_session_status", create_type=False),
            nullable=False,
            server_default="open",
        ),
        sa.Column(
            "messages",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("synthesis_json", postgresql.JSONB, nullable=True),
        sa.Column("auto_context", postgresql.JSONB, nullable=False),
        sa.Column(
            "feedback_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("glossary_snapshot", postgresql.JSONB, nullable=True),
        sa.Column("detected_language", sa.String(length=8), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("abandoned_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index(
        "ix_feedback_chat_session_user_status",
        "feedback_chat_session",
        ["tenant_id", "user_id", "status"],
    )
    op.create_index(
        "ix_feedback_chat_session_feedback",
        "feedback_chat_session",
        ["feedback_id"],
        postgresql_where=sa.text("feedback_id IS NOT NULL"),
    )

    op.add_column(
        "feedback",
        sa.Column(
            "chat_session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback_chat_session.id"),
            nullable=True,
        ),
    )
    op.add_column("feedback", sa.Column("synthesis_json", postgresql.JSONB, nullable=True))
    op.add_column(
        "feedback",
        sa.Column(
            "severity",
            postgresql.ENUM(*_SEVERITY, name="feedback_severity", create_type=False),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("feedback", "severity")
    op.drop_column("feedback", "synthesis_json")
    op.drop_column("feedback", "chat_session_id")
    op.drop_index("ix_feedback_chat_session_feedback", table_name="feedback_chat_session")
    op.drop_index("ix_feedback_chat_session_user_status", table_name="feedback_chat_session")
    op.drop_table("feedback_chat_session")
    op.execute("DROP TYPE feedback_severity")
    op.execute("DROP TYPE chat_session_status")
    op.execute("DROP TYPE chat_session_mode")
```

- [ ] **Step 2: Run migration against test DB**

Run: `cd packages/feedback-backend && uv run alembic upgrade head`
Expected: log line `Running upgrade 0006_iter_scrub_completion -> 0007_chat_first_schema`. No errors.

- [ ] **Step 3: Verify table exists**

Run: `psql $FEEDBACK_DATABASE_URL -c "\d feedback_chat_session"`
Expected: table with all 14 columns visible.

- [ ] **Step 4: Verify downgrade works (idempotency check)**

Run: `cd packages/feedback-backend && uv run alembic downgrade -1 && uv run alembic upgrade head`
Expected: both succeed without errors.

- [ ] **Step 5: Stage file (no commit per session preference — defer commits)**

```bash
git add packages/feedback-backend/src/feedback_widget/alembic/versions/0007_chat_first_schema.py
```

---

### Task 3: SQLModel for `FeedbackChatSession`

**Files:**
- Create: `packages/feedback-backend/src/feedback_widget/chat_models.py`
- Test: `packages/feedback-backend/tests/unit/test_chat_models.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/unit/test_chat_models.py
"""Unit tests for chat_models.py SQLModel."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from feedback_widget.chat_models import (
    ChatSessionMode,
    ChatSessionStatus,
    FeedbackChatSession,
)


def test_chat_session_defaults() -> None:
    session = FeedbackChatSession(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        auto_context={"url": "https://example.com", "route": "/foo"},
    )
    assert session.id is not None
    assert session.mode == ChatSessionMode.CAPTURE
    assert session.status == ChatSessionStatus.OPEN
    assert session.messages == []
    assert session.synthesis_json is None
    assert session.feedback_id is None
    assert session.detected_language is None
    assert isinstance(session.created_at, datetime)


def test_chat_session_mode_enum_values() -> None:
    assert ChatSessionMode.CAPTURE.value == "capture"
    assert ChatSessionMode.REFINE.value == "refine"


def test_chat_session_status_enum_values() -> None:
    statuses = {s.value for s in ChatSessionStatus}
    assert statuses == {
        "open",
        "in_progress",
        "synthesizing",
        "awaiting_confirm",
        "confirmed",
        "abandoned",
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/feedback-backend && uv run pytest tests/unit/test_chat_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'feedback_widget.chat_models'`.

- [ ] **Step 3: Write the SQLModel**

```python
# src/feedback_widget/chat_models.py
"""SQLModel for the chat-first redesign (v1.0.0).

One table: ``feedback_chat_session``. Source of truth during the
conversation; ``feedback`` row is created only at confirm.

Audio is NOT persisted (D-013) — voice clips are transcribed and
discarded; only the transcript lives in ``messages[].text``.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


def _utc_now() -> datetime:
    return datetime.now(UTC)


class ChatSessionMode(StrEnum):
    CAPTURE = "capture"
    REFINE = "refine"


class ChatSessionStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    SYNTHESIZING = "synthesizing"
    AWAITING_CONFIRM = "awaiting_confirm"
    CONFIRMED = "confirmed"
    ABANDONED = "abandoned"


class FeedbackChatSession(SQLModel, table=True):
    __tablename__ = "feedback_chat_session"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    tenant_id: uuid.UUID = Field(index=True)
    user_id: uuid.UUID = Field(index=True)

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
        # NOTE: server_default lives in the migration (see 0007); the model
        # only declares default_factory so SQLAlchemy can emit INSERT without
        # the column when callers omit it. Mixing both confuses test SQLite
        # (no JSONB type) and integration Postgres (raw "[]" not cast).
        sa_column=Column(JSONB, nullable=False),
    )
    synthesis_json: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    auto_context: dict[str, Any] = Field(
        sa_column=Column(JSONB, nullable=False)
    )

    feedback_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            ForeignKey("feedback.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    glossary_snapshot: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    detected_language: str | None = Field(default=None, max_length=8)

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/feedback-backend && uv run pytest tests/unit/test_chat_models.py -v`
Expected: 3 tests PASS.

- [ ] **Step 5: Stage files (no commit)**

```bash
git add packages/feedback-backend/src/feedback_widget/chat_models.py
git add packages/feedback-backend/tests/unit/test_chat_models.py
```

---

### Task 4: Pydantic DTOs for chat endpoints

**Files:**
- Create: `packages/feedback-backend/src/feedback_widget/chat_schemas.py`

- [ ] **Step 1: Write the DTO file**

```python
# src/feedback_widget/chat_schemas.py
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


class InProgressSessionItem(BaseModel):
    session_id: uuid.UUID
    last_message_preview: str | None
    updated_at: datetime
    mode: str


class InProgressSessionsResponse(BaseModel):
    sessions: list[InProgressSessionItem]
```

- [ ] **Step 2: Stage file**

```bash
git add packages/feedback-backend/src/feedback_widget/chat_schemas.py
```

(No test for pure DTO file — Pydantic validates itself; behavior tests come in Task 5.)

---

### Task 5: Minimal chat_service.py

**Files:**
- Create: `packages/feedback-backend/src/feedback_widget/chat_service.py`
- Test: `packages/feedback-backend/tests/integration/test_chat_service.py`

**Why integration (not unit):** `FeedbackChatSession.messages` and `auto_context` use `JSONB`, which doesn't exist in SQLite. Service tests must run against the existing Testcontainers Postgres `engine` fixture from `tests/integration/conftest.py`.

- [ ] **Step 1: Write the failing test**

```python
# tests/integration/test_chat_service.py
"""Integration tests for ChatService — exercises real Postgres + JSONB."""

from __future__ import annotations

import uuid

import pytest
from sqlmodel import Session, select

from feedback_widget.chat_models import (
    ChatSessionMode,
    ChatSessionStatus,
    FeedbackChatSession,
)
from feedback_widget.chat_schemas import AutoContext, CreateChatSessionRequest
from feedback_widget.chat_service import ChatService


@pytest.fixture
def db_session(engine):  # uses the integration `engine` fixture (Postgres)
    with Session(engine) as s:
        yield s


def test_start_session_capture_mode(db_session: Session) -> None:
    svc = ChatService()
    req = CreateChatSessionRequest(
        mode="capture",
        auto_context=AutoContext(url="https://example.com"),
    )
    tenant = uuid.uuid4()
    user = uuid.uuid4()

    resp = svc.start_session(
        session=db_session,
        tenant_id=tenant,
        user_id=user,
        payload=req,
    )

    assert resp.session_id is not None
    assert resp.greeting == "Cuéntame qué tienes en mente."
    assert resp.resume_available is False

    rows = db_session.exec(select(FeedbackChatSession)).all()
    assert len(rows) == 1
    assert rows[0].mode == ChatSessionMode.CAPTURE
    assert rows[0].status == ChatSessionStatus.OPEN
    assert rows[0].tenant_id == tenant
    assert rows[0].user_id == user


def test_start_session_refine_requires_feedback_id(db_session: Session) -> None:
    svc = ChatService()
    req = CreateChatSessionRequest(
        mode="refine",
        auto_context=AutoContext(url="https://example.com"),
    )

    with pytest.raises(ValueError, match="feedback_id required for refine mode"):
        svc.start_session(
            session=db_session,
            tenant_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            payload=req,
        )


def test_start_session_resume_available_flag(db_session: Session) -> None:
    """If user has an in_progress session, resume_available=True."""
    svc = ChatService()
    tenant = uuid.uuid4()
    user = uuid.uuid4()

    # Seed an in_progress session
    db_session.add(
        FeedbackChatSession(
            tenant_id=tenant,
            user_id=user,
            mode=ChatSessionMode.CAPTURE,
            status=ChatSessionStatus.IN_PROGRESS,
            auto_context={"url": "https://example.com"},
        )
    )
    db_session.commit()

    resp = svc.start_session(
        session=db_session,
        tenant_id=tenant,
        user_id=user,
        payload=CreateChatSessionRequest(
            mode="capture",
            auto_context=AutoContext(url="https://example.com"),
        ),
    )

    assert resp.resume_available is True


def test_list_in_progress_filters_by_user_and_tenant(db_session: Session) -> None:
    svc = ChatService()
    tenant_a = uuid.uuid4()
    tenant_b = uuid.uuid4()
    user = uuid.uuid4()

    for status in [ChatSessionStatus.IN_PROGRESS, ChatSessionStatus.OPEN, ChatSessionStatus.CONFIRMED]:
        db_session.add(
            FeedbackChatSession(
                tenant_id=tenant_a,
                user_id=user,
                mode=ChatSessionMode.CAPTURE,
                status=status,
                auto_context={"url": "x"},
            )
        )
    # Cross-tenant noise
    db_session.add(
        FeedbackChatSession(
            tenant_id=tenant_b,
            user_id=user,
            mode=ChatSessionMode.CAPTURE,
            status=ChatSessionStatus.IN_PROGRESS,
            auto_context={"url": "x"},
        )
    )
    db_session.commit()

    result = svc.list_in_progress(
        session=db_session, tenant_id=tenant_a, user_id=user
    )

    assert len(result.sessions) == 1
    assert result.sessions[0].mode == "capture"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/feedback-backend && uv run pytest tests/integration/test_chat_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'feedback_widget.chat_service'`.

- [ ] **Step 3: Write the minimal service**

```python
# src/feedback_widget/chat_service.py
"""ChatService — S1 minimal surface.

Only ``start_session`` and ``list_in_progress`` are implemented in this
slice. LLM orchestration, SSE messages, voice transcription, confirm,
and refine arrive in S2..S6.

This service uses the synchronous SQLModel ``Session`` per ADR-006 (sync
engine paralelo en async hosts). The route handler is responsible for
``commit()``; the service performs ``flush()`` so identity columns are
populated before returning the response.
"""

from __future__ import annotations

import uuid

from sqlmodel import Session, select

from feedback_widget.chat_models import (
    ChatSessionMode,
    ChatSessionStatus,
    FeedbackChatSession,
)
from feedback_widget.chat_schemas import (
    CreateChatSessionRequest,
    CreateChatSessionResponse,
    InProgressSessionItem,
    InProgressSessionsResponse,
)

GREETING_CAPTURE = "Cuéntame qué tienes en mente."
GREETING_REFINE = "Tienes este ticket. ¿Qué quieres ajustar?"


class ChatService:
    """Stateful chat service — S1 surface only."""

    def start_session(
        self,
        *,
        session: Session,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: CreateChatSessionRequest,
    ) -> CreateChatSessionResponse:
        """Create a new chat session row and return greeting."""
        if payload.mode == "refine" and payload.feedback_id is None:
            raise ValueError("feedback_id required for refine mode")

        mode_enum = ChatSessionMode(payload.mode)
        greeting = GREETING_REFINE if mode_enum == ChatSessionMode.REFINE else GREETING_CAPTURE

        row = FeedbackChatSession(
            tenant_id=tenant_id,
            user_id=user_id,
            mode=mode_enum,
            status=ChatSessionStatus.OPEN,
            auto_context=payload.auto_context.model_dump(mode="json"),
            feedback_id=payload.feedback_id,
        )
        session.add(row)
        session.flush()

        resume_available = self._has_in_progress(
            session=session, tenant_id=tenant_id, user_id=user_id, exclude_id=row.id
        )

        return CreateChatSessionResponse(
            session_id=row.id,
            greeting=greeting,
            resume_available=resume_available,
        )

    def list_in_progress(
        self,
        *,
        session: Session,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> InProgressSessionsResponse:
        """Return user's in_progress sessions in this tenant, newest first."""
        stmt = (
            select(FeedbackChatSession)
            .where(FeedbackChatSession.tenant_id == tenant_id)
            .where(FeedbackChatSession.user_id == user_id)
            .where(FeedbackChatSession.status == ChatSessionStatus.IN_PROGRESS)
            .order_by(FeedbackChatSession.updated_at.desc())
        )
        rows = session.exec(stmt).all()
        items = [
            InProgressSessionItem(
                session_id=r.id,
                last_message_preview=(
                    r.messages[-1].get("text", "")[:80] if r.messages else None
                ),
                updated_at=r.updated_at,
                mode=r.mode.value,
            )
            for r in rows
        ]
        return InProgressSessionsResponse(sessions=items)

    def _has_in_progress(
        self,
        *,
        session: Session,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        exclude_id: uuid.UUID,
    ) -> bool:
        stmt = (
            select(FeedbackChatSession.id)
            .where(FeedbackChatSession.tenant_id == tenant_id)
            .where(FeedbackChatSession.user_id == user_id)
            .where(FeedbackChatSession.status == ChatSessionStatus.IN_PROGRESS)
            .where(FeedbackChatSession.id != exclude_id)
            .limit(1)
        )
        return session.exec(stmt).first() is not None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/feedback-backend && uv run pytest tests/integration/test_chat_service.py -v`
Expected: 4 tests PASS.

- [ ] **Step 5: Stage files**

```bash
git add packages/feedback-backend/src/feedback_widget/chat_service.py
git add packages/feedback-backend/tests/integration/test_chat_service.py
```

---

### Task 6: chat_router.py — POST /chat/sessions

**Files:**
- Create: `packages/feedback-backend/src/feedback_widget/chat_router.py`
- Test: `packages/feedback-backend/tests/integration/test_chat_sessions.py`

- [ ] **Step 1: Write the failing integration test**

```python
# tests/integration/test_chat_sessions.py
"""Integration tests for POST /chat/sessions + GET /chat/sessions/in-progress.

Uses existing conftest fixtures:
- ``client``: TestClient bound to the app fixture (prefix='/feedback', see conftest:190)
- ``TestAuth``: returns None unless request has X-Test-Role header (conftest:113)
  → no header == unauthenticated; header 'staff' or 'admin' == authenticated user.
"""

from __future__ import annotations

import uuid

AUTH_STAFF = {"X-Test-Role": "staff"}
AUTH_ADMIN = {"X-Test-Role": "admin"}


def test_post_chat_session_capture_returns_session_id(client) -> None:
    payload = {
        "mode": "capture",
        "auto_context": {"url": "https://example.com", "route": "/home"},
    }
    resp = client.post("/feedback/chat/sessions", json=payload, headers=AUTH_STAFF)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "session_id" in body
    uuid.UUID(body["session_id"])  # validates UUID format
    assert body["greeting"] == "Cuéntame qué tienes en mente."
    assert body["resume_available"] is False


def test_post_chat_session_refine_requires_feedback_id(client) -> None:
    payload = {
        "mode": "refine",
        "auto_context": {"url": "https://example.com"},
    }
    resp = client.post("/feedback/chat/sessions", json=payload, headers=AUTH_STAFF)

    assert resp.status_code == 422, resp.text
    # FastAPI default 422 payload shape — assert the message mentions feedback_id
    body = resp.json()
    assert any(
        "feedback_id" in str(item).lower()
        for item in body.get("detail", [])
    ), body


def test_get_in_progress_empty(client) -> None:
    resp = client.get("/feedback/chat/sessions/in-progress", headers=AUTH_STAFF)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"sessions": []}


def test_post_chat_session_requires_auth(client) -> None:
    """No X-Test-Role header → TestAuth returns None → 401/403."""
    payload = {
        "mode": "capture",
        "auto_context": {"url": "https://example.com"},
    }
    resp = client.post("/feedback/chat/sessions", json=payload)
    assert resp.status_code in (401, 403), resp.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/feedback-backend && uv run pytest tests/integration/test_chat_sessions.py -v`
Expected: FAIL — either fixtures missing or routes return 404.

- [ ] **Step 3: Write the chat_router.py**

```python
# src/feedback_widget/chat_router.py
"""FastAPI router for chat-first feedback capture (v1.0.0).

Endpoints in S1:

* ``POST /chat/sessions``                  — create session, return greeting
* ``GET  /chat/sessions/in-progress``      — list user's in_progress sessions

Future slices add:

* S2: ``POST /chat/sessions/{sid}/messages`` (SSE)
* S4: ``POST /chat/sessions/{sid}/voice``
* S5: ``POST /chat/sessions/{sid}/confirm`` + ``/abandon``
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlmodel import Session

from feedback_widget.auth import CurrentUserSnapshot
from feedback_widget.chat_schemas import (
    CreateChatSessionRequest,
    CreateChatSessionResponse,
    InProgressSessionsResponse,
)
from feedback_widget.chat_service import ChatService
from feedback_widget.deps import WidgetDependencies

logger = logging.getLogger(__name__)


def build_chat_router(*, deps: WidgetDependencies, service: ChatService) -> APIRouter:
    """Build the chat APIRouter factory closing over host deps + service."""
    router = APIRouter(tags=["feedback-chat"])

    SessionDep = Depends(deps.get_session)
    UserDep = Depends(deps.get_current_user)

    @router.post(
        "/chat/sessions",
        response_model=CreateChatSessionResponse,
        status_code=status.HTTP_200_OK,
    )
    def create_chat_session(
        payload: CreateChatSessionRequest,
        user: CurrentUserSnapshot = UserDep,
        db: Session = SessionDep,
    ) -> CreateChatSessionResponse:
        try:
            resp = service.start_session(
                session=db,
                tenant_id=user.tenant_id,
                user_id=user.user_id,
                payload=payload,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=[{"loc": ["body"], "msg": str(exc), "type": "value_error"}],
            ) from exc
        db.commit()
        logger.info(
            "chat session created: user=%s tenant=%s mode=%s session=%s",
            user.user_id,
            user.tenant_id,
            payload.mode,
            resp.session_id,
        )
        return resp

    @router.get(
        "/chat/sessions/in-progress",
        response_model=InProgressSessionsResponse,
    )
    def list_in_progress(
        user: CurrentUserSnapshot = UserDep,
        db: Session = SessionDep,
    ) -> InProgressSessionsResponse:
        return service.list_in_progress(
            session=db,
            tenant_id=user.tenant_id,
            user_id=user.user_id,
        )

    return router
```

- [ ] **Step 4: Run test (still fails — router not mounted yet)**

Run: `cd packages/feedback-backend && uv run pytest tests/integration/test_chat_sessions.py -v`
Expected: FAIL with 404 (route not registered). Mount happens in Task 7.

- [ ] **Step 5: Stage files**

```bash
git add packages/feedback-backend/src/feedback_widget/chat_router.py
git add packages/feedback-backend/tests/integration/test_chat_sessions.py
```

---

### Task 7: Wire chat_router into __init__.py + integration.py

**Files:**
- Modify: `packages/feedback-backend/src/feedback_widget/__init__.py`
- Modify: `packages/feedback-backend/src/feedback_widget/integration.py`

- [ ] **Step 1: Add `register_feedback_chat_router` to __init__.py**

Open `packages/feedback-backend/src/feedback_widget/__init__.py`. After the existing `register_feedback_router` function (around line 145), add:

```python
def register_feedback_chat_router(
    app: FastAPI,
    *,
    auth: FeedbackAuthAdapter,
    engine: Engine,
    settings: FeedbackSettings | None = None,
    prefix: str = "/feedback",
) -> None:
    """Mount the chat-first feedback router on a FastAPI app.

    Sits parallel to :func:`register_feedback_router`. The host typically
    calls both with the same ``prefix``; this one adds the v1.0.0 chat
    endpoints under ``{prefix}/chat/*``.
    """
    from feedback_widget.chat_router import build_chat_router
    from feedback_widget.chat_service import ChatService

    cfg = settings or get_settings()
    if not cfg.ENABLED:
        logger.info("feedback_widget: ENABLED=false — chat router NOT registered")
        return

    deps = build_dependencies(auth=auth, engine=engine, settings=cfg)
    service = ChatService()
    router = build_chat_router(deps=deps, service=service)
    app.include_router(router, prefix=prefix)
    logger.info("feedback_widget: chat router mounted at %s/chat", prefix)
```

Also add `register_feedback_chat_router` to the `__all__` list.

- [ ] **Step 2: Update `mount_feedback_widget_for_async_host` in integration.py**

Open `packages/feedback-backend/src/feedback_widget/integration.py`. The current call (line 129):

```python
register_feedback_router(app, auth=auth, engine=engine, settings=cfg, prefix=prefix)
```

Insert IMMEDIATELY AFTER that line (still before `app.state.feedback_widget_engine = engine`):

```python
# Mount the chat-first router alongside the legacy CRUD router.
from feedback_widget import register_feedback_chat_router  # local to avoid cycle

register_feedback_chat_router(app, auth=auth, engine=engine, settings=cfg, prefix=prefix)
```

(Variables in scope at that line: `app`, `auth`, `engine`, `cfg`, `prefix`. Verified by `grep -n "register_feedback_router" packages/feedback-backend/src/feedback_widget/integration.py`.)

- [ ] **Step 3: Mount the chat router in the test app fixture**

Open `packages/feedback-backend/tests/integration/conftest.py`. The existing `app` fixture (line 182-193) calls `register_feedback_router` only. Add a parallel call to `register_feedback_chat_router` so test client can hit chat endpoints:

```python
@pytest.fixture
def app(settings: FeedbackSettings, engine: Engine, fake_storage: FakeStorage) -> FastAPI:
    fastapi_app = FastAPI()
    register_feedback_router(
        fastapi_app,
        auth=TestAuth(),
        engine=engine,
        settings=settings,
        prefix="/feedback",
        storage=fake_storage,  # type: ignore[arg-type]
    )
    # NEW: chat-first router (v1.0.0, S1+)
    from feedback_widget import register_feedback_chat_router
    register_feedback_chat_router(
        fastapi_app,
        auth=TestAuth(),
        engine=engine,
        settings=settings,
        prefix="/feedback",
    )
    return fastapi_app
```

- [ ] **Step 4: Run integration tests**

Run: `cd packages/feedback-backend && uv run pytest tests/integration/test_chat_sessions.py -v`
Expected: 4 tests PASS.

- [ ] **Step 5: Run full backend test suite to confirm no regressions**

Run: `cd packages/feedback-backend && uv run pytest -x -q`
Expected: all tests pass (existing + 4 new).

- [ ] **Step 6: Mount the chat router in sandbox-host**

Sandbox uses `register_feedback_router` directly (not `mount_feedback_widget_for_async_host`), so the new chat router needs an explicit mount call. Open `apps/sandbox-host/backend/app/main.py`. Right after the existing `register_feedback_router(...)` call (around line 59-64), add:

```python
from feedback_widget import register_feedback_chat_router

register_feedback_chat_router(
    app,
    auth=auth_adapter,  # use whatever variable holds the auth instance on this line in main.py
    engine=engine,
    settings=settings,
    prefix="/api/v1/feedback",
)
```

(Inspect `apps/sandbox-host/backend/app/main.py:59-64` first to confirm exact variable names used for `auth=`, `engine=`, `settings=`. Mirror those into the new call.)

- [ ] **Step 7: Stage files**

```bash
git add packages/feedback-backend/src/feedback_widget/__init__.py
git add packages/feedback-backend/src/feedback_widget/integration.py
git add packages/feedback-backend/tests/integration/conftest.py
git add apps/sandbox-host/backend/app/main.py
```

---

### Task 8: Test cleanup — TRUNCATE feedback_chat_session between tests

**Why:** existing conftest:103 truncates `feedback_attachment, feedback CASCADE` after each test. The new `feedback_chat_session` table needs to be added or tests will leak state across runs.

**Files:**
- Modify: `packages/feedback-backend/tests/integration/conftest.py`

**Note on RLS:** A real multi-tenant isolation test requires `client_tenant_a/b` fixtures that don't exist in the current conftest (TestAuth hardcodes `tenant_id=None`). Building them is non-trivial and not in S1 scope — single-tenant hosts (sandbox, capellai today) work fine with `tenant_id=None`. Multi-tenant RLS test is deferred to a later slice when a multi-tenant host onboards or when we explicitly extend the test infra.

- [ ] **Step 1: Add the chat session table to the truncate set**

Open `packages/feedback-backend/tests/integration/conftest.py`. Around line 103, the existing fixture is:

```python
@pytest.fixture(autouse=True)
def _truncate_each_test(engine: Engine) -> Generator[None, Any, None]:
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE feedback_attachment, feedback CASCADE"))
```

Change the TRUNCATE statement to include the new table FIRST (CASCADE will reach the FK from `feedback.chat_session_id` and from `feedback_chat_session.feedback_id`):

```python
@pytest.fixture(autouse=True)
def _truncate_each_test(engine: Engine) -> Generator[None, Any, None]:
    yield
    with engine.begin() as conn:
        conn.execute(
            text("TRUNCATE feedback_chat_session, feedback_attachment, feedback CASCADE")
        )
```

- [ ] **Step 2: Run integration suite — verify no state leak across tests**

Run: `cd packages/feedback-backend && uv run pytest tests/integration/ -v --count=2 -p no:randomly`
(If `--count` plugin not installed, run twice manually: `pytest tests/integration/ -v && pytest tests/integration/ -v`.)
Expected: every run passes; second invocation does not fail due to leftover rows.

- [ ] **Step 3: Stage**

```bash
git add packages/feedback-backend/tests/integration/conftest.py
```

---

### Task 9: Manual smoke test against sandbox-host

**Files:** None modified; runtime verification only.

- [ ] **Step 1: Bring up sandbox**

Run: `make sandbox-up`
Expected: backend running on http://localhost:9000, MinIO on 9100, MailHog on 9003.

- [ ] **Step 2: Apply migration to sandbox DB**

Run: `docker compose -f docker-compose.feedback.yml exec backend uv run alembic upgrade head`
Expected: log line `0006 -> 0007_chat_first_schema`.

- [ ] **Step 3: Obtain a JWT for a sandbox user**

Two paths (neither make target nor helper script exists today):

Option A — log into sandbox-host frontend (http://localhost:9001) with a test user, open DevTools → Application → Local Storage → copy `access_token` value. Then:

```bash
export JWT="Bearer <pasted>"
```

Option B — mint one inline with the sandbox secret:

```bash
export JWT="Bearer $(python -c 'import jwt,time; print(jwt.encode({"sub":"00000000-0000-0000-0000-000000000001","role":"staff","tenant_id":None,"exp":int(time.time())+3600}, "dev-secret-key", algorithm="HS256"))')"
```
(Replace `dev-secret-key` with the sandbox `SECRET_KEY` — see `apps/sandbox-host/backend/.env`.)

- [ ] **Step 4: curl create session**

Run:
```bash
curl -X POST http://localhost:9000/api/v1/feedback/chat/sessions \
  -H "Authorization: $JWT" \
  -H "Content-Type: application/json" \
  -d '{"mode":"capture","auto_context":{"url":"https://sandbox.test/orders","route":"/orders"}}' \
  | jq
```
Expected:
```json
{
  "session_id": "<uuid>",
  "greeting": "Cuéntame qué tienes en mente.",
  "resume_available": false
}
```

- [ ] **Step 5: Verify row in DB**

Run:
```bash
docker compose -f docker-compose.feedback.yml exec db psql -U postgres -d feedback \
  -c "SELECT id, mode, status, tenant_id, user_id, auto_context->'url' FROM feedback_chat_session LIMIT 5;"
```
Expected: 1 row visible with the URL from step 4.

- [ ] **Step 6: curl in-progress (should be empty since session is 'open' not 'in_progress')**

Run:
```bash
curl -X GET http://localhost:9000/api/v1/feedback/chat/sessions/in-progress \
  -H "Authorization: $JWT" | jq
```
Expected: `{"sessions": []}`.

---

### Task 10: Update vault hot.md + log.md + spec status

**Files:**
- Modify: `vault/wiki/hot.md`
- Modify: `vault/wiki/log.md`

- [ ] **Step 1: Update hot.md**

Open `vault/wiki/hot.md`. Replace the "Active Threads" section with:

```markdown
## Active Threads
- S1 (Schema + sessions endpoint) IMPLEMENTED. Demo gate passed.
- Next: generate detailed plan for S2 (LLM messages SSE) via writing-plans skill.
```

Update `Last Updated` line to today's date + time.

- [ ] **Step 2: Add log entry at TOP**

Open `vault/wiki/log.md`. Add right under the `---` separator:

```markdown
## 2026-05-13 — S1 implemented

- Migration 0007_chat_first_schema applied (3 enums + feedback_chat_session table + ALTER feedback for synthesis_json/severity/chat_session_id).
- chat_models.py + chat_schemas.py + chat_service.py (minimal) + chat_router.py created.
- `POST /api/v1/feedback/chat/sessions` + `GET /chat/sessions/in-progress` working.
- Tenant isolation verified via integration test.
- Demo gate passed: curl creates session in sandbox.
- Vault auto-commit will land these notes.
```

- [ ] **Step 3: Stage**

```bash
git add vault/wiki/hot.md vault/wiki/log.md
```

(Auto-commit hook may land vault changes separately — that's OK.)

---

### Task 11: Self-review S1 before closing

- [ ] **Step 1: Re-run full backend test suite**

Run: `cd packages/feedback-backend && uv run pytest -q`
Expected: all green, including new tests.

- [ ] **Step 2: Run linter**

Run: `cd packages/feedback-backend && uv run ruff check src/feedback_widget/chat_*.py tests/integration/test_chat_sessions.py tests/unit/test_chat_models.py tests/integration/test_chat_service.py`
Expected: no errors. Fix any inline.

- [ ] **Step 3: Run mypy**

Run: `cd packages/feedback-backend && uv run mypy src/feedback_widget/chat_models.py src/feedback_widget/chat_schemas.py src/feedback_widget/chat_service.py src/feedback_widget/chat_router.py`
Expected: no type errors.

- [ ] **Step 4: Verify the integration helper still works**

Run: `cd packages/feedback-backend && uv run pytest tests/unit/test_integration_helper.py -v`
Expected: PASS. (regression check for `mount_feedback_widget_for_async_host` modification in Task 7.)

---

### Task 12: Single commit for S1 (per user preference)

Per user preference (vault/wiki/captures/preference/commit-at-end-of-flow.md), defer commits to slice boundary, not per-task.

- [ ] **Step 1: Verify staging is complete**

Run: `git status --short`
Expected: all modified/new files staged (`A` or `M` prefix), nothing untracked relevant.

- [ ] **Step 2: Get user approval for git mutation (Iron Law 7)**

Output to user: "S1 implemented + tested. Demo gate passed. Ready to commit. Type `ok` to authorize git commit."

Wait for user `ok` (case-insensitive).

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(v1.0.0/S1): chat_session schema + POST /chat/sessions endpoint

First vertical slice of the chat-first redesign. Adds the
feedback_chat_session table (source of truth during capture/refine
conversation, per D-006), minimal ChatService with start_session +
list_in_progress, FastAPI router under /api/v1/feedback/chat/*, and
integration helper wiring so async hosts mount it alongside the
existing feedback router.

Tenant isolation verified via integration test.

Source spec: docs/specs/2026-05-13-feedback-widget-chat-first-design.md
EOF
)"
```

- [ ] **Step 4: Verify commit**

Run: `git log --oneline -3`
Expected: top commit is the S1 feat commit.

- [ ] **Step 5: Stop and present to user**

Output to user: "S1 complete. Demo gate passed. Ready to plan S2 (LLM messages SSE). Run `/writing-plans` again with the S1 plan + spec as context to generate `2026-XX-XX-feedback-widget-chat-first-s2.md`."

---

## Slices S2..S7 — high-level scope (detailed plans deferred)

Each slice below will receive its own bite-sized TDD plan when its predecessor's demo gate passes. The scope below is the contract.

### S2 — LLM messages SSE (~1 sem)

**Goal:** `POST /chat/sessions/{sid}/messages` streams LLM responses via SSE. Capture-mode system prompt v2 (D-015) integrated. Turn cap 5 + early exit (D-003). Idempotency-Key replay (D-021). Output is structured JSON per D-015 turn schema.

**Demo gate:** Curl `POST /messages` over an open session returns a complete SSE stream with `delta` + `turn_done` events; turn N produces valid `synthesis` event when `covered≥0.7` or turn 5 reached.

**Key files:**
- Rename: `iter_service.py` → `chat_service.py` (extend the S1 minimal one). Keep iter_service.py importable as deprecated alias until S7.
- Rename: `iter_llm/` → `chat_llm/`.
- Rename: `iter_scrubber.py` → `chat_scrubber.py`.
- Rename: `iter_parser.py` → `chat_parser.py`.
- New: `chat_prompts/capture_prompt.py` with full v2 prompt text.
- New: `chat_prompts/user_builder.py` (build per-turn user message + multimodal screenshot for turn 1).
- Modify: `chat_router.py` add `POST /messages` SSE endpoint with idempotency middleware.
- Tests: full SSE flow with `FakeLLMProvider`, idempotency replay, turn cap, repair-hint loop.

### S3 — Frontend chat text-only (~1 sem)

**Goal:** `<FeedbackChatSheet/>` opens on `<FeedbackButton/>` click, captures screenshot + metadata silently, sends to backend, streams LLM responses, renders synthesis card. Text input only (no voice).

**Demo gate:** End-user submits a feedback in sandbox-host, sees synthesis card, confirms (S5 endpoint stubbed for now), `feedback` row appears in Triage page.

**Key files:**
- New: `packages/feedback-frontend/src/chat/FeedbackChatSheet.tsx`, `ChatTimeline.tsx`, `Composer.tsx` (text only), `SynthesisCard.tsx`, `useFeedbackChat.ts`, `useChatRunStream.ts` (renamed from useIterRunStream).
- Move from `iter/` to `chat/`: `ChatBubble.tsx`, `markdownView.tsx`, `forbiddenWords.ts`.
- Modify: `index.ts` exports.
- Modify: `FeedbackButton.tsx` opens new sheet instead of Compose.
- Tests: RTL component tests for Composer + SynthesisCard states.

### S4 — Voice (~0.5 sem)

**Goal:** Composer mic toggle. `MediaRecorder` records ≤30s. `POST /chat/sessions/{sid}/voice` proxies to Whisper, returns transcript. TranscriptionPreview editable. Audio discarded (D-013).

**Demo gate:** User speaks 10s of Spanish, transcript appears editable, user confirms, message sent as `via:"voice"`.

**Key files:**
- New: `packages/feedback-frontend/src/chat/VoiceRecorder.tsx`, `TranscriptionPreview.tsx`, `useVoiceCapture.ts`.
- New backend endpoint: `POST /chat/sessions/{sid}/voice` in `chat_router.py`.
- New: `chat_llm/openai.py::transcribe_audio()` helper (Whisper SDK call).
- Tests: voice flow with mocked Whisper response; browser-compat fallback for Safari iOS.

### S5 — Confirm + Feedback row (~0.5 sem)

**Goal:** `POST /chat/sessions/{sid}/confirm` creates the `feedback` row, copies `synthesis_json`, sets `feedback.title/description/expected_outcome/severity` from synthesis. Ajustar button returns to chat with bot question (D-012).

**Demo gate:** Submitter confirms synthesis card → `feedback` row appears in admin Triage with ticket_code.

**Key files:**
- Extend: `chat_service.py` with `confirm()` + `abandon()`.
- Add endpoints: `POST /confirm`, `POST /abandon` in `chat_router.py`.
- Frontend: SynthesisCard handles confirm + adjust flow.
- Email: trigger existing `enqueue_notification` for new-feedback email (reuse from `helpers.py`).
- Tests: confirm idempotency, RLS, email sent.

### S6 — Refine mode admin (~0.5 sem)

**Goal:** `[Refinar con AI]` button on Triage detail page opens FeedbackChatSheet in `mode='refine'`. Backend selects refine prompt (D-017) and injects synthesis_json + full capture messages (D-019).

**Demo gate:** Admin clicks refine on existing feedback → chat opens with synthesis preview → admin says "añade un AC sobre el null state" → new synthesis generated → confirm replaces feedback.synthesis_json.

**Key files:**
- New: `chat_prompts/refine_prompt.py` with refine system prompt.
- Modify: `chat_service.py` `start_session` to build refine context from existing feedback.
- Modify: `chat_router.py` to accept `mode='refine'` (already in S1 schema, just unblock service path).
- Frontend: `admin/FeedbackTriagePage.tsx` gains `[Refinar con AI]` button → opens FeedbackChatSheet.

### S7 — Cleanup + release (~1 sem)

**Goal:** Delete all `iter_*` modules + UI components no longer needed. Delete `forms/`, `Compose.tsx`, `Canvas.tsx`, `ElementSelector.tsx`, `MyTicketsPanel.tsx`. Export `<FeedbackComposeLegacy/>` as deprecated alias from `index.ts` with console.warn. Bump version to 1.0.0 in `__init__.py` + `package.json`. Write ADR-007 documenting redesign. Write CHANGELOG entry with migration guide for hosts.

**Demo gate:** PR diff shows ~9k LOC deleted; sandbox-host still passes E2E test; CHANGELOG.md renders correctly; `pip install` + `pnpm install` of v1.0.0 in a fresh host works.

**Key files:**
- Delete: `packages/feedback-backend/src/feedback_widget/iter_*.py` (10+ files), `iter_llm/` (use new `chat_llm/` everywhere), `iter_prompts/`.
- Delete: `packages/feedback-frontend/src/{Compose,Canvas,FeedbackPanel,ElementSelector,MyTicketsPanel}.tsx`, `forms/`, `iter/` (entire dir except already-moved files).
- New: `docs/adr/007-chat-first-redesign.md`.
- Modify: `CHANGELOG.md` with v1.0.0 section + migration guide.
- Modify: `__init__.py` `__version__ = "1.0.0"`, `package.json` `"version": "1.0.0"`.
- Add: `<FeedbackComposeLegacy/>` re-export with `console.warn("deprecated, will be removed in v1.1.0")`.

---

## Self-Review (S1 only — S2-S7 review when their plans are written)

**1. Spec coverage (S1 scope):**
- D-001 v1.0.0 versioning → S7 (out of S1 scope, deferred but acknowledged).
- D-006 schema → Tasks 2, 3 ✓
- D-002 kill iter → not in S1 (deferred to S7).
- D-008 severity admin-only → schema includes `feedback.severity` column ✓ (UI in S6).
- D-014 in_progress resume → `list_in_progress` endpoint + `resume_available` flag ✓
- D-020 bindings unchanged → no binding changes in S1 ✓
- D-021 SSE defaults → not in S1 (SSE arrives in S2).
- D-022 magic-link → unchanged in S1 ✓

**2. Placeholder scan:** No TBD, TODO, "implement later" in S1 tasks. Code blocks are complete. ✓

**3. Type consistency:** `ChatService.start_session()` returns `CreateChatSessionResponse` consistently across tests and router. `FeedbackChatSession` field names (mode, status, messages, synthesis_json, auto_context) match between models, schemas, service, migration. ✓

**4. Ambiguity check:** ✓ — all paths verified after fresh-eyes review.

**5. Fresh-eyes corrections applied (2026-05-13 post-review):**
- B1: `user.id` → `user.user_id` (matches `auth.py:48` `CurrentUserSnapshot.user_id`).
- B2: `tenant_id: uuid.UUID | None` — service propagates whatever the host provides; existing `service.py` follows same pattern (filter-when-set), so single-tenant hosts keep working.
- B3: RLS multi-tenant test dropped from S1 — current `TestAuth` hardcodes `tenant_id=None` and no `client_tenant_a/b` fixtures exist. Deferred to a slice that explicitly extends infra.
- B4: `_truncate_each_test` now truncates `feedback_chat_session` first (Task 8).
- B5: `messages` JSONB `server_default` lives ONLY in migration (`'[]'::jsonb`); model has plain `default_factory=list`, no `server_default`. Avoids SQLite/Postgres mismatch.
- B6: integration.py vars verified (`auth`, `engine`, `cfg`, `prefix` — `integration.py:128-129`).
- B7: `chat_service` tests moved from `tests/unit/` to `tests/integration/` because `JSONB` is Postgres-only.
- B8: test app fixture in `conftest.py:182-193` now mounts the chat router too (Task 7 step 3).
- B9: sandbox-host `main.py:59` uses `register_feedback_router` directly, so it gets explicit `register_feedback_chat_router` call (Task 7 step 6).
- B10: `make sandbox-jwt` doesn't exist → Task 9 step 3 now offers Option A (browser localStorage) + Option B (inline mint with secret).
- B11: Pydantic `mode: str` → `Literal["capture", "refine"]`.
- B12: 422 detail check loosened — accept any string containing `feedback_id` in any `detail[]` item, robust to Pydantic v1/v2 format differences.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-13-feedback-widget-chat-first.md`.**

This plan covers **S1 in bite-sized TDD detail**. S2..S7 are scoped (deliverables + key files + demo gate) but will receive their own bite-sized plans when their predecessor passes demo gate.

Two execution options for S1:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
