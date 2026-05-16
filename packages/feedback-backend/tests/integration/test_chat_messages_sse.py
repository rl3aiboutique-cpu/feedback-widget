"""Integration tests for POST /chat/sessions/{sid}/messages — S2 Batch B.

Covers:

* Happy-path SSE stream emits ``delta`` + ``turn_done``.
* Cross-user ownership returns 404 without leaking session existence.
* ``Idempotency-Key`` header replays byte-for-byte within 1h TTL.
* synthesize mode emits a ``synthesis`` event and persists
  ``synthesis_json`` on the session row.

A scripted :class:`FakeLLMProvider` subclass swaps in via ``monkeypatch``
on ``feedback_widget.chat_router.build_provider`` so each test feeds its
own canned response without spinning up a real LLM SDK.
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
from feedback_widget.llm.fake import FakeLLMProvider
from feedback_widget.llm.protocol import (
    LLMAttachment,
    LLMResult,
    LLMUsage,
)
from sqlmodel import Session

AUTH_STAFF = {"X-Test-Role": "staff"}
AUTH_ADMIN = {"X-Test-Role": "admin"}

# ────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────


def _discover_payload(reply: str = "Cuéntame qué pasó.") -> dict[str, Any]:
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
    """Per-test scripted fake. One ``stream_responses`` entry per call."""

    def __init__(self, stream_responses: list[str]) -> None:
        self._queue = list(stream_responses)
        self.calls = 0

    async def stream(  # type: ignore[override]
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        attachments: list[LLMAttachment],
        timeout_seconds: int,
        max_output_tokens: int,
    ) -> AsyncIterator[str]:
        del system_prompt, user_prompt, attachments, timeout_seconds, max_output_tokens
        self.calls += 1
        if not self._queue:
            raise AssertionError("scripted stream queue exhausted")
        raw = self._queue.pop(0)
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
        # Not used in these tests — present so the repair loop has
        # something to call if a parse failure ever sneaks in.
        del system_prompt, user_prompt, attachments, timeout_seconds, max_output_tokens
        return LLMResult(
            raw_text=json.dumps(_discover_payload()),
            usage=LLMUsage(input_tokens=1, output_tokens=1, latency_ms=1),
            finish_reason="stop",
            model_id="fake-1",
            model_provider="fake",
        )


def _patch_provider(monkeypatch: pytest.MonkeyPatch, provider: _ScriptedLLMProvider) -> None:
    """Swap the chat router's ``build_provider`` for a one-shot factory.

    The router calls ``build_provider(settings)`` per request; the patch
    ignores settings and returns the supplied scripted provider.
    """
    monkeypatch.setattr(
        "feedback_widget.chat_router.build_provider",
        lambda _settings: provider,
    )


def _seed_open_session(
    engine,
    *,
    user_id: uuid.UUID,
    tenant_id: uuid.UUID | None = None,
) -> uuid.UUID:
    with Session(engine) as db:
        row = FeedbackChatSession(
            tenant_id=tenant_id,
            user_id=user_id,
            mode=ChatSessionMode.CAPTURE,
            status=ChatSessionStatus.OPEN,
            auto_context={"url": "https://example.com"},
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row.id


_STAFF_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
_ADMIN_USER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")


def _read_sse_events(raw_body: str) -> list[tuple[str, dict[str, Any]]]:
    """Parse SSE text into ``[(event_name, data_dict), ...]``.

    Tolerates blank lines + comment lines per the SSE grammar.
    """
    events: list[tuple[str, dict[str, Any]]] = []
    current_event: str | None = None
    current_data: list[str] = []
    for line in raw_body.split("\n"):
        line = line.rstrip("\r")
        if line == "":
            if current_event is not None and current_data:
                try:
                    data = json.loads("\n".join(current_data))
                except json.JSONDecodeError:
                    data = {"_raw": "\n".join(current_data)}
                events.append((current_event, data))
            current_event = None
            current_data = []
            continue
        if line.startswith(":"):
            # SSE comment (e.g. heartbeats); skip.
            continue
        if line.startswith("event:"):
            current_event = line[len("event:") :].strip()
        elif line.startswith("data:"):
            current_data.append(line[len("data:") :].lstrip(" "))
    return events


# ────────────────────────────────────────────────────────────────────
# Tests
# ────────────────────────────────────────────────────────────────────


def test_post_message_streams_delta_and_turn_done(
    client,
    engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Happy path — provider returns a valid discover-mode JSON; the
    SSE stream MUST contain ``delta`` chunks then a ``turn_done`` with
    a parsable ``data:`` line."""
    session_id = _seed_open_session(engine, user_id=_STAFF_USER_ID)
    provider = _ScriptedLLMProvider([json.dumps(_discover_payload())])
    _patch_provider(monkeypatch, provider)

    resp = client.post(
        f"/feedback/chat/sessions/{session_id}/messages",
        json={"content": "No puedo guardar mi trabajo", "via": "text"},
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/event-stream")
    events = _read_sse_events(resp.text)
    types = [t for t, _ in events]
    assert "delta" in types, types
    assert "turn_done" in types, types
    # turn_done payload must be valid JSON carrying a 'turn' object.
    turn_done = next(d for t, d in events if t == "turn_done")
    assert "turn" in turn_done
    assert turn_done["turn"]["mode"] == "discover"


def test_post_message_returns_404_for_other_users_session(
    client,
    engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Session owned by staff user → admin user posting must 404."""
    session_id = _seed_open_session(engine, user_id=_STAFF_USER_ID)
    # Patch even though we expect a 404 BEFORE the provider is called;
    # this keeps the test stable if FEEDBACK_ITER_PROVIDER ever drifts.
    provider = _ScriptedLLMProvider([json.dumps(_discover_payload())])
    _patch_provider(monkeypatch, provider)

    resp = client.post(
        f"/feedback/chat/sessions/{session_id}/messages",
        json={"content": "hola", "via": "text"},
        headers=AUTH_ADMIN,
    )

    assert resp.status_code == 404, resp.text
    # Provider must NOT have been invoked — ownership check is pre-stream.
    assert provider.calls == 0


def test_idempotency_key_replays_within_1h(
    client,
    engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two requests carrying the same Idempotency-Key produce the same
    stream; the second call MUST NOT invoke the provider."""
    session_id = _seed_open_session(engine, user_id=_STAFF_USER_ID)
    provider = _ScriptedLLMProvider([json.dumps(_discover_payload())])
    _patch_provider(monkeypatch, provider)

    key = "abc-123-replay"
    headers = {**AUTH_STAFF, "Idempotency-Key": key}
    resp1 = client.post(
        f"/feedback/chat/sessions/{session_id}/messages",
        json={"content": "primero", "via": "text"},
        headers=headers,
    )
    assert resp1.status_code == 200, resp1.text
    body1 = resp1.text
    calls_after_first = provider.calls
    assert calls_after_first == 1

    resp2 = client.post(
        f"/feedback/chat/sessions/{session_id}/messages",
        json={"content": "segundo (debería ser ignorado)", "via": "text"},
        headers=headers,
    )
    assert resp2.status_code == 200, resp2.text
    body2 = resp2.text

    # The provider must NOT have been invoked a second time.
    assert provider.calls == calls_after_first
    # Replay must be byte-for-byte identical.
    assert body1 == body2


def test_post_message_yields_synthesis_event_when_capture_complete(
    client,
    engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Synthesize-mode payload from the model → SSE stream must emit a
    ``synthesis`` event AND the session row carries ``synthesis_json``."""
    session_id = _seed_open_session(engine, user_id=_STAFF_USER_ID)
    provider = _ScriptedLLMProvider([json.dumps(_synthesize_payload())])
    _patch_provider(monkeypatch, provider)

    resp = client.post(
        f"/feedback/chat/sessions/{session_id}/messages",
        json={"content": "Ya está", "via": "text"},
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    events = _read_sse_events(resp.text)
    types = [t for t, _ in events]
    assert "synthesis" in types, types
    # The synthesis event must carry the model's structured payload.
    synth = next(d for t, d in events if t == "synthesis")
    assert "data" in synth
    assert synth["data"]["title"] == "Botón guardar no responde"

    # Session row must reflect awaiting_confirm + synthesis_json persisted.
    with Session(engine) as db:
        row = db.get(FeedbackChatSession, session_id)
        assert row is not None
        assert row.status == ChatSessionStatus.AWAITING_CONFIRM
        assert row.synthesis_json is not None
        assert row.synthesis_json["title"] == "Botón guardar no responde"
