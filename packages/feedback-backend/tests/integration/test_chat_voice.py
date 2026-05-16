"""Integration tests for POST /chat/sessions/{sid}/voice — S4 (Whisper proxy).

Whisper is the only piece we can't smoke-test live — the OpenAI SDK would
need a real key + network. We monkey-patch
``feedback_widget.chat_router.transcribe_audio`` so the route exercises
its plumbing (ownership, 413 cap, glossary forwarding, language
persistence) without any external call.

Audio bytes are read once and discarded (D-013): the patched stub asserts
the bytes are non-empty but is otherwise blind to the codec.

Uses the same fixtures as the other chat integration tests:

- ``client``: TestClient bound to the app fixture (prefix='/feedback').
- ``TestAuth``: ``X-Test-Role`` header gates user identity.
"""

from __future__ import annotations

import io
import uuid
from typing import Any

import pytest
from feedback_widget.chat_models import (
    ChatSessionMode,
    ChatSessionStatus,
    FeedbackChatSession,
)
from feedback_widget.chat_whisper import WhisperTranscript
from sqlmodel import Session

AUTH_STAFF = {"X-Test-Role": "staff"}

# Mirrors the conftest constants — kept here so each test is
# self-documenting without reaching into private fixture state.
_STAFF_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
_ADMIN_USER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")


def _seed_session(
    engine,
    *,
    user_id: uuid.UUID,
    glossary_snapshot: dict[str, Any] | None = None,
    status_: ChatSessionStatus = ChatSessionStatus.IN_PROGRESS,
) -> uuid.UUID:
    with Session(engine) as s:
        row = FeedbackChatSession(
            tenant_id=None,
            user_id=user_id,
            mode=ChatSessionMode.CAPTURE,
            status=status_,
            auto_context={"url": "https://example.com/edit"},
            messages=[],
            glossary_snapshot=glossary_snapshot,
        )
        s.add(row)
        s.commit()
        s.refresh(row)
        return row.id


def test_voice_returns_transcript_with_mocked_whisper(
    client, engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Happy path — patched Whisper helper returns text + lang; the
    endpoint round-trips both, the session's detected_language flips."""
    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        glossary_snapshot={"product": "Sapphira"},
    )

    captured: dict[str, Any] = {}

    async def _fake_transcribe(
        audio_bytes: bytes,
        *,
        content_type: str,
        filename: str = "audio.webm",
        language_hint: str | None = None,
        glossary: dict[str, str] | None = None,
        settings: Any,
    ) -> WhisperTranscript:
        # Round-trip the inputs so the test can pin the wire shape.
        captured["audio_bytes"] = audio_bytes
        captured["content_type"] = content_type
        captured["filename"] = filename
        captured["language_hint"] = language_hint
        captured["glossary"] = glossary
        return WhisperTranscript(
            transcript="Hola, el botón guardar no responde.",
            lang="es",
        )

    monkeypatch.setattr(
        "feedback_widget.chat_router.transcribe_audio", _fake_transcribe
    )

    fake_audio = b"\x00" * 1024  # 1KB of dummy bytes — well under cap
    files = {"audio": ("clip.webm", io.BytesIO(fake_audio), "audio/webm")}

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/voice",
        files=files,
        data={"language_hint": "es"},
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["transcript"] == "Hola, el botón guardar no responde."
    assert body["lang"] == "es"

    # The patched helper received the bytes + glossary + hint.
    assert captured["audio_bytes"] == fake_audio
    assert captured["content_type"] == "audio/webm"
    assert captured["language_hint"] == "es"
    assert captured["glossary"] == {"product": "Sapphira"}

    # And the detected language is persisted so subsequent LLM turns
    # receive the hint (D-009).
    with Session(engine) as s:
        chat = s.get(FeedbackChatSession, sid)
        assert chat is not None
        assert chat.detected_language == "es"


def test_voice_413_when_audio_too_large(
    client, engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A blob bigger than the 5MB cap is rejected before the SDK is
    reached. The patched Whisper helper MUST NOT be invoked."""
    sid = _seed_session(engine, user_id=_STAFF_USER_ID)

    invoked = {"count": 0}

    async def _fake_transcribe(*args: Any, **kwargs: Any) -> WhisperTranscript:
        invoked["count"] += 1
        return WhisperTranscript(transcript="should not be reached", lang="es")

    monkeypatch.setattr(
        "feedback_widget.chat_router.transcribe_audio", _fake_transcribe
    )

    too_big = b"\x00" * (5_000_001)  # one byte over the cap
    files = {"audio": ("clip.webm", io.BytesIO(too_big), "audio/webm")}

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/voice",
        files=files,
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 413, resp.text
    assert invoked["count"] == 0, "Whisper SDK must not be invoked when 413"


def test_voice_404_for_unowned_session(
    client, engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Admin owns the session → staff (different user_id) gets 404. No
    audio touches the SDK — ownership check fires first."""
    sid = _seed_session(engine, user_id=_ADMIN_USER_ID)

    invoked = {"count": 0}

    async def _fake_transcribe(*args: Any, **kwargs: Any) -> WhisperTranscript:
        invoked["count"] += 1
        return WhisperTranscript(transcript="leaked", lang="en")

    monkeypatch.setattr(
        "feedback_widget.chat_router.transcribe_audio", _fake_transcribe
    )

    files = {"audio": ("clip.webm", io.BytesIO(b"\x00" * 128), "audio/webm")}

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/voice",
        files=files,
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 404, resp.text
    assert invoked["count"] == 0, "Whisper SDK must not be invoked when 404"


# Silence pytest's "module 'pytest' has no member" if discovery skips.
_ = pytest
