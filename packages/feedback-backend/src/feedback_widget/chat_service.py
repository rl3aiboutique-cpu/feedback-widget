"""ChatService — S1 minimal surface + S2 run_turn streaming.

S1 implements ``start_session`` and ``list_in_progress``.

S2 Batch A adds :meth:`ChatService.run_turn` — an async generator
that orchestrates one LLM turn against the capture-mode prompt
(D-015). It accumulates streamed text, parses the strict JSON output
with a repair-hint loop, scrubs the assistant reply via
:mod:`iter_scrubber`, and persists the turn (and optional synthesis)
onto ``feedback_chat_session.messages`` / ``.synthesis_json``.

The SSE endpoint that adapts these events to ``text/event-stream``
ships in chat_router; the service yields plain ``dict`` events to keep
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
    ChatCallStatus,
    ChatSessionMode,
    ChatSessionStatus,
    FeedbackChatCall,
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
from feedback_widget.llm.protocol import (
    LLMAttachment,
    LLMProvider,
    LLMProviderError,
)
from feedback_widget.scrubber import scrub_questions
from feedback_widget.models import (
    Feedback,
    FeedbackAttachment,
    FeedbackAttachmentKind,
    FeedbackSeverity,
    FeedbackStatus,
    FeedbackType,
)
from feedback_widget.redaction import redact_bundle, redact_string
from feedback_widget.service import (
    check_user_rate_limit,
    generate_ticket_code,
    upload_feedback_attachment,
)
from feedback_widget.settings import FeedbackSettings, get_settings
from feedback_widget.storage import StorageBackend

GREETING_CAPTURE = "Tell me what's on your mind."
GREETING_REFINE = "Here's your ticket. What would you like to adjust?"


def _build_attachments_list(
    screenshot: LLMAttachment | None,
    extras: list[LLMAttachment] | None,
) -> list[LLMAttachment]:
    """Concat the per-turn screenshot + the persisted ticket
    attachments into the single list every provider expects.

    Helper exists to avoid sprinkling ``[screenshot] if screenshot
    else []`` + extend logic across the retry / generate / stream
    paths — keeping the same payload shape in all three keeps the
    LLM seeing the same evidence regardless of which path serves the
    turn.
    """
    out: list[LLMAttachment] = []
    if screenshot is not None:
        out.append(screenshot)
    if extras:
        out.extend(extras)
    return out

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

# Confirm flow caps — mirror the Feedback model column limits so the
# DB INSERT never trips a constraint when the synthesis title or URL
# overflow the legacy form caps.
_FEEDBACK_TITLE_MAX = 200
_FEEDBACK_URL_MAX = 2048
_FEEDBACK_ROUTE_MAX = 200
# Bounded retry budget for the per-tenant ``ticket_code`` UNIQUE
# collision — mirrors FeedbackService.create's loop.
_TICKET_CODE_RETRIES = 3

logger = logging.getLogger(__name__)


class ChatSessionNotFoundError(Exception):
    """Caller does not own the requested chat session, or it does not exist."""


class ChatSessionMissingSynthesisError(Exception):
    """Confirm called on a session whose ``synthesis_json`` is NULL."""


class SynthesisVersionNotFoundError(Exception):
    """No synthesis message in ``messages`` matches the requested ts."""


class SynthesisAlreadyConfirmedError(Exception):
    """A different synthesis version is already confirmed in this chat."""


# Editable fields when the user manually tweaks a synthesis card
# (capture-side correction). The remaining synthesis keys (personas,
# diagram, etc.) stay locked to keep the UX small and avoid round-trips
# that grow the JSON payload past the 5KB cap. Lists arrive as
# already-split `list[str]`; the route layer is responsible for
# splitting newline-separated textareas before calling.
_SYNTHESIS_EDITABLE_FIELDS: frozenset[str] = frozenset(
    {"title", "summary", "user_story", "acceptance_criteria"}
)
# Per-field caps mirror the backing column widths in
# ``feedback_widget.feedback`` so a synthesis edit can still confirm
# without tripping the create-feedback validators downstream.
_SYNTHESIS_FIELD_CAPS: dict[str, int] = {
    "title": 200,
    "summary": 4000,
    "user_story": 4000,
}


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
        extra_attachments: list[LLMAttachment] | None = None,
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
        if row.deleted_at is not None:
            yield {"type": "error", "detail": "ticket has been deleted"}
            return
        # S7 (grilled 2026-05-16, 6A=C): terminal ticket statuses block
        # new turns. ABANDONED chat sessions also block (user discarded
        # the conversation). A CONFIRMED chat session is allowed to
        # continue iterating — that's exactly the user × admin × LLM
        # loop the target asks for, kicked off by admin injection.
        if row.status == ChatSessionStatus.ABANDONED:
            yield {
                "type": "error",
                "detail": "chat session is abandoned; no further turns allowed",
            }
            return
        if row.ticket_status is not None and row.ticket_status.is_terminal:
            yield {
                "type": "error",
                "detail": f"ticket is {row.ticket_status.value}; no further turns allowed",
            }
            return

        # ── Append the new user turn to messages BEFORE prompt build
        # so the model sees its own context. JSONB columns need
        # flag_modified for SQLAlchemy to notice in-place edits.
        now = datetime.now(UTC)
        now_iso = now.isoformat()
        msgs: list[dict[str, Any]] = list(row.messages or [])
        msgs.append({"role": "user", "text": user_content, "ts": now_iso})

        # S7 (grilled 2026-05-16, 6B=B): a user turn after admin
        # injection auto-flips the ticket back to in_review so the
        # admin queue surfaces the reply naturally. The user-side
        # ``user_action_required`` badge clears in the same step.
        row.last_user_msg_at = now
        if row.user_action_required:
            row.user_action_required = False
            if row.ticket_status == FeedbackStatus.WAITING_FOR_USER:
                row.ticket_status = FeedbackStatus.IN_REVIEW

        # ── D-003 — force synthesize when budget exhausted or
        # coverage already crossed the threshold on a prior turn.
        prior_user_turns = sum(
            1 for m in msgs if isinstance(m, dict) and m.get("role") == "user"
        )
        prior_coverage_total = _last_coverage_total(msgs)
        force_synth = (
            prior_user_turns >= max_turns or prior_coverage_total >= coverage_threshold
        )

        # Sprint B / capture_v3: pass the detected language so the LLM
        # replies in the user's tongue. Falls back to "the user's
        # language" when None (turn 1, before any utterance).
        prompt_messages = build_user_message(
            messages=msgs,
            auto_context=row.auto_context,
            glossary=glossary,
            brand=brand,
            language=row.detected_language,
            screenshot=screenshot,
            force_synthesize=force_synth,
        )
        system_prompt = prompt_messages[0]["content"]
        user_payload_text = _serialise_user_payload(prompt_messages[1:])

        # Sprint C — audit trail. Hash the system + user payload so admin
        # tooling can correlate behaviour across prompt revisions, time
        # the round-trip, and record the outcome status. The row is
        # appended after the stream/parse/scrub pipeline regardless of
        # success or failure so every attempted call is observable.
        import hashlib
        import time

        from feedback_widget.chat_prompts.capture_prompt import (
            CAPTURE_SYSTEM_PROMPT_VERSION,
        )

        prompt_sha256 = hashlib.sha256(
            (system_prompt + "\x00" + user_payload_text).encode("utf-8")
        ).hexdigest()
        call_started_at = time.perf_counter()
        call_attempt = 1

        def _persist_chat_call(
            *,
            status: ChatCallStatus,
            attempt_number: int,
            error_message: str | None = None,
        ) -> None:
            latency_ms = int((time.perf_counter() - call_started_at) * 1000)
            # Harvest real token usage from the provider's streaming
            # adapter. Falls back to zero when the provider cannot
            # report (legacy stream paths) so existing rows never
            # break — drift detection is the nightly job's problem.
            usage = None
            harvester = getattr(provider, "last_stream_usage", None)
            if callable(harvester):
                try:
                    usage = harvester()
                except Exception:  # noqa: BLE001
                    usage = None
            input_tokens = int(getattr(usage, "input_tokens", 0) or 0) if usage else 0
            output_tokens = int(getattr(usage, "output_tokens", 0) or 0) if usage else 0

            model_id = (
                getattr(provider, "current_model", None)
                or getattr(provider, "name", None)
                or "unknown"
            )
            model_provider_slug = getattr(provider, "name", None) or "unknown"

            cost_usd: float | None = None
            estimator = getattr(provider, "estimate_cost_usd", None)
            if callable(estimator) and usage is not None:
                try:
                    cost_usd = estimator(usage)
                except Exception:  # noqa: BLE001
                    cost_usd = None

            row_call = FeedbackChatCall(
                ticket_id=row.id,
                tenant_id=row.tenant_id,
                turn_index=prior_user_turns,
                model_id=model_id,
                model_provider=model_provider_slug,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost_usd,
                latency_ms=latency_ms,
                status=status,
                attempt_number=attempt_number,
                error_message=error_message,
                prompt_sha256=prompt_sha256,
                prompt_version=CAPTURE_SYSTEM_PROMPT_VERSION,
            )
            session_db.add(row_call)

            # Denormalize the running totals + recompute context
            # occupancy so the ticket UI bar reads in O(1).
            row.total_input_tokens = (row.total_input_tokens or 0) + input_tokens
            row.total_output_tokens = (row.total_output_tokens or 0) + output_tokens
            try:
                from feedback_widget.llm.limits import compute_usage_pct

                row.context_usage_pct = compute_usage_pct(
                    row.total_input_tokens,
                    row.total_output_tokens,
                    model_id,
                )
            except Exception:  # noqa: BLE001
                pass
            row.model_id_pinned = model_id
            row.model_provider = model_provider_slug
            session_db.add(row)
            session_db.commit()

        # ── Stream the model ─────────────────────────────────────────
        buffer: list[str] = []
        try:
            async for chunk in provider.stream(
                system_prompt=system_prompt,
                user_prompt=user_payload_text,
                attachments=_build_attachments_list(screenshot, extra_attachments),
                timeout_seconds=_TURN_REQUEST_TIMEOUT_SECONDS,
                max_output_tokens=_TURN_MAX_OUTPUT_TOKENS,
            ):
                buffer.append(chunk)
                yield {"type": "delta", "text": chunk}
        except LLMProviderError as exc:
            logger.warning("chat run_turn provider error: %s", exc)
            await asyncio.to_thread(
                _persist_chat_call,
                status=ChatCallStatus.PROVIDER_ERROR,
                attempt_number=call_attempt,
                error_message=f"{type(exc).__name__}: {exc}"[:1000],
            )
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
                attachments=_build_attachments_list(screenshot, extra_attachments),
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
            call_attempt = max(1, _attempts)
        except ChatTurnParseError as exc:
            logger.warning("chat run_turn parse failed: %s", exc.errors)
            await asyncio.to_thread(
                _persist_chat_call,
                status=ChatCallStatus.JSON_INVALID,
                attempt_number=call_attempt + 1,
                error_message=("; ".join(exc.errors))[:1000],
            )
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
        synthesis_ts: str | None = None
        if is_synth and isinstance(parsed_scrubbed["synthesis"], dict):
            # The synthesis becomes its own chat message so the timeline
            # keeps every iteration as a bubble (user can compare versions
            # and only one ends up confirmed). The legacy ``synthesis_json``
            # column stores the latest emit; ``confirmed`` flag on the msg
            # marks the winning version after explicit approve.
            synthesis_ts = datetime.now(UTC).isoformat()
            msgs.append(
                {
                    "role": "synthesis",
                    "ts": synthesis_ts,
                    "synthesis": parsed_scrubbed["synthesis"],
                    "confirmed": False,
                }
            )

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
        await asyncio.to_thread(
            _persist_chat_call,
            status=ChatCallStatus.SUCCESS,
            attempt_number=call_attempt,
        )

        yield {"type": "turn_done", "turn": parsed_scrubbed}
        if is_synth and isinstance(parsed_scrubbed["synthesis"], dict):
            yield {"type": "synthesizing"}
            # ``ts`` is the canonical id the approve / edit endpoints
            # use to locate the synthesis msg in ``messages`` JSONB.
            # Without it the FE generates its own ts client-side, which
            # never matches what was persisted → POST .../approve 404s.
            yield {
                "type": "synthesis",
                "ts": synthesis_ts,
                "data": parsed_scrubbed["synthesis"],
            }

    # ── S5: confirm / abandon ──────────────────────────────────────────

    def confirm_session(
        self,
        *,
        session: Session,
        chat_session_id: uuid.UUID,
        tenant_id: uuid.UUID | None,
        user_id: uuid.UUID,
        synthesis_override: dict[str, Any] | None = None,
        settings: FeedbackSettings | None = None,
        storage: StorageBackend | None = None,
        screenshot_b64: str | None = None,
        screenshot_content_type: str | None = None,
    ) -> tuple[uuid.UUID, str]:
        """Confirm a chat session — create the ``feedback`` row (D-006).

        The synthesis is taken from ``synthesis_override`` when present,
        otherwise from ``feedback_chat_session.synthesis_json``. The
        feedback row mirrors ``user_id`` / ``tenant_id`` from the chat
        session so admin views and the row's RLS line up.

        Returns ``(feedback_id, ticket_code)``. Does NOT commit — the
        caller commits so the chat-session update and feedback insert
        land atomically.

        Raises:
            ChatSessionNotFoundError — session missing or not owned.
            ChatSessionMissingSynthesisError — no synthesis available.
        """
        chat_row = session.get(FeedbackChatSession, chat_session_id)
        if (
            chat_row is None
            or chat_row.user_id != user_id
            or chat_row.tenant_id != tenant_id
        ):
            raise ChatSessionNotFoundError(str(chat_session_id))

        synthesis = (
            synthesis_override
            if synthesis_override is not None
            else chat_row.synthesis_json
        )
        if not isinstance(synthesis, dict) or not synthesis:
            raise ChatSessionMissingSynthesisError(str(chat_session_id))

        # Rate limit (paridad con legacy POST /feedback). The unit
        # rate-limited is "feedback row created" — chat sessions that
        # never reach confirm cost nothing. Raise BEFORE any write so
        # the chat session stays AWAITING_CONFIRM and the caller can
        # retry once the window slides.
        resolved_settings = settings or get_settings()
        check_user_rate_limit(
            session,
            user_id=user_id,
            tenant_id=tenant_id,
            settings=resolved_settings,
        )

        # tenant_id on the Feedback Python model is typed required but
        # the DB column is nullable (migration 0001) — single-tenant
        # hosts (sapphira) run with NULL tenant. The legacy multipart
        # service.create() takes ``tenant_id: uuid.UUID`` yet passes
        # through ``current_user.tenant_id`` which CAN be None; we keep
        # the same shape so the runtime behaviour matches.
        feedback_tenant: uuid.UUID | None = tenant_id

        # Derive feedback fields from the synthesis dict. Be defensive —
        # the LLM may omit any of these; fall back to safe defaults so
        # the row can still be inserted.
        title_raw = str(synthesis.get("title") or "Feedback sin título")
        summary = str(synthesis.get("summary") or "").strip()
        user_story = str(synthesis.get("user_story") or "").strip()
        user_need = synthesis.get("user_need")
        description_raw = (
            "\n\n".join(part for part in (summary, user_story) if part)
            or "(synthesis sin contenido)"
        )
        expected_outcome_raw = (
            str(user_need).strip() if isinstance(user_need, str) and user_need.strip() else None
        )

        # Server-side redaction (defence-in-depth) — parity with the
        # legacy multipart path (service.FeedbackService.create). The
        # LLM may echo back JWTs / bearer tokens / cookies that the user
        # pasted in chat; scrub every free-text field plus the JSONB
        # blobs before they hit the database.
        title = redact_string(title_raw)[:_FEEDBACK_TITLE_MAX]
        description = redact_string(description_raw)
        expected_outcome = (
            redact_string(expected_outcome_raw) if expected_outcome_raw else None
        )
        redacted_auto = redact_bundle(chat_row.auto_context or {})
        redacted_synthesis = redact_bundle(synthesis)

        # ``inferred`` is optional — the synthesize prompt sometimes ships
        # it nested under the synthesis, sometimes alongside. Look in
        # both places before falling back to the last assistant turn.
        inferred = self._extract_inferred(chat_row, synthesis)
        type_raw = inferred.get("type")
        severity_raw = inferred.get("severity")
        feedback_type = _coerce_type(type_raw)
        severity = _coerce_severity(severity_raw)

        url_raw = str(redacted_auto.get("url") or "")
        url_captured = url_raw[:_FEEDBACK_URL_MAX] or "about:blank"
        route_raw = redacted_auto.get("route")
        route_name = (
            str(route_raw)[:_FEEDBACK_ROUTE_MAX] if isinstance(route_raw, str) else None
        )
        app_version = _opt_str(redacted_auto.get("app_version"), 64)
        git_commit_sha = _opt_str(redacted_auto.get("git_commit_sha"), 40)
        user_agent = _opt_str(redacted_auto.get("user_agent"), 512)

        # Element-mode metadata (D-009): when the user locked an element
        # via the CapturePicker, the selector / xpath / bounding-box are
        # already in auto_context. Promote them to the dedicated columns
        # so admin queries that filter on element_selector return chat
        # rows too — paridad con el endpoint legacy multipart.
        element_selector = _opt_str(redacted_auto.get("element_selector"), 1024)
        element_xpath = _opt_str(redacted_auto.get("element_xpath"), 2048)
        bbox_raw = redacted_auto.get("element_bounding_box")
        element_bounding_box = bbox_raw if isinstance(bbox_raw, dict) else None

        # Unification (2026-05-16): the chat row IS the ticket. We
        # update its header fields in place instead of creating a
        # separate Feedback row. The legacy code path that allocated
        # a new ``Feedback`` and back-referenced ``chat_session_id``
        # is gone — ``chat_row.id`` IS the ticket id for the rest of
        # the system.
        feedback = chat_row
        feedback.tenant_id = feedback_tenant
        feedback.type = feedback_type
        if feedback.ticket_status is None or feedback.ticket_status == FeedbackStatus.OPEN:
            # Confirm is a "user said done" signal; don't force a status
            # transition because the admin loop owns the lifecycle from
            # here on — leave the ticket at OPEN so admin triage picks
            # it up. If a host previously moved the ticket through the
            # waiting/in-review states, keep that state.
            feedback.ticket_status = FeedbackStatus.OPEN
        feedback.title = title
        feedback.description = description
        feedback.expected_outcome = expected_outcome
        feedback.url_captured = url_captured
        feedback.route_name = route_name
        feedback.element_selector = element_selector
        feedback.element_xpath = element_xpath
        feedback.element_bounding_box = element_bounding_box
        feedback.metadata_bundle = redacted_auto
        feedback.app_version = app_version
        feedback.git_commit_sha = git_commit_sha
        feedback.user_agent = user_agent
        feedback.severity = severity
        feedback.synthesis_json = redacted_synthesis

        if not feedback.ticket_code:
            feedback.ticket_code = generate_ticket_code(
                session, tenant_id=feedback_tenant
            )

        # Bounded retry on UNIQUE collision against the per-tenant
        # ``ticket_code`` index — two confirms racing through the same
        # MAX read can both end up with the same code.
        from sqlalchemy.exc import IntegrityError as _IntegrityError

        attempts = 0
        while True:
            session.add(feedback)
            try:
                session.flush()
                break
            except _IntegrityError:
                session.rollback()
                attempts += 1
                if attempts >= _TICKET_CODE_RETRIES:
                    raise
                feedback.ticket_code = generate_ticket_code(
                    session, tenant_id=feedback_tenant
                )

        # Screenshot upload — at most ONE per ticket. The blob
        # auto-captured client-side at openSheet arrives base64-encoded
        # in ``screenshot_b64``; decode, sanity-cap, push to S3 via
        # ``upload_feedback_attachment``, and stash the attachment id
        # inside ``metadata_bundle`` so the email template + admin UI
        # resolve it without a join.
        #
        # Idempotent on re-approve: the approve endpoint calls
        # confirm_session every time the user clicks Approve. Without
        # this guard, each click uploaded a new SCREENSHOT row →
        # AttachmentTray showed N duplicate thumbnails. We now check
        # for an existing kind=SCREENSHOT attachment first and skip
        # the upload entirely when one already exists.
        if (
            screenshot_b64
            and storage is not None
            and resolved_settings is not None
        ):
            from sqlmodel import select as _select_existing

            existing_screenshot = session.exec(
                _select_existing(FeedbackAttachment)
                .where(FeedbackAttachment.ticket_id == feedback.id)
                .where(
                    FeedbackAttachment.kind == FeedbackAttachmentKind.SCREENSHOT
                )
                .limit(1)
            ).first()
            if existing_screenshot is not None:
                logger.debug(
                    "chat confirm: screenshot already attached to ticket=%s — skipping upload",
                    feedback.id,
                )
            else:
                try:
                    import base64

                    raw_bytes = base64.b64decode(screenshot_b64, validate=True)
                except (ValueError, TypeError):
                    logger.warning(
                        "chat confirm: screenshot_b64 not valid base64 — skipping upload"
                    )
                else:
                    cap = resolved_settings.MAX_SCREENSHOT_BYTES
                    if len(raw_bytes) > cap:
                        logger.warning(
                            "chat confirm: screenshot exceeds cap (%d > %d) — skipping",
                            len(raw_bytes),
                            cap,
                        )
                    else:
                        attachment = upload_feedback_attachment(
                            session,
                            storage,
                            feedback_id=feedback.id,
                            tenant_id=feedback_tenant,
                            content=raw_bytes,
                            content_type=screenshot_content_type or "image/png",
                            filename=None,
                            kind=FeedbackAttachmentKind.SCREENSHOT,
                            width=None,
                            height=None,
                            settings=resolved_settings,
                        )
                        session.flush()
                        bundle = dict(feedback.metadata_bundle or {})
                        bundle["screenshot_attachment_id"] = str(attachment.id)
                        feedback.metadata_bundle = bundle
                        session.add(feedback)
                        session.flush()

        # Flip the chat session phase to confirmed. The ticket itself
        # stays addressable via ``feedback.id`` (same as chat_row.id).
        chat_row.status = ChatSessionStatus.CONFIRMED
        chat_row.confirmed_at = datetime.now(UTC)
        chat_row.updated_at = chat_row.confirmed_at
        session.add(chat_row)
        session.flush()

        return feedback.id, feedback.ticket_code

    def abandon_session(
        self,
        *,
        session: Session,
        chat_session_id: uuid.UUID,
        tenant_id: uuid.UUID | None,
        user_id: uuid.UUID,
    ) -> None:
        """Mark a chat session abandoned. Idempotent on the status flip.

        Raises:
            ChatSessionNotFoundError — session missing or not owned.
        """
        chat_row = session.get(FeedbackChatSession, chat_session_id)
        if (
            chat_row is None
            or chat_row.user_id != user_id
            or chat_row.tenant_id != tenant_id
        ):
            raise ChatSessionNotFoundError(str(chat_session_id))

        now = datetime.now(UTC)
        chat_row.status = ChatSessionStatus.ABANDONED
        chat_row.abandoned_at = now
        chat_row.updated_at = now
        session.add(chat_row)
        session.flush()

    # ── Synthesis card lifecycle (approve / edit) ─────────────────────

    def approve_synthesis(
        self,
        *,
        session: Session,
        chat_session_id: uuid.UUID,
        tenant_id: uuid.UUID | None,
        user_id: uuid.UUID,
        synthesis_ts: str,
    ) -> dict[str, Any]:
        """Mark one synthesis message as the confirmed version.

        Side-effects:
        - sets ``confirmed=true`` on the matching message
        - sets ``confirmed=false`` on every other synthesis message in
          the same chat (one-winner invariant)
        - copies that synthesis dict into ``synthesis_json`` so the
          confirm-session flow downstream picks the winning version

        Raises:
            ChatSessionNotFoundError — session missing or not owned.
            SynthesisVersionNotFoundError — no synthesis msg with that ts.
        """
        chat_row = session.get(FeedbackChatSession, chat_session_id)
        if (
            chat_row is None
            or chat_row.user_id != user_id
            or chat_row.tenant_id != tenant_id
        ):
            raise ChatSessionNotFoundError(str(chat_session_id))

        msgs = list(chat_row.messages or [])
        winner: dict[str, Any] | None = None
        for msg in msgs:
            if not isinstance(msg, dict) or msg.get("role") != "synthesis":
                continue
            if str(msg.get("ts") or "") == synthesis_ts:
                msg["confirmed"] = True
                winner = msg
            else:
                msg["confirmed"] = False
        if winner is None:
            raise SynthesisVersionNotFoundError(synthesis_ts)

        chat_row.messages = msgs
        flag_modified(chat_row, "messages")
        synthesis_payload = winner.get("synthesis")
        if isinstance(synthesis_payload, dict):
            chat_row.synthesis_json = synthesis_payload
            flag_modified(chat_row, "synthesis_json")
        chat_row.updated_at = datetime.now(UTC)
        session.add(chat_row)
        session.flush()
        return winner

    def edit_synthesis(
        self,
        *,
        session: Session,
        chat_session_id: uuid.UUID,
        tenant_id: uuid.UUID | None,
        user_id: uuid.UUID,
        synthesis_ts: str,
        patch: dict[str, Any],
    ) -> dict[str, Any]:
        """Apply a manual edit to the synthesis dict on a specific msg.

        Only ``_SYNTHESIS_EDITABLE_FIELDS`` are accepted; unknown keys
        are silently dropped. The msg's ``confirmed`` flag is preserved
        — editing does NOT auto-approve. Once any version in this chat
        is confirmed, edits to OTHER versions are rejected because the
        ticket already has a winner.

        Raises:
            ChatSessionNotFoundError, SynthesisVersionNotFoundError,
            SynthesisAlreadyConfirmedError.
        """
        chat_row = session.get(FeedbackChatSession, chat_session_id)
        if (
            chat_row is None
            or chat_row.user_id != user_id
            or chat_row.tenant_id != tenant_id
        ):
            raise ChatSessionNotFoundError(str(chat_session_id))

        msgs = list(chat_row.messages or [])
        target: dict[str, Any] | None = None
        already_confirmed_other = False
        for msg in msgs:
            if not isinstance(msg, dict) or msg.get("role") != "synthesis":
                continue
            if str(msg.get("ts") or "") == synthesis_ts:
                target = msg
            elif msg.get("confirmed") is True:
                already_confirmed_other = True
        if target is None:
            raise SynthesisVersionNotFoundError(synthesis_ts)
        if already_confirmed_other and target.get("confirmed") is not True:
            raise SynthesisAlreadyConfirmedError(synthesis_ts)

        synthesis = dict(target.get("synthesis") or {})
        for key, value in patch.items():
            if key not in _SYNTHESIS_EDITABLE_FIELDS:
                continue
            if key == "acceptance_criteria":
                if isinstance(value, list):
                    synthesis[key] = [str(item).strip() for item in value if str(item).strip()]
            else:
                cap = _SYNTHESIS_FIELD_CAPS.get(key)
                text = str(value or "").strip()
                if cap is not None:
                    text = text[:cap]
                synthesis[key] = text
        target["synthesis"] = synthesis

        chat_row.messages = msgs
        flag_modified(chat_row, "messages")
        if target.get("confirmed") is True:
            # Edited the winning version — keep ``synthesis_json`` in sync
            # so confirm-session downstream uses the edited copy.
            chat_row.synthesis_json = synthesis
            flag_modified(chat_row, "synthesis_json")
        chat_row.updated_at = datetime.now(UTC)
        session.add(chat_row)
        session.flush()
        return target

    @staticmethod
    def _extract_inferred(
        chat_row: FeedbackChatSession,
        synthesis: dict[str, Any],
    ) -> dict[str, Any]:
        """Pull the ``inferred`` block from the synthesis or the last
        assistant turn carrying one. Returns an empty dict when nothing
        is found — callers default to type=other / severity=NULL."""
        nested = synthesis.get("inferred")
        if isinstance(nested, dict):
            return nested
        for msg in reversed(chat_row.messages or []):
            if not isinstance(msg, dict) or msg.get("role") != "assistant":
                continue
            cand = msg.get("inferred")
            if isinstance(cand, dict):
                return cand
        return {}


def _opt_str(value: Any, max_len: int) -> str | None:
    """Coerce an auto_context value into a bounded optional string."""
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    return trimmed[:max_len]


def _coerce_type(raw: Any) -> FeedbackType:
    """Map an LLM-emitted type label to the canonical enum.

    The capture prompt asks the model for one of the six FeedbackType
    values; any unknown / missing label collapses to ``other`` so the
    confirm never fails on a typo.
    """
    if isinstance(raw, str):
        try:
            return FeedbackType(raw.strip().lower())
        except ValueError:
            pass
    return FeedbackType.OTHER


def _coerce_severity(raw: Any) -> FeedbackSeverity | None:
    """Map an LLM-emitted severity label to the canonical enum, else None."""
    if isinstance(raw, str):
        try:
            return FeedbackSeverity(raw.strip().lower())
        except ValueError:
            return None
    return None


def _serialise_user_payload(turns: list[dict[str, Any]]) -> str:
    """Render the multi-turn user/assistant payload as one text blob.

    Provider adapters in this codebase accept a single ``user_prompt``
    string; for chat we serialise the conversation array as a tagged
    transcript so the model still sees prior turns. A future provider
    interface revision that accepts a native messages array would
    reduce this helper to a stub.
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
