"""ChatService — S1 minimal surface + S2 run_turn streaming.

S1 implements ``start_session`` and ``list_in_progress``.

S2 Batch A adds :meth:`ChatService.run_turn` — an async generator
that orchestrates one LLM turn against the capture-mode prompt
(D-015). It accumulates streamed text, parses the strict JSON output
with a repair-hint loop, scrubs the assistant reply via
:mod:`iter_scrubber`, and persists the turn (and optional synthesis)
onto ``feedback_chat_session.messages`` / ``.synthesis_json``.

The SSE endpoint that adapts these events to ``text/event-stream``
ships in S2 Batch B; the service yields plain ``dict`` events to keep
it transport-agnostic and unit-testable.

This service uses the synchronous SQLModel ``Session`` per ADR-006
(sync engine paralelo en async hosts). DB writes inside ``run_turn``
hop through ``asyncio.to_thread`` so the event loop stays responsive
between LLM chunks — same discipline as ``iter_service.run_iteration``.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, col, select

from feedback_widget.chat_models import (
    ChatSessionMode,
    ChatSessionStatus,
    FeedbackChatSession,
)
from feedback_widget.chat_prompts import build_user_message
from feedback_widget.chat_schemas import (
    ChatSessionDetailResponse,
    CreateChatSessionRequest,
    CreateChatSessionResponse,
    InProgressSessionItem,
    InProgressSessionsResponse,
)
from feedback_widget.chat_turn_parser import (
    ChatTurnParseError,
    parse_with_repair,
)
from feedback_widget.iter_llm.protocol import (
    LLMAttachment,
    LLMProvider,
    LLMProviderError,
)
from feedback_widget.iter_scrubber import scrub_questions

GREETING_CAPTURE = "Cuéntame qué tienes en mente."
GREETING_REFINE = "Tienes este ticket. ¿Qué quieres ajustar?"

# UI cap for resume-prompt preview; matches D-014 "last message preview".
_PREVIEW_MAX_LEN = 80
# Resume UI shows only the most recent in_progress (D-014); cap defensively
# so a misbehaving client doesn't trigger an unbounded list scan.
_IN_PROGRESS_LIMIT = 10

# D-003 — hard turn cap + early-exit threshold on the model's
# self-reported coverage. The service layer enforces both.
_DEFAULT_MAX_TURNS = 5
_DEFAULT_COVERAGE_THRESHOLD = 0.7

# Per-turn LLM call budget — kept generous to absorb open-weight
# latency. The chat is conversational so we accept longer wait
# instead of timing out mid-stream and losing user context.
_TURN_REQUEST_TIMEOUT_SECONDS = 120
_TURN_MAX_OUTPUT_TOKENS = 2_000

logger = logging.getLogger(__name__)


class ChatService:
    """Stateful chat service — S1 surface only."""

    def start_session(
        self,
        *,
        session: Session,
        tenant_id: uuid.UUID | None,
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
            session=session, tenant_id=tenant_id, user_id=user_id
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
        tenant_id: uuid.UUID | None,
        user_id: uuid.UUID,
    ) -> InProgressSessionsResponse:
        """Return user's in_progress sessions in this tenant, newest first."""
        stmt = (
            select(FeedbackChatSession)
            .where(FeedbackChatSession.tenant_id == tenant_id)
            .where(FeedbackChatSession.user_id == user_id)
            .where(FeedbackChatSession.status == ChatSessionStatus.IN_PROGRESS)
            .order_by(col(FeedbackChatSession.updated_at).desc())
            .limit(_IN_PROGRESS_LIMIT)
        )
        rows = session.exec(stmt).all()
        items = [
            InProgressSessionItem(
                session_id=r.id,
                last_message_preview=_message_preview(r.messages),
                updated_at=r.updated_at,
                mode=r.mode.value,
            )
            for r in rows
        ]
        return InProgressSessionsResponse(sessions=items)

    def get_session_for_user(
        self,
        *,
        session: Session,
        tenant_id: uuid.UUID | None,
        user_id: uuid.UUID,
        chat_session_id: uuid.UUID,
    ) -> ChatSessionDetailResponse | None:
        """Return full detail of a chat session owned by ``user_id``.

        Returns ``None`` when the row does not exist OR when the
        ``(tenant_id, user_id)`` pair does not match — callers translate
        ``None`` into a 404 so existence does not leak across tenants.
        """
        row = session.get(FeedbackChatSession, chat_session_id)
        if row is None or row.user_id != user_id or row.tenant_id != tenant_id:
            return None
        return ChatSessionDetailResponse(
            session_id=row.id,
            mode=row.mode.value,
            status=row.status.value,
            messages=list(row.messages or []),
            synthesis_json=row.synthesis_json,
            auto_context=row.auto_context or {},
            updated_at=row.updated_at,
        )

    def _has_in_progress(
        self,
        *,
        session: Session,
        tenant_id: uuid.UUID | None,
        user_id: uuid.UUID,
    ) -> bool:
        # The status filter implicitly excludes the just-created OPEN row,
        # so no exclude_id is needed here.
        stmt = (
            select(FeedbackChatSession.id)
            .where(FeedbackChatSession.tenant_id == tenant_id)
            .where(FeedbackChatSession.user_id == user_id)
            .where(FeedbackChatSession.status == ChatSessionStatus.IN_PROGRESS)
            .limit(1)
        )
        return session.exec(stmt).first() is not None

    # ── S2 Batch A: run one chat turn ────────────────────────────────

    async def run_turn(
        self,
        *,
        session_db: Session,
        chat_session_id: uuid.UUID,
        user_content: str,
        provider: LLMProvider,
        glossary: dict[str, str] | None = None,
        brand: str = "Feedback",
        forbidden_words: list[str] | None = None,
        screenshot: LLMAttachment | None = None,
        max_turns: int = _DEFAULT_MAX_TURNS,
        coverage_threshold: float = _DEFAULT_COVERAGE_THRESHOLD,
    ) -> AsyncIterator[dict[str, Any]]:
        """Drive one chat turn end-to-end and yield events.

        Events emitted (in order):

        * ``{"type": "delta", "text": str}`` — streamed text chunks
          as the provider produces them.
        * ``{"type": "turn_done", "turn": dict}`` — parsed turn
          payload after JSON validation succeeds.
        * ``{"type": "synthesizing"}`` — emitted JUST BEFORE the
          synthesis is persisted, only when ``mode == "synthesize"``.
        * ``{"type": "synthesis", "data": dict}`` — the final
          synthesis JSON, only when ``mode == "synthesize"``.
        * ``{"type": "error", "detail": str}`` — provider / parse /
          state failure; the generator returns immediately after.

        State machine (see ``chat_models.ChatSessionStatus``):
        ``open`` or ``in_progress`` ⇒ ``in_progress`` after the
        assistant reply lands. On synthesize ⇒ ``synthesizing`` →
        ``awaiting_confirm`` after ``synthesis_json`` is stored.
        """
        # ── Pre-flight checks (sync; in the request thread) ─────────
        row = session_db.get(FeedbackChatSession, chat_session_id)
        if row is None:
            yield {"type": "error", "detail": f"chat session {chat_session_id} not found"}
            return
        if row.status in {
            ChatSessionStatus.CONFIRMED,
            ChatSessionStatus.ABANDONED,
        }:
            yield {
                "type": "error",
                "detail": f"chat session is {row.status.value}; no further turns allowed",
            }
            return

        # ── Append the new user turn to messages BEFORE prompt build
        # so the model sees its own context. JSONB columns need
        # flag_modified for SQLAlchemy to notice in-place edits.
        now_iso = datetime.now(UTC).isoformat()
        msgs: list[dict[str, Any]] = list(row.messages or [])
        msgs.append({"role": "user", "text": user_content, "ts": now_iso})

        # ── D-003 — force synthesize when budget exhausted or
        # coverage already crossed the threshold on a prior turn.
        prior_user_turns = sum(
            1 for m in msgs if isinstance(m, dict) and m.get("role") == "user"
        )
        prior_coverage_total = _last_coverage_total(msgs)
        force_synth = (
            prior_user_turns >= max_turns or prior_coverage_total >= coverage_threshold
        )

        prompt_messages = build_user_message(
            messages=msgs,
            auto_context=row.auto_context,
            glossary=glossary,
            brand=brand,
            screenshot=screenshot,
            force_synthesize=force_synth,
        )
        system_prompt = prompt_messages[0]["content"]
        user_payload_text = _serialise_user_payload(prompt_messages[1:])

        # ── Stream the model ─────────────────────────────────────────
        buffer: list[str] = []
        try:
            async for chunk in provider.stream(
                system_prompt=system_prompt,
                user_prompt=user_payload_text,
                attachments=[screenshot] if screenshot is not None else [],
                timeout_seconds=_TURN_REQUEST_TIMEOUT_SECONDS,
                max_output_tokens=_TURN_MAX_OUTPUT_TOKENS,
            ):
                buffer.append(chunk)
                yield {"type": "delta", "text": chunk}
        except LLMProviderError as exc:
            logger.warning("chat run_turn provider error: %s", exc)
            yield {
                "type": "error",
                "detail": f"{type(exc).__name__}: {exc}",
            }
            return
        raw_text = "".join(buffer)

        # ── Parse + repair-hint loop ─────────────────────────────────
        async def _retry_runner(repair_hint: str) -> str:
            result = await provider.generate(
                system_prompt=system_prompt,
                user_prompt=user_payload_text + repair_hint,
                attachments=[screenshot] if screenshot is not None else [],
                timeout_seconds=_TURN_REQUEST_TIMEOUT_SECONDS,
                max_output_tokens=_TURN_MAX_OUTPUT_TOKENS,
            )
            return result.raw_text

        try:
            parsed, _attempts = await parse_with_repair(
                raw_text,
                retry_runner=_retry_runner,
                max_retries=2,
            )
        except ChatTurnParseError as exc:
            logger.warning("chat run_turn parse failed: %s", exc.errors)
            yield {
                "type": "error",
                "detail": f"chat_parse_error: {'; '.join(exc.errors)[:1_000]}",
            }
            return

        # ── Scrub the assistant reply via iter_scrubber.scrub_questions.
        # The reply is a single string; the question-scrubbing path
        # operates on list[str] and applies forbidden-word density
        # + glossary rewrites in one pass. We treat the reply as a
        # one-element list to reuse the same logic.
        fw = forbidden_words or []
        scrubbed_reply = parsed["reply"]
        if fw:
            scrub_res = scrub_questions(
                [parsed["reply"]],
                forbidden_words=fw,
                glossary=glossary,
            )
            if scrub_res.kept:
                scrubbed_reply = scrub_res.kept[0]
            else:
                # The whole reply was dropped (density ≥ 50% jargon).
                # We keep the original text so the turn still has a
                # user-visible message, but log the scrub action.
                logger.warning(
                    "chat reply hit drop threshold; keeping original text but logging"
                )
        parsed_scrubbed = {**parsed, "reply": scrubbed_reply}

        # ── Persist assistant turn ───────────────────────────────────
        msgs.append(
            {
                "role": "assistant",
                "text": scrubbed_reply,
                "mode": parsed_scrubbed["mode"],
                "active_branch": parsed_scrubbed["active_branch"],
                "covered": parsed_scrubbed["covered"],
                "inferred": parsed_scrubbed["inferred"],
                "ts": datetime.now(UTC).isoformat(),
            }
        )
        is_synth = parsed_scrubbed["mode"] == "synthesize"

        def _persist() -> None:
            row.messages = msgs
            flag_modified(row, "messages")
            row.updated_at = datetime.now(UTC)
            if is_synth and isinstance(parsed_scrubbed["synthesis"], dict):
                row.synthesis_json = parsed_scrubbed["synthesis"]
                flag_modified(row, "synthesis_json")
                row.status = ChatSessionStatus.AWAITING_CONFIRM
            else:
                # First successful turn flips OPEN → IN_PROGRESS so
                # the resume-prompt list picks it up.
                if row.status == ChatSessionStatus.OPEN:
                    row.status = ChatSessionStatus.IN_PROGRESS
            session_db.add(row)
            session_db.commit()

        await asyncio.to_thread(_persist)

        yield {"type": "turn_done", "turn": parsed_scrubbed}
        if is_synth and isinstance(parsed_scrubbed["synthesis"], dict):
            yield {"type": "synthesizing"}
            yield {"type": "synthesis", "data": parsed_scrubbed["synthesis"]}


def _serialise_user_payload(turns: list[dict[str, Any]]) -> str:
    """Render the multi-turn user/assistant payload as one text blob.

    Provider adapters in this codebase accept a single ``user_prompt``
    string; for chat we serialise the conversation array as a tagged
    transcript so the model still sees prior turns. When/if Batch B
    extends :class:`LLMProvider` to accept a native messages list,
    this helper becomes a stub the new adapters can ignore.
    """
    lines: list[str] = []
    for t in turns:
        role = t.get("role", "user")
        content = t.get("content", "")
        if isinstance(content, list):
            # Multimodal turn — flatten the text parts; image bytes
            # go through the ``attachments`` channel separately.
            text_parts = [p.get("text", "") for p in content if isinstance(p, dict)]
            content = "\n".join(p for p in text_parts if p)
        lines.append(f"<{role}>\n{content}\n</{role}>")
    return "\n\n".join(lines)


def _last_coverage_total(messages: list[dict[str, Any]]) -> float:
    """Sum the 8 dimensions on the LAST assistant turn that carries
    a ``covered`` block. Returns 0.0 when no prior assistant turn has
    one — keeps the early-exit check side-effect-free on turn 1.
    """
    for msg in reversed(messages):
        if not isinstance(msg, dict):
            continue
        if msg.get("role") != "assistant":
            continue
        covered = msg.get("covered")
        if isinstance(covered, dict):
            return sum(
                float(v)
                for v in covered.values()
                if isinstance(v, int | float)
            )
    return 0.0


def _message_preview(messages: list[dict[str, Any]] | None) -> str | None:
    """Truncated preview of the last message text for resume-prompt UI.

    Defensive against non-dict items at messages[-1] — JSONB allows any
    shape, even though writes are schema-controlled in S2+.
    """
    if not messages:
        return None
    last = messages[-1]
    if not isinstance(last, dict):
        return None
    text = last.get("text", "")
    if not isinstance(text, str):
        return None
    return text[:_PREVIEW_MAX_LEN]
