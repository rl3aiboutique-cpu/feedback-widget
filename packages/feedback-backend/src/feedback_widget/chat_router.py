"""FastAPI router for chat-first feedback capture (v1.0.0).

Endpoints currently mounted:

* ``POST /chat/sessions``                          — create session, return greeting
* ``GET  /chat/sessions/in-progress``              — list user's in_progress sessions
* ``GET  /chat/sessions/{session_id}``             — full detail of a session (S3C resume)
* ``POST /chat/sessions/{session_id}/messages``    — SSE stream of one LLM turn
* ``POST /chat/sessions/{session_id}/confirm``     — create feedback row (S5)
* ``POST /chat/sessions/{session_id}/abandon``     — mark session abandoned (S5)

Future slices add:

* S4: ``POST /chat/sessions/{sid}/voice``
"""

# NOTE: deliberately not using `from __future__ import annotations` so that
# the SSE endpoint's typed signature (StreamingResponse return) resolves
# eagerly under FastAPI's OpenAPI generator — same
# discipline documented in deps.py.

import asyncio
import base64
import json
import logging
import time
import uuid
from collections.abc import AsyncIterator, Callable
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from feedback_widget.auth import CurrentUserSnapshot
from feedback_widget.chat_models import FeedbackChatSession
from feedback_widget.chat_schemas import (
    AbandonChatSessionResponse,
    ApproveSynthesisRequest,
    ChatMessageRequest,
    ChatSessionDetailResponse,
    ConfirmChatSessionRequest,
    ConfirmChatSessionResponse,
    CreateChatSessionRequest,
    CreateChatSessionResponse,
    EditSynthesisRequest,
    InProgressSessionsResponse,
    SynthesisCardResponse,
    VoiceTranscriptionResponse,
)
from feedback_widget.chat_service import (
    ChatService,
    ChatSessionMissingSynthesisError,
    ChatSessionNotFoundError,
    SynthesisAlreadyConfirmedError,
    SynthesisVersionNotFoundError,
)
from feedback_widget.email.render import build_feedback_email
from feedback_widget.exceptions import FeedbackRateLimitExceededError
from feedback_widget.helpers import enqueue_notification
from feedback_widget.models import Feedback as FeedbackModel
from feedback_widget.chat_whisper import (
    WhisperConfigError,
    WhisperTranscriptionError,
    transcribe_audio,
)
from feedback_widget.deps import WidgetDependencies
from feedback_widget.llm import build_provider
from feedback_widget.llm.protocol import LLMAttachment, LLMProvider
from feedback_widget.models import FeedbackAttachment
from feedback_widget.settings import FeedbackSettings
from feedback_widget.storage import StorageBackend

logger = logging.getLogger(__name__)

# S4 — voice transcription is hard-capped at 5MB (~30s opus). The browser
# enforces the 30s timer; the backend enforces the byte cap so a tampered
# client can't push a 50MB blob through the multipart parser.
_VOICE_MAX_BYTES = 5_000_000


# D-021: in-memory Idempotency-Key cache, 1h TTL.
# Process-local — worker-pinning at the load balancer level is the host's
# responsibility; replay is best-effort. Key = `Idempotency-Key` header,
# value = (insert_ts_epoch, list of byte chunks already streamed).
_IDEMPOTENCY_TTL_SECONDS = 3_600
_idempotency_cache: dict[str, tuple[float, list[bytes]]] = {}


def _prune_idempotency_cache(now: float) -> None:
    """Drop entries older than TTL. Called on every cache access so the
    cache size stays bounded without a background reaper thread."""
    cutoff = now - _IDEMPOTENCY_TTL_SECONDS
    stale = [k for k, (ts, _) in _idempotency_cache.items() if ts < cutoff]
    for k in stale:
        _idempotency_cache.pop(k, None)


def _format_sse_event(event_type: str, data: dict[str, Any]) -> bytes:
    """Render one SSE event in the wire format the iter router uses.

    Matches ``iter_sse.format_sse`` shape: ``event: <type>\\ndata: <json>\\n\\n``
    """
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event_type}\ndata: {payload}\n\n".encode()


def _marshal_chat_event(ev: dict[str, Any]) -> bytes:
    """Translate one ``ChatService.run_turn`` dict event to SSE bytes.

    The service yields events with shape::

        {"type": "delta", "text": "..."}
        {"type": "turn_done", "turn": {...}}
        {"type": "synthesizing"}
        {"type": "synthesis", "data": {...}}
        {"type": "error", "detail": "..."}

    The wire format mirrors what the frontend already consumes for the
    iter router: ``event:`` line names the type, ``data:`` carries the
    JSON payload minus the type field.
    """
    ev_type = str(ev.get("type", "message"))
    payload: dict[str, Any] = {k: v for k, v in ev.items() if k != "type"}
    if ev_type == "delta":
        # Normalise to {"text": "..."} regardless of upstream shape.
        payload = {"text": ev.get("text", "")}
    elif ev_type == "error":
        payload = {"detail": ev.get("detail", "")}
    return _format_sse_event(ev_type, payload)


def _decode_inline_screenshot(
    screenshot_b64: str | None, content_type: str | None
) -> LLMAttachment | None:
    """Build an LLMAttachment from a base64-encoded screenshot the
    frontend ships in the turn payload (Strategy A — fresh on every
    turn, no S3 round-trip).
    """
    if not screenshot_b64:
        return None
    try:
        # Validate by decoding once; the actual bytes ride re-encoded.
        base64.b64decode(screenshot_b64, validate=True)
    except (TypeError, ValueError):
        logger.warning("chat turn screenshot_b64 is not valid base64 — skipping")
        return None
    return LLMAttachment(
        kind="image",
        filename="page.png",
        mime_type=content_type or "image/png",
        bytes_b64=screenshot_b64,
    )


def _load_ticket_attachments(
    *,
    db: Session,
    storage: StorageBackend,
    chat_session: FeedbackChatSession,
    cap: int = 6,
) -> list[LLMAttachment]:
    """Load every ``feedback_attachment`` row for the ticket and turn
    them into multimodal :class:`LLMAttachment` objects (Strategy C —
    paperclip uploads from S9 reach the LLM on every turn).

    Failures per attachment are swallowed individually — the chat
    stream MUST NOT break because one S3 object is unreachable.
    Capped to ``cap`` to avoid blowing the context window when a user
    uploaded the maximum 5 + the auto screenshot.
    """
    from sqlmodel import select as _select

    rows = list(
        db.exec(
            _select(FeedbackAttachment)
            .where(FeedbackAttachment.ticket_id == chat_session.id)
            .order_by(FeedbackAttachment.created_at.asc())  # type: ignore[arg-type]
        ).all()
    )
    out: list[LLMAttachment] = []
    for row in rows[:cap]:
        try:
            blob = storage.download(row.object_key, bucket=row.bucket)
        except Exception:
            logger.warning(
                "chat ticket attachment download failed: bucket=%s key=%s",
                row.bucket,
                row.object_key,
            )
            continue
        ct = row.content_type or "application/octet-stream"
        kind: str
        if ct.startswith("image/"):
            kind = "image"
        elif ct == "application/pdf":
            kind = "pdf"
        else:
            kind = "text"
        out.append(
            LLMAttachment(
                kind=kind,  # type: ignore[arg-type]
                filename=row.filename or f"{row.id}",
                mime_type=ct,
                bytes_b64=base64.b64encode(blob).decode("ascii"),
            )
        )
    return out


def _load_screenshot_attachment(
    *,
    db: Session,
    storage: StorageBackend,
    chat_session: FeedbackChatSession,
) -> LLMAttachment | None:
    """Legacy single-screenshot loader kept for the confirm path —
    new chat turns use ``_decode_inline_screenshot`` +
    ``_load_ticket_attachments`` instead. Reads
    ``auto_context.screenshot_attachment_id`` and downloads from S3.
    """
    auto = chat_session.auto_context or {}
    raw_id = auto.get("screenshot_attachment_id")
    if not raw_id:
        return None
    try:
        att_id = uuid.UUID(str(raw_id))
    except (TypeError, ValueError):
        logger.warning("chat screenshot id is not a valid UUID: %r", raw_id)
        return None
    row = db.get(FeedbackAttachment, att_id)
    if row is None:
        return None
    try:
        blob = storage.download(row.object_key, bucket=row.bucket)
    except Exception:
        logger.exception("chat screenshot download failed: %s", row.object_key)
        return None
    return LLMAttachment(
        kind="image",
        filename=row.filename or f"{row.id}.png",
        mime_type=row.content_type or "image/png",
        bytes_b64=base64.b64encode(blob).decode("ascii"),
    )


def build_chat_router(
    *,
    deps: WidgetDependencies,
    service: ChatService,
    settings: FeedbackSettings,
    storage: StorageBackend,
    provider_factory: Callable[[], LLMProvider] | None = None,
) -> APIRouter:
    """Build the chat APIRouter factory closing over host deps + service.

    Parameters
    ----------
    provider_factory:
        Optional callable that returns a fresh :class:`LLMProvider` per
        request. When ``None``, the router builds one from settings via
        :func:`build_provider` — same path the iter router takes. Tests
        inject this seam to plug a scripted/canned chat provider.
    """
    router = APIRouter(tags=["feedback-chat"])

    SessionDep = Depends(deps.get_session)
    UserDep = Depends(deps.get_current_user)
    StorageDep = Depends(lambda: storage)
    SettingsDep = Depends(deps.get_settings)

    _provider_factory: Callable[[], LLMProvider] = (
        provider_factory if provider_factory is not None else (lambda: build_provider(settings))
    )

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

    @router.get(
        "/chat/sessions/{session_id}",
        response_model=ChatSessionDetailResponse,
    )
    def get_chat_session(
        session_id: uuid.UUID,
        user: CurrentUserSnapshot = UserDep,
        db: Session = SessionDep,
    ) -> ChatSessionDetailResponse:
        """Return full detail of a chat session owned by the caller.

        S3C — the frontend uses this to rebuild the timeline when a user
        clicks an in-progress entry in the "Conversaciones previas"
        header. Ownership is enforced server-side: a 404 is returned
        when the session does not exist or belongs to another
        ``(tenant_id, user_id)``.
        """
        detail = service.get_session_for_user(
            session=db,
            tenant_id=user.tenant_id,
            user_id=user.user_id,
            chat_session_id=session_id,
        )
        if detail is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="chat session not found",
            )
        return detail

    @router.post("/chat/sessions/{session_id}/messages")
    async def post_chat_message(
        session_id: uuid.UUID,
        payload: ChatMessageRequest,
        request: Request,
        idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
        user: CurrentUserSnapshot = UserDep,
        db: Session = SessionDep,
    ) -> StreamingResponse:
        """SSE stream of one chat turn's events.

        Emits ``delta`` / ``turn_done`` / ``synthesizing`` / ``synthesis``
        / ``error`` events as the underlying :meth:`ChatService.run_turn`
        async-generator produces them. Idempotency-Key replay is
        best-effort and process-local (D-021).
        """
        # Ownership check — 404 to avoid leaking session existence to
        # users from a different tenant / user_id.
        row = db.get(FeedbackChatSession, session_id)
        if (
            row is None
            or row.user_id != user.user_id
            or row.tenant_id != user.tenant_id
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="chat session not found",
            )

        # Replay path — if we have a fresh cached transcript, stream it
        # verbatim without touching the LLM or the DB.
        now = time.monotonic()
        _prune_idempotency_cache(now)
        if idempotency_key is not None:
            cached = _idempotency_cache.get(idempotency_key)
            if cached is not None:
                _ts, chunks = cached
                cached_chunks = list(chunks)

                async def _replay() -> AsyncIterator[bytes]:
                    for c in cached_chunks:
                        yield c

                return StreamingResponse(
                    _replay(),
                    media_type="text/event-stream",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                        "X-Accel-Buffering": "no",
                    },
                )

        # Build provider + ancillary inputs ONCE before the stream opens
        # so misconfiguration surfaces as a 503 instead of a half-open
        # SSE connection with a cryptic error event.
        try:
            provider = _provider_factory()
        except Exception as exc:
            logger.exception("chat provider build failed")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"LLM provider unavailable: {exc}",
            ) from exc

        # Persist the auto-captured screenshot as a SCREENSHOT
        # attachment on first turn so the ticket detail view + admin
        # tray always have visual context — without this, screenshots
        # only landed at approve_synthesis time, leaving every
        # awaiting-confirm or abandoned ticket visually blank in the
        # admin panel. Idempotent: skipped when one already exists.
        if payload.screenshot_b64:
            try:
                from sqlmodel import select as _select_screenshot

                from feedback_widget.models import (
                    FeedbackAttachment,
                    FeedbackAttachmentKind,
                )
                from feedback_widget.service import upload_feedback_attachment

                existing = db.exec(
                    _select_screenshot(FeedbackAttachment)
                    .where(FeedbackAttachment.ticket_id == session_id)
                    .where(
                        FeedbackAttachment.kind
                        == FeedbackAttachmentKind.SCREENSHOT
                    )
                    .limit(1)
                ).first()
                if existing is None:
                    import base64 as _b64

                    raw_bytes = _b64.b64decode(
                        payload.screenshot_b64, validate=True
                    )
                    cap = settings.MAX_SCREENSHOT_BYTES
                    if 0 < len(raw_bytes) <= cap:
                        upload_feedback_attachment(
                            db,
                            storage,
                            feedback_id=session_id,
                            tenant_id=row.tenant_id,
                            content=raw_bytes,
                            content_type=payload.screenshot_content_type
                            or "image/png",
                            filename=None,
                            kind=FeedbackAttachmentKind.SCREENSHOT,
                            width=None,
                            height=None,
                            settings=settings,
                        )
                        db.commit()
            except Exception:  # noqa: BLE001
                # Never let a screenshot-persist failure tank the
                # chat turn — the user still gets to send the message.
                logger.exception(
                    "chat turn: screenshot persist failed (session=%s)",
                    session_id,
                )

        # Glossary resolution order (Sprint B / capture_v3):
        #   1. session.glossary_snapshot — the dict captured when the
        #      session was created, frozen so mid-session env changes
        #      don't mutate the prompt mid-conversation.
        #   2. settings.glossary_dict — the host-supplied
        #      ``FEEDBACK_ITER_GLOSSARY`` env var. Provides the same
        #      vocabulary the iter-module already honours.
        #   3. None — prompt renders "(no glossary supplied)".
        glossary_raw = row.glossary_snapshot
        glossary: dict[str, str] | None
        if isinstance(glossary_raw, dict):
            glossary = {
                str(k): str(v) for k, v in glossary_raw.items() if isinstance(v, str)
            }
        elif settings.glossary_dict:
            glossary = dict(settings.glossary_dict)
        else:
            glossary = None
        brand = settings.BRAND_NAME
        forbidden_words = [
            w.strip()
            for w in (settings.ITER_FORBIDDEN_WORDS or "").split(",")
            if w.strip()
        ]
        # Multimodal payload assembly (2026-05-16 fix). Strategy A:
        # decode the inline screenshot the FE ships per turn (fresh
        # snapshot of what the user is looking at right now). Strategy
        # C: load every persisted ticket attachment (paperclip uploads
        # from S9) so the LLM sees user-supplied evidence too. Both
        # combine into a single attachments list passed to run_turn.
        attachments: list[LLMAttachment] = []
        inline_screenshot = _decode_inline_screenshot(
            payload.screenshot_b64, payload.screenshot_content_type
        )
        if inline_screenshot is not None:
            attachments.append(inline_screenshot)
        else:
            # Fallback to whatever the auto_context carries — usually
            # only after confirm; harmless during chat when None.
            legacy_shot = _load_screenshot_attachment(
                db=db, storage=storage, chat_session=row
            )
            if legacy_shot is not None:
                attachments.append(legacy_shot)
        attachments.extend(
            _load_ticket_attachments(db=db, storage=storage, chat_session=row)
        )
        # Pass the first attachment as ``screenshot`` for back-compat
        # with run_turn's signature; the rest ride along on a separate
        # kwarg the service exposes (added in this fix).
        screenshot = attachments[0] if attachments else None
        extra_attachments = attachments[1:]

        captured_chunks: list[bytes] = []

        async def event_source() -> AsyncIterator[bytes]:
            try:
                async for ev in service.run_turn(
                    session_db=db,
                    chat_session_id=session_id,
                    user_content=payload.content,
                    provider=provider,
                    glossary=glossary,
                    brand=brand,
                    forbidden_words=forbidden_words,
                    screenshot=screenshot,
                    extra_attachments=extra_attachments,
                ):
                    if await request.is_disconnected():
                        logger.info("chat SSE client disconnected mid-stream")
                        break
                    chunk = _marshal_chat_event(ev)
                    if idempotency_key is not None:
                        captured_chunks.append(chunk)
                    yield chunk
            except asyncio.CancelledError:
                # Client closed the stream; propagate.
                raise
            except Exception as exc:
                logger.exception("chat run_turn failed")
                err_chunk = _format_sse_event(
                    "error",
                    {"detail": f"{type(exc).__name__}: {exc}"},
                )
                if idempotency_key is not None:
                    captured_chunks.append(err_chunk)
                yield err_chunk
            finally:
                if idempotency_key is not None and captured_chunks:
                    _idempotency_cache[idempotency_key] = (
                        time.monotonic(),
                        captured_chunks,
                    )

        return StreamingResponse(
            event_source(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # ── S5: confirm / abandon ───────────────────────────────────────────

    @router.post(
        "/chat/sessions/{session_id}/confirm",
        response_model=ConfirmChatSessionResponse,
        status_code=status.HTTP_200_OK,
    )
    def confirm_chat_session(
        session_id: uuid.UUID,
        payload: ConfirmChatSessionRequest,
        background: BackgroundTasks,
        user: CurrentUserSnapshot = UserDep,
        db: Session = SessionDep,
    ) -> ConfirmChatSessionResponse:
        """Confirm a chat session — create the feedback row (D-006)."""
        try:
            feedback_id, ticket_code = service.confirm_session(
                session=db,
                chat_session_id=session_id,
                tenant_id=user.tenant_id,
                user_id=user.user_id,
                synthesis_override=payload.synthesis_override,
                settings=settings,
                storage=storage,
                screenshot_b64=payload.screenshot_b64,
                screenshot_content_type=payload.screenshot_content_type,
            )
        except ChatSessionNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="chat session not found",
            ) from exc
        except ChatSessionMissingSynthesisError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="chat session has no synthesis to confirm",
            ) from exc
        except FeedbackRateLimitExceededError as exc:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=str(exc),
                headers={"Retry-After": str(exc.retry_after_seconds)},
            ) from exc
        except Exception as exc:
            logger.exception("chat confirm failed: session=%s", session_id)
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"confirm failed: {type(exc).__name__}",
            ) from exc

        db.commit()
        logger.info(
            "chat session confirmed: user=%s tenant=%s session=%s feedback=%s ticket=%s",
            user.user_id,
            user.tenant_id,
            session_id,
            feedback_id,
            ticket_code,
        )

        # Email notification (paridad con legacy POST /feedback). If
        # Phase 5 produced a screenshot attachment, re-read its bytes
        # from storage and pass them inline so the admin email renders
        # the visual evidence — paridad final con la solución original.
        # No-op when FEEDBACK_NOTIFY_EMAILS is empty (early return
        # inside the helper). Failures here must NEVER block confirm.
        try:
            feedback_row = db.get(FeedbackModel, feedback_id)
            if feedback_row is not None:
                from sqlmodel import select as _select_attachment

                from feedback_widget.models import (
                    FeedbackAttachment,
                    FeedbackAttachmentKind,
                )

                screenshot_bytes: bytes | None = None
                screenshot_ct: str | None = None
                screenshot_row = db.exec(
                    _select_attachment(FeedbackAttachment)
                    .where(FeedbackAttachment.feedback_id == feedback_id)
                    .where(FeedbackAttachment.kind == FeedbackAttachmentKind.SCREENSHOT)
                ).first()
                if screenshot_row is not None:
                    try:
                        screenshot_bytes = storage.download(
                            screenshot_row.object_key,
                            bucket=screenshot_row.bucket,
                        )
                        screenshot_ct = screenshot_row.content_type
                    except Exception:
                        logger.exception(
                            "chat confirm: screenshot re-read failed (feedback=%s)",
                            feedback_id,
                        )

                subject, html, text_body = build_feedback_email(
                    feedback=feedback_row,
                    submitter_email=getattr(user, "email", None) or "(unknown)",
                    presigned_url=None,
                    extra_attachment_count=0,
                    settings=settings,
                )
                enqueue_notification(
                    background,
                    feedback_id=feedback_id,
                    feedback_snapshot_subject=subject,
                    html=html,
                    text=text_body,
                    screenshot_bytes=screenshot_bytes,
                    screenshot_content_type=screenshot_ct,
                    settings=settings,
                )
        except Exception:
            # Email enqueue must NEVER block confirm — log and swallow.
            logger.exception(
                "chat confirm email enqueue failed: feedback=%s", feedback_id
            )

        return ConfirmChatSessionResponse(
            feedback_id=feedback_id, ticket_code=ticket_code
        )

    # ── S5b: user soft-delete (2026-05-16 unification) ──────────────
    #
    # Mark the ticket as soft-deleted from the user's perspective. The
    # row stays in the DB so admin can review or restore it; the user's
    # ``list_mine`` query filters it out.

    @router.delete(
        "/chat/sessions/{session_id}",
        status_code=status.HTTP_204_NO_CONTENT,
    )
    def soft_delete_chat_session(
        session_id: uuid.UUID,
        user: CurrentUserSnapshot = UserDep,
        db: Session = SessionDep,
        storage_backend: StorageBackend = StorageDep,
        cfg: FeedbackSettings = SettingsDep,
    ) -> None:
        from feedback_widget.models import DeletedByRole
        from feedback_widget.service import FeedbackService

        feedback_service = FeedbackService(
            session=db,
            storage=storage_backend,
            tenant_id=user.tenant_id,
            settings=cfg,
        )
        # Ownership check first — ``get`` already validates tenant.
        try:
            row = feedback_service.get(session_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ticket not found",
            )
        if row.user_id != user.user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ticket not found",
            )
        feedback_service.soft_delete(
            feedback_id=session_id,
            current_user_id=user.user_id,
            role=DeletedByRole.USER,
        )
        db.commit()
        return None

    @router.post(
        "/chat/sessions/{session_id}/abandon",
        response_model=AbandonChatSessionResponse,
        status_code=status.HTTP_200_OK,
    )
    def abandon_chat_session(
        session_id: uuid.UUID,
        user: CurrentUserSnapshot = UserDep,
        db: Session = SessionDep,
    ) -> AbandonChatSessionResponse:
        """Mark a chat session abandoned. No body required."""
        try:
            service.abandon_session(
                session=db,
                chat_session_id=session_id,
                tenant_id=user.tenant_id,
                user_id=user.user_id,
            )
        except ChatSessionNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="chat session not found",
            ) from exc

        db.commit()
        logger.info(
            "chat session abandoned: user=%s tenant=%s session=%s",
            user.user_id,
            user.tenant_id,
            session_id,
        )
        return AbandonChatSessionResponse(ok=True)

    # ── Synthesis card lifecycle (approve / edit) ────────────────────────

    @router.post(
        "/chat/sessions/{session_id}/synthesis/{synthesis_ts}/approve",
        response_model=SynthesisCardResponse,
        status_code=status.HTTP_200_OK,
    )
    def approve_synthesis_version(
        session_id: uuid.UUID,
        synthesis_ts: str,
        payload: ApproveSynthesisRequest = ApproveSynthesisRequest(),  # noqa: B008
        user: CurrentUserSnapshot = UserDep,
        db: Session = SessionDep,
    ) -> SynthesisCardResponse:
        """Confirm one synthesis card as the winning version + finalise
        the ticket.

        Two-step transaction:
        1. ``approve_synthesis`` flips the ``confirmed`` flag on the chosen
           msg and copies its synthesis dict into ``synthesis_json``
           (one-winner invariant).
        2. ``confirm_session`` reads ``synthesis_json`` and populates the
           ticket header — title, description, type, severity, ticket_code,
           url, route, app_version, etc. — so admin queries see a fully
           structured row instead of an awaiting_confirm chat shell.

        Both steps run inside a single ``db.commit()`` so the ticket
        either gets ALL the metadata or none — no partially-confirmed
        rows. ChatSessionMissingSynthesisError is caught defensively but
        cannot happen because approve_synthesis just wrote synthesis_json.
        """
        try:
            winner = service.approve_synthesis(
                session=db,
                chat_session_id=session_id,
                tenant_id=user.tenant_id,
                user_id=user.user_id,
                synthesis_ts=synthesis_ts,
            )
            # Finalise ticket metadata from the approved synthesis. This
            # is what gives the row a ticket_code + title + type +
            # severity that the admin queue can sort and filter on.
            # ``screenshot_b64`` (optional) gets persisted as a
            # ``kind=SCREENSHOT`` attachment so the detail view has
            # visual context — without this, reopening a ticket shows
            # no screenshot even though the FE captured one at session
            # start.
            service.confirm_session(
                session=db,
                chat_session_id=session_id,
                tenant_id=user.tenant_id,
                user_id=user.user_id,
                settings=settings,
                storage=storage,
                screenshot_b64=payload.screenshot_b64,
                screenshot_content_type=payload.screenshot_content_type,
            )
        except ChatSessionNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="chat session not found",
            ) from exc
        except SynthesisVersionNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="synthesis version not found",
            ) from exc
        except ChatSessionMissingSynthesisError as exc:
            # Defensive — approve_synthesis just wrote synthesis_json so
            # this branch should be unreachable. Logged to catch any
            # future race where the two steps drift apart.
            logger.error(
                "approve+confirm raced: synthesis_json missing after approve "
                "(session=%s ts=%s)",
                session_id,
                synthesis_ts,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="approve raced with synthesis write",
            ) from exc

        db.commit()
        logger.info(
            "synthesis approved + ticket finalised: user=%s session=%s ts=%s",
            user.user_id,
            session_id,
            synthesis_ts,
        )
        return SynthesisCardResponse(
            ts=str(winner.get("ts")),
            confirmed=bool(winner.get("confirmed")),
            synthesis=dict(winner.get("synthesis") or {}),
        )

    @router.patch(
        "/chat/sessions/{session_id}/synthesis/{synthesis_ts}",
        response_model=SynthesisCardResponse,
        status_code=status.HTTP_200_OK,
    )
    def edit_synthesis_version(
        session_id: uuid.UUID,
        synthesis_ts: str,
        payload: EditSynthesisRequest,
        user: CurrentUserSnapshot = UserDep,
        db: Session = SessionDep,
    ) -> SynthesisCardResponse:
        """Apply a manual edit to one synthesis card.

        Only allowed fields land. Editing does NOT auto-approve. Edits to
        a non-confirmed version are rejected once a different version has
        already been confirmed (the ticket has a winner — close it before
        re-iterating).
        """
        try:
            target = service.edit_synthesis(
                session=db,
                chat_session_id=session_id,
                tenant_id=user.tenant_id,
                user_id=user.user_id,
                synthesis_ts=synthesis_ts,
                patch=payload.model_dump(exclude_unset=True),
            )
        except ChatSessionNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="chat session not found",
            ) from exc
        except SynthesisVersionNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="synthesis version not found",
            ) from exc
        except SynthesisAlreadyConfirmedError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="another synthesis version is already confirmed",
            ) from exc

        db.commit()
        return SynthesisCardResponse(
            ts=str(target.get("ts")),
            confirmed=bool(target.get("confirmed")),
            synthesis=dict(target.get("synthesis") or {}),
        )

    # ── S4: voice transcription (Whisper proxy) ──────────────────────────

    @router.post(
        "/chat/sessions/{session_id}/voice",
        response_model=VoiceTranscriptionResponse,
        status_code=status.HTTP_200_OK,
    )
    async def transcribe_chat_voice(
        session_id: uuid.UUID,
        audio: UploadFile = File(...),
        language_hint: Annotated[str | None, Form()] = None,
        user: CurrentUserSnapshot = UserDep,
        db: Session = SessionDep,
    ) -> VoiceTranscriptionResponse:
        """Transcribe a voice clip via OpenAI Whisper (D-004 + D-005 + D-009).

        Multipart body fields:

        - ``audio``  — the recorded clip (opus/webm or mp4). Read once,
          handed to Whisper, then discarded (D-013).
        - ``language_hint`` (optional) — ISO-639-1 to bias detection.

        Returns ``{transcript, lang}``. Errors:

        - 404 when the session is not owned by the caller
        - 413 when the upload exceeds 5MB (~30s opus, browser cap is 30s
          hard-stop so larger means tampered client)
        - 503 when ``FEEDBACK_ITER_OPENAI_API_KEY`` is unset / openai SDK
          missing — the frontend falls back to text-only mode
        - 502 when Whisper itself errors (network blip, bad audio, etc.)
        """
        # Ownership check — 404 to avoid leaking session existence.
        row = db.get(FeedbackChatSession, session_id)
        if (
            row is None
            or row.user_id != user.user_id
            or row.tenant_id != user.tenant_id
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="chat session not found",
            )

        # Read the whole upload into memory. 5MB cap means we don't risk
        # blowing the worker — bigger files are rejected before the SDK
        # call. We avoid streaming because Whisper's SDK wants a seekable
        # file-like with a known size anyway.
        audio_bytes = await audio.read()
        if len(audio_bytes) > _VOICE_MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"audio too large ({len(audio_bytes)} bytes); "
                    f"max {_VOICE_MAX_BYTES} (~30s opus)."
                ),
            )

        glossary_raw = row.glossary_snapshot
        glossary: dict[str, str] | None
        if isinstance(glossary_raw, dict):
            glossary = {
                str(k): str(v)
                for k, v in glossary_raw.items()
                if isinstance(v, str)
            }
        else:
            glossary = None

        content_type = audio.content_type or "audio/webm"
        # Pick a filename Whisper recognises by extension. The browser
        # rarely sets one, so we derive from the MIME type.
        if "mp4" in content_type or "m4a" in content_type:
            filename = "audio.m4a"
        elif "ogg" in content_type:
            filename = "audio.ogg"
        elif "wav" in content_type:
            filename = "audio.wav"
        else:
            filename = "audio.webm"

        try:
            result = await transcribe_audio(
                audio_bytes,
                content_type=content_type,
                filename=filename,
                language_hint=language_hint,
                glossary=glossary,
                settings=settings,
            )
        except WhisperConfigError as exc:
            logger.warning("voice transcription unavailable: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc
        except WhisperTranscriptionError as exc:
            logger.exception("whisper transcription failed: session=%s", session_id)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(exc),
            ) from exc
        finally:
            # D-013: explicitly drop bytes reference so no caller holds
            # the audio after the request handler returns.
            del audio_bytes

        # Persist the detected language on the session so subsequent LLM
        # turns receive the hint (D-009). Best-effort: missing lang is
        # not fatal.
        if result.lang:
            row.detected_language = result.lang[:8]
            db.add(row)
            db.commit()

        logger.info(
            "chat voice transcribed: user=%s tenant=%s session=%s lang=%s chars=%d",
            user.user_id,
            user.tenant_id,
            session_id,
            result.lang,
            len(result.transcript),
        )
        return VoiceTranscriptionResponse(
            transcript=result.transcript,
            lang=result.lang,
        )

    # ── S9: chat-session attachments (pre-confirm uploads) ──────────────
    #
    # The user can attach images / PDFs / text / log files DURING the
    # chat — without waiting for the confirm step. Reuses the legacy
    # validator (``helpers.read_attachments``) so the size cap, MIME
    # allowlist, and magic-byte sniff are identical to the multipart
    # path. One file per request keeps the UX granular (FE can show a
    # progress bar per file and cancel cleanly).

    @router.post("/chat/sessions/{session_id}/attachments")
    async def upload_chat_attachment(
        session_id: uuid.UUID,
        file: UploadFile = File(...),
        user: CurrentUserSnapshot = UserDep,
        db: Session = SessionDep,
        storage_backend: StorageBackend = StorageDep,
        cfg: FeedbackSettings = SettingsDep,
    ) -> dict[str, object]:
        from sqlmodel import select as _select

        from feedback_widget.helpers import MAX_USER_ATTACHMENTS, read_attachments
        from feedback_widget.models import (
            FeedbackAttachment,
            FeedbackAttachmentKind,
        )
        from feedback_widget.service import upload_feedback_attachment

        # 1. Resolve ticket + ownership check (404-shaped to avoid
        #    leaking the existence of someone else's id).
        ticket = db.get(FeedbackChatSession, session_id)
        if ticket is None or ticket.user_id != user.user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="ticket not found"
            )
        if ticket.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="ticket not found"
            )

        # 2. Count enforcement BEFORE reading the upload — cheap fail.
        existing_count = db.exec(
            _select(FeedbackAttachment).where(
                FeedbackAttachment.ticket_id == session_id,
                FeedbackAttachment.kind == FeedbackAttachmentKind.USER_ATTACHMENT,
            )
        ).all()
        if len(existing_count) >= MAX_USER_ATTACHMENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"This ticket already has {MAX_USER_ATTACHMENTS} attachments — "
                    "remove one before adding another."
                ),
            )

        # 3. Reuse the legacy validator (size cap, MIME allowlist, magic
        #    bytes, sanitized filename). It accepts a list; we pass one.
        validated = await read_attachments([file], settings=cfg)
        if not validated:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file uploaded.",
            )
        upload = validated[0]

        # 4. Upload to S3 + create the FeedbackAttachment row.
        row = upload_feedback_attachment(
            db,
            storage_backend,
            feedback_id=session_id,  # ticket_id under the unified schema
            tenant_id=ticket.tenant_id,
            content=upload.content,
            content_type=upload.content_type,
            filename=upload.filename,
            kind=FeedbackAttachmentKind.USER_ATTACHMENT,
            width=None,
            height=None,
            settings=cfg,
        )
        db.commit()
        db.refresh(row)

        return {
            "id": str(row.id),
            "ticket_id": str(row.ticket_id),
            "kind": row.kind.value,
            "filename": row.filename,
            "content_type": row.content_type,
            "byte_size": row.byte_size,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }

    @router.delete(
        "/chat/sessions/{session_id}/attachments/{attachment_id}",
        status_code=status.HTTP_204_NO_CONTENT,
    )
    def delete_chat_attachment(
        session_id: uuid.UUID,
        attachment_id: uuid.UUID,
        user: CurrentUserSnapshot = UserDep,
        db: Session = SessionDep,
        storage_backend: StorageBackend = StorageDep,
    ) -> None:
        from feedback_widget.models import FeedbackAttachment

        ticket = db.get(FeedbackChatSession, session_id)
        if ticket is None or ticket.user_id != user.user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="ticket not found"
            )
        att = db.get(FeedbackAttachment, attachment_id)
        if att is None or att.ticket_id != session_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="attachment not found"
            )
        # Best-effort S3 cleanup; DB row goes regardless.
        try:
            storage_backend.delete(att.object_key, bucket=att.bucket)
        except Exception:  # noqa: BLE001
            logger.warning(
                "chat attachment S3 delete failed: bucket=%s key=%s",
                att.bucket,
                att.object_key,
            )
        db.delete(att)
        db.commit()
        return None

    return router
