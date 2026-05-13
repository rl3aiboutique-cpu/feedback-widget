"""Integration tests for ChatService.run_turn — S2 Batch A.

Exercises the streamed-turn orchestration against a real Postgres
(via the existing ``engine`` fixture in conftest) and a custom
``FakeLLMProvider`` subclass that lets each test seed the canned
response. The tests cover:

* Capture-mode discover turn lands in messages with mode=discover.
* Turn budget (5) forces synthesize on the 5th user turn.
* Malformed JSON triggers the repair-hint loop, then succeeds.
* Forbidden-word reply is scrubbed before persistence.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator
from typing import Any

import pytest
from feedback_widget.chat_models import (
    ChatSessionMode,
    ChatSessionStatus,
    FeedbackChatSession,
)
from feedback_widget.chat_service import ChatService
from feedback_widget.iter_llm.fake import FakeLLMProvider
from feedback_widget.iter_llm.protocol import (
    LLMAttachment,
    LLMResult,
    LLMUsage,
)
from sqlmodel import Session

# ────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────


def _discover_payload(reply: str = "Cuéntame qué pasó.") -> dict[str, Any]:
    """Canned discover-mode turn payload that satisfies the parser."""
    return {
        "mode": "discover",
        "reply": reply,
        "covered": {
            "problem": 0.2,
            "context": 0.1,
            "expectation": 0.0,
            "reality": 0.0,
            "impact": 0.0,
            "change": 0.0,
            "example": 0.0,
            "importance": 0.0,
        },
        "active_branch": "1",
        "inferred": {"type": "bug", "severity": "minor"},
        "synthesis": None,
    }


def _synthesize_payload() -> dict[str, Any]:
    """Canned synthesize-mode turn payload."""
    return {
        "mode": "synthesize",
        "reply": "Resumiendo lo que me contaste.",
        "covered": {
            "problem": 1.0,
            "context": 1.0,
            "expectation": 1.0,
            "reality": 1.0,
            "impact": 1.0,
            "change": 1.0,
            "example": 0.5,
            "importance": 0.5,
        },
        "active_branch": "leaf",
        "inferred": {"type": "bug", "severity": "major"},
        "synthesis": {
            "title": "Botón guardar no responde",
            "summary": "El usuario no logra guardar.",
            "user_story": "Como usuario quiero guardar mi trabajo.",
            "context": "Pantalla de edición.",
            "user_need": "Persistir cambios.",
            "acceptance_criteria": ["El botón guarda el formulario."],
            "open_questions": [],
        },
    }


class _ScriptedLLMProvider(FakeLLMProvider):
    """Fake provider whose responses are scripted per-call.

    ``stream_responses`` queues raw strings that the next
    ``stream(...)`` call will emit (one entry = one whole call's
    output, chunked into ~64-char pieces).

    ``generate_responses`` queues responses for the ``generate(...)``
    path used by the parser's repair-hint retry loop.

    ``stream_calls`` and ``generate_calls`` record how many times
    each path was invoked so tests can assert retry behaviour.
    """

    def __init__(
        self,
        stream_responses: list[str],
        generate_responses: list[str] | None = None,
    ) -> None:
        self._stream_queue = list(stream_responses)
        self._generate_queue = list(generate_responses or [])
        self.stream_calls = 0
        self.generate_calls = 0
        self.last_system_prompt: str | None = None
        self.last_user_prompt: str | None = None

    async def stream(  # type: ignore[override]
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        attachments: list[LLMAttachment],
        timeout_seconds: int,
        max_output_tokens: int,
    ) -> AsyncIterator[str]:
        del attachments, timeout_seconds, max_output_tokens
        self.stream_calls += 1
        self.last_system_prompt = system_prompt
        self.last_user_prompt = user_prompt
        if not self._stream_queue:
            raise AssertionError("scripted stream queue exhausted")
        raw = self._stream_queue.pop(0)
        chunk_size = 64
        for i in range(0, len(raw), chunk_size):
            yield raw[i : i + chunk_size]
            await asyncio.sleep(0)

    async def generate(  # type: ignore[override]
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        attachments: list[LLMAttachment],
        timeout_seconds: int,
        max_output_tokens: int,
    ) -> LLMResult:
        del attachments, timeout_seconds, max_output_tokens
        self.generate_calls += 1
        self.last_system_prompt = system_prompt
        self.last_user_prompt = user_prompt
        if not self._generate_queue:
            raise AssertionError("scripted generate queue exhausted")
        raw = self._generate_queue.pop(0)
        return LLMResult(
            raw_text=raw,
            usage=LLMUsage(input_tokens=10, output_tokens=10, latency_ms=5),
            finish_reason="stop",
            model_id="fake-1",
            model_provider=self.name,
        )


@pytest.fixture
def db_session(engine):  # uses integration conftest's `engine` fixture
    with Session(engine) as s:
        yield s


def _seed_open_session(
    db_session: Session,
    *,
    tenant_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    messages: list[dict[str, Any]] | None = None,
    auto_context: dict[str, Any] | None = None,
) -> FeedbackChatSession:
    row = FeedbackChatSession(
        tenant_id=tenant_id,
        user_id=user_id or uuid.uuid4(),
        mode=ChatSessionMode.CAPTURE,
        status=ChatSessionStatus.OPEN,
        auto_context=auto_context or {"url": "https://example.com"},
        messages=messages or [],
    )
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)
    return row


async def _collect(gen) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    async for ev in gen:
        out.append(ev)
    return out


# ────────────────────────────────────────────────────────────────────
# Tests
# ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_turn_capture_emits_discover_when_under_cap(
    db_session: Session,
) -> None:
    """Happy path: under turn cap, model emits discover, service
    persists the turn, status flips OPEN → IN_PROGRESS."""
    row = _seed_open_session(db_session)
    provider = _ScriptedLLMProvider(
        stream_responses=[json.dumps(_discover_payload())],
    )

    svc = ChatService()
    events = await _collect(
        svc.run_turn(
            session_db=db_session,
            chat_session_id=row.id,
            user_content="No puedo guardar mi trabajo",
            provider=provider,
            glossary={"trabajo": "documento"},
        )
    )

    # delta events first, then turn_done; no synthesize events.
    types = [ev["type"] for ev in events]
    assert "delta" in types
    assert "turn_done" in types
    assert "synthesis" not in types

    turn_done = next(ev for ev in events if ev["type"] == "turn_done")
    assert turn_done["turn"]["mode"] == "discover"
    assert turn_done["turn"]["active_branch"] == "1"

    db_session.expire_all()
    persisted = db_session.get(FeedbackChatSession, row.id)
    assert persisted is not None
    assert persisted.status == ChatSessionStatus.IN_PROGRESS
    # Two messages: user input + assistant reply.
    roles = [m["role"] for m in persisted.messages]
    assert roles == ["user", "assistant"]
    assert persisted.messages[1]["mode"] == "discover"
    assert persisted.synthesis_json is None


@pytest.mark.asyncio
async def test_run_turn_forces_synthesize_at_turn_5(
    db_session: Session,
) -> None:
    """With 4 prior user turns persisted, the new user message is
    turn 5 → service forces synthesize. The system prompt suffix
    flagged to the model must reflect that forcing."""
    prior_msgs: list[dict[str, Any]] = []
    for i in range(4):
        prior_msgs.append({"role": "user", "text": f"u{i}"})
        prior_msgs.append({"role": "assistant", "text": f"a{i}", "mode": "discover"})

    row = _seed_open_session(db_session, messages=prior_msgs)
    provider = _ScriptedLLMProvider(
        stream_responses=[json.dumps(_synthesize_payload())],
    )

    svc = ChatService()
    events = await _collect(
        svc.run_turn(
            session_db=db_session,
            chat_session_id=row.id,
            user_content="Ya está",
            provider=provider,
        )
    )

    # System prompt should carry the forced-synthesize suffix.
    assert provider.last_system_prompt is not None
    assert "INSTRUCCIÓN FORZADA" in provider.last_system_prompt

    types = [ev["type"] for ev in events]
    assert types[-2:] == ["synthesizing", "synthesis"]
    turn_done = next(ev for ev in events if ev["type"] == "turn_done")
    assert turn_done["turn"]["mode"] == "synthesize"

    db_session.expire_all()
    persisted = db_session.get(FeedbackChatSession, row.id)
    assert persisted is not None
    assert persisted.status == ChatSessionStatus.AWAITING_CONFIRM
    assert persisted.synthesis_json is not None
    assert persisted.synthesis_json["title"] == "Botón guardar no responde"


@pytest.mark.asyncio
async def test_run_turn_handles_malformed_json_with_repair(
    db_session: Session,
) -> None:
    """Stream emits invalid JSON twice (initial + first retry); third
    attempt succeeds. The service must call generate(...) twice in
    the repair loop and emit a single turn_done in the end."""
    row = _seed_open_session(db_session)
    provider = _ScriptedLLMProvider(
        stream_responses=["this is not json at all"],
        generate_responses=[
            "still not json",  # first repair retry fails
            json.dumps(_discover_payload(reply="Reintento OK")),
        ],
    )

    svc = ChatService()
    events = await _collect(
        svc.run_turn(
            session_db=db_session,
            chat_session_id=row.id,
            user_content="hola",
            provider=provider,
        )
    )

    # One stream call (the initial), two generate calls (the two
    # repair retries).
    assert provider.stream_calls == 1
    assert provider.generate_calls == 2

    types = [ev["type"] for ev in events]
    assert "turn_done" in types
    assert "error" not in types
    turn_done = next(ev for ev in events if ev["type"] == "turn_done")
    assert turn_done["turn"]["reply"] == "Reintento OK"


@pytest.mark.asyncio
async def test_run_turn_persists_message_and_scrubs_forbidden_words(
    db_session: Session,
) -> None:
    """When the assistant reply contains a forbidden word and the
    glossary maps it, the persisted message text must carry the
    rewritten version, not the original."""
    row = _seed_open_session(db_session)
    payload = _discover_payload(reply="Voy a abrir un ticket de cache para ti.")
    provider = _ScriptedLLMProvider(stream_responses=[json.dumps(payload)])

    svc = ChatService()
    await _collect(
        svc.run_turn(
            session_db=db_session,
            chat_session_id=row.id,
            user_content="hola",
            provider=provider,
            forbidden_words=["ticket", "cache"],
            glossary={"ticket": "incidencia", "cache": "memoria temporal"},
        )
    )

    db_session.expire_all()
    persisted = db_session.get(FeedbackChatSession, row.id)
    assert persisted is not None
    assistant_msg = persisted.messages[-1]
    assert assistant_msg["role"] == "assistant"
    # The forbidden words should be rewritten via glossary.
    text = assistant_msg["text"].lower()
    assert "ticket" not in text
    assert "cache" not in text
    assert "incidencia" in text or "memoria temporal" in text
