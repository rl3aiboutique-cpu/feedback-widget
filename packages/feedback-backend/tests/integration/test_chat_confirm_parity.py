"""Integration tests for chat-first confirm paridad with legacy POST.

Each phase of the Sprint A spec (docs/specs/20260514_1500_SPEC_chat-first-
parity-with-legacy.md) lands one test here so the parity invariants stay
verifiable in isolation:

    A1 (Phase 1) — redact_string/redact_bundle on title, description,
                    expected_outcome, metadata_bundle, synthesis_json
    A4 (Phase 2) — auto_context.element_* copied to feedback.element_* cols
    A5 (Phase 3) — check_user_rate_limit raises FeedbackRateLimitExceededError
                    → 429 with Retry-After
    A2 (Phase 4) — enqueue_notification called via BackgroundTasks
    A3 (Phase 5) — screenshot_b64 decoded + upload_feedback_attachment +
                    metadata_bundle.screenshot_attachment_id populated
    Phase 6     — screenshot bytes re-read and attached inline to email

Tests share the same fixtures as test_chat_confirm_abandon.py (client +
engine from conftest.py) so they exercise the real ChatService.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from feedback_widget.chat_models import (
    ChatSessionMode,
    ChatSessionStatus,
    FeedbackChatSession,
)
from feedback_widget.models import Feedback
from sqlmodel import Session

AUTH_STAFF = {"X-Test-Role": "staff"}

_STAFF_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

# Tokens that the redactor MUST strip. Matches patterns covered in
# tests/unit/test_redaction.py: bearer header, JWT shape, query param
# token, cookie line.
_BEARER = "Bearer abc123.def456.ghi789jkl"
_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.SflKxwRJSMeKKF2QT4f"
_API_KEY_QUERY = "https://api.example.com/x?access_token=sk_live_5678"
_COOKIE = "Cookie: session=abc123; auth=def456"


def _seed_session(
    engine,
    *,
    user_id: uuid.UUID,
    synthesis_json: dict[str, Any] | None = None,
    auto_context: dict[str, Any] | None = None,
) -> uuid.UUID:
    with Session(engine) as s:
        row = FeedbackChatSession(
            tenant_id=None,
            user_id=user_id,
            mode=ChatSessionMode.CAPTURE,
            status=ChatSessionStatus.AWAITING_CONFIRM,
            auto_context=auto_context
            or {
                "url": "https://example.com/edit",
                "route": "/edit",
                "app_version": "v1.2.3",
            },
            messages=[],
            synthesis_json=synthesis_json,
        )
        s.add(row)
        s.commit()
        s.refresh(row)
        return row.id


def test_confirm_redacts_jwt_bearer_in_synthesis_and_metadata(
    client, engine
) -> None:
    """Phase 1 / A1 — every free-text field plus metadata_bundle and
    synthesis_json are scrubbed by redact_string / redact_bundle so a
    JWT or Bearer token that the user pasted in chat never reaches the
    persisted feedback row."""
    poisoned_synthesis = {
        "title": f"Auth fails when sending {_BEARER}",
        "summary": f"Server returns 401 with header '{_BEARER}'.",
        "user_story": f"Como user envío el header con {_JWT}.",
        "context": "Pantalla login.",
        "user_need": f"Que la API acepte mi token {_JWT}.",
        "acceptance_criteria": [f"Llamada GET {_API_KEY_QUERY} responde 200."],
        "open_questions": [],
        "inferred": {"type": "bug", "severity": "major"},
    }
    poisoned_auto = {
        "url": _API_KEY_QUERY,
        "route": "/edit",
        "app_version": "v1.2.3",
        "headers": [_COOKIE, f"Authorization: {_BEARER}"],
    }
    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json=poisoned_synthesis,
        auto_context=poisoned_auto,
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={"synthesis_override": None},
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    feedback_id = uuid.UUID(resp.json()["feedback_id"])

    with Session(engine) as s:
        fb = s.get(Feedback, feedback_id)
        assert fb is not None

        # Free-text columns
        assert "Bearer" not in fb.title
        assert _BEARER not in fb.title
        assert "[REDACTED]" in fb.title
        assert _BEARER not in fb.description
        assert _JWT not in fb.description
        assert "[REDACTED]" in fb.description
        assert fb.expected_outcome is not None
        assert _JWT not in fb.expected_outcome
        assert "[REDACTED]" in fb.expected_outcome

        # metadata_bundle JSONB — recursive redaction
        assert fb.metadata_bundle is not None
        bundle_blob = repr(fb.metadata_bundle)
        assert _BEARER not in bundle_blob
        assert _COOKIE not in bundle_blob
        assert "access_token=sk_live_5678" not in bundle_blob

        # synthesis_json JSONB — recursive redaction
        assert fb.synthesis_json is not None
        synth_blob = repr(fb.synthesis_json)
        assert _BEARER not in synth_blob
        assert _JWT not in synth_blob

        # Derived single-col fields read from redacted auto
        assert "access_token=sk_live_5678" not in fb.url_captured


def test_confirm_persists_element_metadata_to_dedicated_columns(
    client, engine
) -> None:
    """Phase 2 / A4 — when the user locked an element before opening the
    chat, auto_context.element_* is promoted to the feedback row's
    dedicated columns so admin queries that filter on element_selector
    return chat-first rows too."""
    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json={
            "title": "Botón roto",
            "summary": "El botón no responde.",
            "user_story": "Como user quiero hacer click.",
            "context": "Pantalla edit.",
            "user_need": "Que el botón funcione.",
            "acceptance_criteria": ["El botón emite onClick."],
            "open_questions": [],
            "inferred": {"type": "bug", "severity": "minor"},
        },
        auto_context={
            "url": "https://example.com/edit",
            "route": "/edit",
            "app_version": "v1.2.3",
            "element_selector": "#save-btn",
            "element_xpath": "/html/body/div[1]/button[2]",
            "element_bounding_box": {"x": 100, "y": 200, "w": 50, "h": 25},
        },
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={"synthesis_override": None},
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    feedback_id = uuid.UUID(resp.json()["feedback_id"])

    with Session(engine) as s:
        fb = s.get(Feedback, feedback_id)
        assert fb is not None
        assert fb.element_selector == "#save-btn"
        assert fb.element_xpath == "/html/body/div[1]/button[2]"
        assert fb.element_bounding_box == {"x": 100, "y": 200, "w": 50, "h": 25}
        # And still preserved in metadata_bundle for backward compat
        assert fb.metadata_bundle["element_selector"] == "#save-btn"


def test_confirm_enqueues_email_notification(
    client, engine, settings, monkeypatch
) -> None:
    """Phase 4 / A2 — chat confirm enqueues an SMTP send to
    FEEDBACK_NOTIFY_EMAILS just like legacy POST /feedback. Patch
    send_email to capture the kwargs without hitting a real MTA."""
    captures: list[dict[str, Any]] = []

    def fake_send_email(**kwargs: Any) -> bool:
        captures.append(kwargs)
        return True

    monkeypatch.setattr("feedback_widget.helpers.send_email", fake_send_email)
    # NOTIFY_EMAILS must be non-empty for enqueue_notification to fire
    monkeypatch.setattr(settings, "NOTIFY_EMAILS", "ops@example.com")

    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json={
            "title": "Email path",
            "summary": "El user reporta un bug.",
            "user_story": "Como user quiero la notificación.",
            "context": "n/a",
            "user_need": "Que el admin reciba el feedback por email.",
            "acceptance_criteria": [],
            "open_questions": [],
            "inferred": {"type": "bug", "severity": "major"},
        },
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={"synthesis_override": None},
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    assert len(captures) == 1, "expected exactly one SMTP send enqueued"
    sent = captures[0]
    assert sent["to"] == ["ops@example.com"]
    assert "Email path" in sent["subject"]
    # Phase 4: screenshot bytes stay None — Phase 6 attaches the inline
    # image. Verify the attachments param is absent / None.
    assert not sent.get("attachments")


def test_confirm_skips_email_when_notify_emails_empty(
    client, engine, settings, monkeypatch
) -> None:
    """No-op path: when FEEDBACK_NOTIFY_EMAILS is unset, the helper
    returns early and send_email is never invoked."""
    captures: list[dict[str, Any]] = []
    monkeypatch.setattr(
        "feedback_widget.helpers.send_email",
        lambda **k: captures.append(k) or True,
    )
    monkeypatch.setattr(settings, "NOTIFY_EMAILS", "")

    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json={
            "title": "Silent path",
            "summary": "n/a",
            "user_story": "n/a",
            "context": "n/a",
            "user_need": "n/a",
            "acceptance_criteria": [],
            "open_questions": [],
            "inferred": {"type": "ui", "severity": "minor"},
        },
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={"synthesis_override": None},
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    assert captures == []


def test_confirm_raises_rate_limit_error_when_cap_exceeded(engine) -> None:
    """Phase 3 / A5 — chat confirm respects rate limit. Test the service
    layer directly because the test fixture builds settings session-scoped
    at cap=1000; calling the service with a tight settings override
    isolates the rate-limit branch without rebuilding the entire app."""
    from feedback_widget.chat_service import ChatService
    from feedback_widget.exceptions import FeedbackRateLimitExceededError
    from feedback_widget.models import FeedbackStatus, FeedbackType
    from feedback_widget.settings import FeedbackSettings

    # Seed 2 feedback rows in the current hour
    with Session(engine) as s:
        for i in range(2):
            s.add(
                Feedback(
                    tenant_id=None,
                    user_id=_STAFF_USER_ID,
                    type=FeedbackType.BUG,
                    status=FeedbackStatus.NEW,
                    title=f"Existing row {i}",
                    description="seeded",
                    url_captured="https://example.com",
                    metadata_bundle={},
                    ticket_code=f"FB-2026-{9000 + i:04d}",
                )
            )
        s.commit()

    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json={
            "title": "Rate-limited attempt",
            "summary": "Should be rejected.",
            "user_story": "n/a",
            "context": "n/a",
            "user_need": "n/a",
            "acceptance_criteria": [],
            "open_questions": [],
            "inferred": {"type": "bug", "severity": "minor"},
        },
    )

    tight_settings = FeedbackSettings(RATE_LIMIT_PER_HOUR=2)
    service = ChatService()
    with Session(engine) as s, pytest.raises(FeedbackRateLimitExceededError) as exc_info:
        service.confirm_session(
            session=s,
            chat_session_id=sid,
            tenant_id=None,
            user_id=_STAFF_USER_ID,
            settings=tight_settings,
        )
    assert exc_info.value.retry_after_seconds > 0


def test_confirm_router_returns_429_when_rate_limit_raised(
    client, engine, settings, monkeypatch
) -> None:
    """End-to-end variant: pin RATE_LIMIT_PER_HOUR at runtime on the
    settings fixture (mutable on the FeedbackSettings model) so the
    chat_router's existing closure sees the lowered cap, then verify
    the 429 + Retry-After header path."""
    from feedback_widget.models import FeedbackStatus, FeedbackType

    monkeypatch.setattr(settings, "RATE_LIMIT_PER_HOUR", 2)

    with Session(engine) as s:
        for i in range(2):
            s.add(
                Feedback(
                    tenant_id=None,
                    user_id=_STAFF_USER_ID,
                    type=FeedbackType.BUG,
                    status=FeedbackStatus.NEW,
                    title=f"Existing row {i}",
                    description="seeded",
                    url_captured="https://example.com",
                    metadata_bundle={},
                    ticket_code=f"FB-2026-{9100 + i:04d}",
                )
            )
        s.commit()

    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json={
            "title": "429 path",
            "summary": "Should be rejected by router.",
            "user_story": "n/a",
            "context": "n/a",
            "user_need": "n/a",
            "acceptance_criteria": [],
            "open_questions": [],
            "inferred": {"type": "bug", "severity": "minor"},
        },
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={"synthesis_override": None},
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 429, resp.text
    assert "Retry-After" in resp.headers
    assert int(resp.headers["Retry-After"]) > 0


def test_confirm_attaches_screenshot_inline_to_notification_email(
    client, engine, settings, fake_storage, monkeypatch
) -> None:
    """Phase 6 — when both screenshot AND notify emails are configured,
    the SMTP send carries the screenshot bytes inline (paridad legacy)."""
    import base64

    png_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    )
    b64_payload = base64.b64encode(png_bytes).decode("ascii")

    captures: list[dict[str, Any]] = []
    monkeypatch.setattr(
        "feedback_widget.helpers.send_email",
        lambda **k: captures.append(k) or True,
    )
    monkeypatch.setattr(settings, "NOTIFY_EMAILS", "ops@example.com")

    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json={
            "title": "Email + screenshot path",
            "summary": "Bug visible en captura.",
            "user_story": "Como user quiero el screenshot en el email.",
            "context": "n/a",
            "user_need": "Que el admin vea la imagen.",
            "acceptance_criteria": [],
            "open_questions": [],
            "inferred": {"type": "bug", "severity": "major"},
        },
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={
            "synthesis_override": None,
            "screenshot_b64": b64_payload,
            "screenshot_content_type": "image/png",
        },
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    assert len(captures) == 1
    sent = captures[0]
    attachments = sent.get("attachments") or []
    assert len(attachments) == 1, f"expected exactly 1 inline attachment, got {len(attachments)}"
    image_attachment = attachments[0]
    # EmailAttachment is a frozen dataclass — access via attribute
    assert image_attachment.content_type == "image/png"
    assert image_attachment.content == png_bytes


def test_confirm_uploads_screenshot_to_storage_and_creates_attachment_row(
    client, engine, fake_storage
) -> None:
    """Phase 5 / A3 — when the frontend ships screenshot_b64, the
    backend decodes it, uploads via upload_feedback_attachment (S3 in
    prod, FakeStorage in tests) and creates the matching
    FeedbackAttachment row. metadata_bundle.screenshot_attachment_id
    points at the new row for the admin UI."""
    import base64

    from feedback_widget.models import FeedbackAttachment, FeedbackAttachmentKind

    # 1x1 transparent PNG — smallest valid PNG byte sequence
    png_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    )
    b64_payload = base64.b64encode(png_bytes).decode("ascii")

    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json={
            "title": "Screenshot path",
            "summary": "Browser captured a PNG.",
            "user_story": "Como user veo la página.",
            "context": "n/a",
            "user_need": "Que el screenshot llegue al admin.",
            "acceptance_criteria": [],
            "open_questions": [],
            "inferred": {"type": "bug", "severity": "minor"},
        },
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={
            "synthesis_override": None,
            "screenshot_b64": b64_payload,
            "screenshot_content_type": "image/png",
        },
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    feedback_id = uuid.UUID(resp.json()["feedback_id"])

    # FakeStorage received the bytes under the screenshot object_key pattern
    matching_keys = [
        k for k in fake_storage.objects if str(feedback_id) in k and k.endswith(".png")
    ]
    assert len(matching_keys) == 1, f"expected 1 screenshot object, got {len(matching_keys)} — keys: {list(fake_storage.objects)}"
    assert fake_storage.objects[matching_keys[0]] == png_bytes

    # FeedbackAttachment row created
    with Session(engine) as s:
        from sqlmodel import select as _select

        rows = s.exec(
            _select(FeedbackAttachment).where(FeedbackAttachment.feedback_id == feedback_id)
        ).all()
        assert len(rows) == 1
        attachment = rows[0]
        assert attachment.kind == FeedbackAttachmentKind.SCREENSHOT
        assert attachment.content_type == "image/png"
        assert attachment.byte_size == len(png_bytes)

        # metadata_bundle.screenshot_attachment_id resolves to this row
        fb = s.get(Feedback, feedback_id)
        assert fb is not None
        assert fb.metadata_bundle.get("screenshot_attachment_id") == str(attachment.id)


def test_confirm_succeeds_without_screenshot_when_capture_failed(
    client, engine, fake_storage
) -> None:
    """Fail-soft: if the frontend ships screenshot_b64=None (capture
    failed silently), confirm still succeeds without an attachment."""
    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json={
            "title": "No screenshot path",
            "summary": "Capture failed.",
            "user_story": "Como user envío sin imagen.",
            "context": "n/a",
            "user_need": "Que el confirm no falle por falta de screenshot.",
            "acceptance_criteria": [],
            "open_questions": [],
            "inferred": {"type": "ui", "severity": "minor"},
        },
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={"synthesis_override": None, "screenshot_b64": None},
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    feedback_id = uuid.UUID(resp.json()["feedback_id"])
    matching_keys = [k for k in fake_storage.objects if str(feedback_id) in k]
    assert matching_keys == []

    with Session(engine) as s:
        fb = s.get(Feedback, feedback_id)
        assert fb is not None
        assert "screenshot_attachment_id" not in (fb.metadata_bundle or {})


def test_confirm_leaves_element_columns_null_when_no_locked_element(
    client, engine
) -> None:
    """Whole-page capture (no element locked) leaves element_* columns
    NULL — mirrors the legacy behavior where the element block is
    optional in FeedbackCreatePayload."""
    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json={
            "title": "Whole page feedback",
            "summary": "Comentario sobre la página.",
            "user_story": "Como user observo la página.",
            "context": "Vista general.",
            "user_need": "Que mejore el flow.",
            "acceptance_criteria": ["El flow es claro."],
            "open_questions": [],
            "inferred": {"type": "ui", "severity": "minor"},
        },
        auto_context={
            "url": "https://example.com/edit",
            "route": "/edit",
            "app_version": "v1.2.3",
            # NO element_* keys
        },
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={"synthesis_override": None},
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    feedback_id = uuid.UUID(resp.json()["feedback_id"])

    with Session(engine) as s:
        fb = s.get(Feedback, feedback_id)
        assert fb is not None
        assert fb.element_selector is None
        assert fb.element_xpath is None
        assert fb.element_bounding_box is None


def test_confirm_persists_user_agent_from_auto_context(client, engine) -> None:
    """Sprint D Phase 1 regression — user_agent shipped from the
    frontend in auto_context must (a) survive AutoContext pydantic
    validation (the pre-Sprint-D bug dropped it via extra='ignore'),
    (b) reach the LLM prompt block, and (c) persist on the feedback
    row's metadata_bundle so admin tooling can audit it."""
    sid = _seed_session(
        engine,
        user_id=_STAFF_USER_ID,
        synthesis_json={
            "title": "User-agent path",
            "summary": "regression check",
            "user_story": "Como user uso Chrome.",
            "context": "n/a",
            "user_need": "Que el admin vea mi UA.",
            "acceptance_criteria": [],
            "open_questions": [],
            "inferred": {"type": "bug", "severity": "minor"},
        },
        auto_context={
            "url": "https://example.com/edit",
            "route": "/edit",
            "app_version": "v1.2.3",
            "user_agent": "Mozilla/5.0 (Macintosh) ChromeTestUA/142.0",
        },
    )

    resp = client.post(
        f"/feedback/chat/sessions/{sid}/confirm",
        json={"synthesis_override": None},
        headers=AUTH_STAFF,
    )

    assert resp.status_code == 200, resp.text
    feedback_id = uuid.UUID(resp.json()["feedback_id"])

    with Session(engine) as s:
        fb = s.get(Feedback, feedback_id)
        assert fb is not None
        # user_agent ends up in metadata_bundle (auto_context is the
        # source). The dedicated feedback.user_agent column is only
        # populated by the legacy multipart flow, so we check the
        # bundle copy.
        bundle = fb.metadata_bundle or {}
        assert "ChromeTestUA" in str(bundle.get("user_agent") or "")
