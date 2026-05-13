"""FastAPI router for chat-first feedback capture (v1.0.0).

Endpoints currently mounted:

* ``POST /chat/sessions``                          — create session, return greeting
* ``GET  /chat/sessions/in-progress``              — list user's in_progress sessions
* ``GET  /chat/sessions/{session_id}``             — full detail of a session (S3C resume)
* ``POST /chat/sessions/{session_id}/messages``    — SSE stream of one LLM turn (S2 Batch B)

Future slices add:

* S4: ``POST /chat/sessions/{sid}/voice``
* S5: ``POST /chat/sessions/{sid}/confirm`` + ``/abandon``
"""

# NOTE: deliberately not using `from __future__ import annotations` so that
# the SSE endpoint's typed signature (StreamingResponse return) resolves
# eagerly under FastAPI's OpenAPI generator, matching the iter_router
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
    Depends,
    Header,
    HTTPException,
    Request,
    status,
)
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from feedback_widget.auth import CurrentUserSnapshot
from feedback_widget.chat_models import FeedbackChatSession
from feedback_widget.chat_schemas import (
    ChatMessageRequest,
    ChatSessionDetailResponse,
    CreateChatSessionRequest,
    CreateChatSessionResponse,
    InProgressSessionsResponse,
)
from feedback_widget.chat_service import ChatService
from feedback_widget.deps import WidgetDependencies
from feedback_widget.iter_llm import build_provider
from feedback_widget.iter_llm.protocol import LLMAttachment, LLMProvider
from feedback_widget.models import FeedbackAttachment
from feedback_widget.settings import FeedbackSettings
from feedback_widget.storage import StorageBackend

logger = logging.getLogger(__name__)

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


def _load_screenshot_attachment(
    *,
    db: Session,
    storage: StorageBackend,
    chat_session: FeedbackChatSession,
) -> LLMAttachment | None:
    """Resolve the screenshot attachment from ``auto_context``, if any.

    Failures (missing row, S3 down, bad bytes) are logged and swallowed —
    the chat stream MUST NOT break because the screenshot is unreachable.
    Per slice constraints: "Storage download failure for screenshot must
    NOT block the stream — log and proceed without the image."
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
        logger.info("chat screenshot attachment %s not found; skipping", att_id)
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

        glossary_raw = row.glossary_snapshot
        glossary: dict[str, str] | None
        if isinstance(glossary_raw, dict):
            glossary = {
                str(k): str(v) for k, v in glossary_raw.items() if isinstance(v, str)
            }
        else:
            glossary = None
        brand = settings.BRAND_NAME
        forbidden_words = [
            w.strip()
            for w in (settings.ITER_FORBIDDEN_WORDS or "").split(",")
            if w.strip()
        ]
        screenshot = _load_screenshot_attachment(
            db=db, storage=storage, chat_session=row
        )

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

    return router
