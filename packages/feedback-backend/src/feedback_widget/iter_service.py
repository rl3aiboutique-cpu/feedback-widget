"""Service layer — state machine, idempotency, streaming orchestration.

The router calls into this module exclusively; nothing else here
imports FastAPI. The service uses the sync :class:`Session` for
all DB writes (per ADR-006 the widget runs a sync engine even in
an async host) and hops to ``asyncio.to_thread`` for those writes
between LLM-stream chunks so the event loop stays responsive.

Three big public methods:

* :meth:`IterService.start_session` — idempotent on ``feedback_id``
  via the partial unique index; returns an existing non-terminal
  session for the same feedback rather than spawning duplicates.
* :meth:`IterService.run_iteration` — async generator yielding
  :class:`SSEEvent` instances. Replays a prior call's events on
  ``Idempotency-Key`` collision so a double-clicked button doesn't
  burn tokens twice.
* :meth:`IterService.finalize_session` — synchronous. Builds the
  package, uploads to MinIO, persists the row, fires the email.

State transitions (spec §8.1)::

    draft ─┬─► iterating ─┬─► finalized (terminal)
           │              │
           │              └─► abandoned (terminal)
           │
           └────────────────► abandoned (user discards before v1)
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlmodel import Session

from .iter_differ import enforce_no_destructive_removal
from .iter_llm.protocol import (
    LLMAttachment,
    LLMProvider,
    LLMProviderError,
)
from .iter_models import (
    FeedbackIterAssumption,
    FeedbackIterAssumptionStatus,
    FeedbackIterCall,
    FeedbackIterCallStatus,
    FeedbackIterPackage,
    FeedbackIterSession,
    FeedbackIterSessionStatus,
    FeedbackIterVersion,
)
from .iter_packager import (
    AssumptionResolution,
    AttachmentRef,
    FeedbackContext,
    IterationLogEntry,
    PackageBuildInputs,
    build_iter_package,
)
from .iter_parser import (
    IterationParseError,
    parse_iteration_output,
)
from .iter_prompts import (
    SYSTEM_PROMPT_V1,
    build_repair_hint,
    build_user_prompt,
)
from .iter_prompts.user_builder import (
    AttachmentMeta,
    PriorVersion,
    ResolvedAssumption,
    TechnicalMetadata,
    prompt_sha256,
)
from .iter_rate_limit import IterRateLimiter
from .iter_schemas import (
    IterationOutput,
    SSEEvent,
    SSEEventDone,
    SSEEventError,
    SSEEventProviderActive,
    SSEEventProviderFallback,
    SSEEventSection,
    SSEEventToken,
)
from .iter_scrubber import scrub_assumptions, scrub_questions
from .iter_sse import SectionDetector
from .models import Feedback, FeedbackAttachment, FeedbackAttachmentKind
from .settings import FeedbackSettings
from .storage.s3 import StorageBackend

logger = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────────────
# State-machine table
# ────────────────────────────────────────────────────────────────────


_TRANSITIONS: dict[FeedbackIterSessionStatus, set[FeedbackIterSessionStatus]] = {
    FeedbackIterSessionStatus.DRAFT: {
        FeedbackIterSessionStatus.ITERATING,
        FeedbackIterSessionStatus.ABANDONED,
    },
    FeedbackIterSessionStatus.ITERATING: {
        FeedbackIterSessionStatus.ITERATING,
        FeedbackIterSessionStatus.FINALIZED,
        FeedbackIterSessionStatus.ABANDONED,
    },
    FeedbackIterSessionStatus.FINALIZED: set(),
    FeedbackIterSessionStatus.ABANDONED: set(),
}


def _check_transition(
    current: FeedbackIterSessionStatus,
    target: FeedbackIterSessionStatus,
) -> None:
    allowed = _TRANSITIONS.get(current, set())
    if target not in allowed:
        raise IterStateError(
            f"cannot transition session from {current.value!r} to {target.value!r}"
        )


# ────────────────────────────────────────────────────────────────────
# Typed errors the router maps to HTTP responses
# ────────────────────────────────────────────────────────────────────


class IterServiceError(RuntimeError):
    """Base for service-level failures."""


class IterStateError(IterServiceError):
    """An action was attempted in a state that doesn't allow it."""


class IterAccessDeniedError(IterServiceError):
    """The user is not allowed to access this session."""


class IterNotFoundError(IterServiceError):
    """No session / version / assumption with that id."""


class IterAssumptionsOpenError(IterServiceError):
    """Run blocked because the latest version still has open
    assumptions (spec §3.5)."""


class IterTurnBudgetExhaustedError(IterServiceError):
    """Run blocked because the session already used its full
    ``ITER_MAX_TURNS`` budget. The UI should swap "Run iteration"
    for "Mark ready" / "Abandon" once this fires."""


# ────────────────────────────────────────────────────────────────────
# Service entry point
# ────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class CallerIdentity:
    """The bits of the host's CurrentUserSnapshot the service cares about."""

    user_id: uuid.UUID
    tenant_id: uuid.UUID | None
    is_admin: bool


class IterService:
    """One instance per FastAPI app; holds the rate limiter and the
    storage backend. The provider is constructed per request so a
    misconfigured key fails immediately rather than poisoning the
    service singleton."""

    def __init__(
        self,
        *,
        storage: StorageBackend,
        settings: FeedbackSettings,
        rate_limiter: IterRateLimiter | None = None,
        glossary: dict[str, str] | None = None,
    ) -> None:
        self._storage = storage
        self._settings = settings
        self._rate_limiter = rate_limiter or IterRateLimiter()
        # Host-supplied domain glossary; injected into the user prompt
        # so the model picks up canonical terms (e.g. "lead" not
        # "user") and so the scrubber can rewrite forbidden words to
        # the host's preferred phrasing. ``None`` ⇒ no glossary.
        self._glossary = dict(glossary) if glossary else None

    @property
    def rate_limiter(self) -> IterRateLimiter:
        return self._rate_limiter

    # ── Session creation ────────────────────────────────────────────

    def start_session(
        self,
        db: Session,
        *,
        feedback_id: uuid.UUID,
        caller: CallerIdentity,
    ) -> FeedbackIterSession:
        feedback = self._load_feedback(db, feedback_id)
        self._enforce_feedback_ownership(feedback, caller)

        # Reuse existing non-terminal session if any (the partial
        # unique index would block insert anyway; this is the
        # human-friendly path).
        existing = self._find_active_session(db, feedback_id)
        if existing is not None:
            return existing

        session = FeedbackIterSession(
            feedback_id=feedback_id,
            tenant_id=feedback.tenant_id,
            created_by_user_id=caller.user_id,
            status=FeedbackIterSessionStatus.DRAFT,
            model_id=self._resolve_model_id(),
            model_provider=self._settings.ITER_PROVIDER,
            language="en",
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    # ── Run iteration (streaming) ───────────────────────────────────

    async def run_iteration(
        self,
        db: Session,
        *,
        session_id: uuid.UUID,
        user_message: str,
        restructure_allowed: bool,
        idempotency_key: str | None,
        provider: LLMProvider,
        caller: CallerIdentity,
    ) -> AsyncIterator[SSEEvent]:
        """Async generator yielding SSE events for the workspace.

        Runs synchronously up to the LLM call (state checks, prompt
        build); then streams; then hops to ``to_thread`` to persist
        the version, the call row, and the assumption rows.
        """
        # Pre-checks (sync; in the request thread).
        session = self._load_session(db, session_id)
        self._enforce_session_ownership(session, caller)
        self._check_session_runnable(session)
        self._check_no_open_assumptions(db, session)
        self._check_turn_budget(db, session)

        # Idempotency replay.
        if idempotency_key:
            existing = self._find_call_by_idem(db, session_id, idempotency_key)
            if existing is not None and existing.status == FeedbackIterCallStatus.SUCCESS:
                async for ev in self._replay_call_events(db, existing):
                    yield ev
                return

        # Rate limits — these raise IterRateLimitExceededError which
        # the router maps to HTTP 429 with the spec body.
        self._rate_limiter.check_session_total(db, session_id=session_id, settings=self._settings)
        self._rate_limiter.check_user_week(db, user_id=caller.user_id, settings=self._settings)

        feedback = self._load_feedback(db, session.feedback_id)
        prior_versions = self._load_prior_versions(db, session_id)
        resolved = self._load_resolved_assumptions(db, session_id)
        attachments_meta = self._load_attachment_metas(db, session.feedback_id)
        attachments_blobs = self._load_attachment_blobs(db, session.feedback_id)
        tech_meta = _build_tech_meta(feedback)

        user_prompt = build_user_prompt(
            feedback_text=_compose_feedback_text(feedback),
            attachments=attachments_meta,
            technical_metadata=tech_meta,
            prior_versions=prior_versions,
            resolved_assumptions=resolved,
            user_iteration_message=user_message,
            restructure_allowed=restructure_allowed,
            glossary=self._glossary,
        )
        system_prompt = SYSTEM_PROMPT_V1
        ph = prompt_sha256(system_prompt, user_prompt)

        # Stream the model.
        detector = SectionDetector()
        buffer: list[str] = []
        loop = asyncio.get_running_loop()
        start = loop.time()
        # v0.5 (Block C) — emit the initial active-model event BEFORE
        # entering the chunk loop so the UI badge has a value to render
        # the moment streaming begins.
        yield SSEEventProviderActive(model=provider.current_model)
        try:
            async for chunk in provider.stream(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                attachments=attachments_blobs,
                timeout_seconds=self._settings.ITER_REQUEST_TIMEOUT_SECONDS,
                max_output_tokens=self._settings.ITER_MAX_OUTPUT_TOKENS,
            ):
                # Drain pending fallback events emitted by the provider
                # since the last chunk. Walks recorded on the queue
                # (e.g. Flash 503 → Gemma 4) surface as
                # ``provider_fallback`` SSE events so the UI can render
                # the swap banner. v0.5 — each fallback is followed by
                # a fresh ``provider_active`` so the badge stays in sync
                # with the model that actually serves the next chunk.
                for from_m, to_m, reason in provider.consume_fallback_events():
                    yield SSEEventProviderFallback(
                        from_model=from_m, to_model=to_m, reason=reason
                    )
                    yield SSEEventProviderActive(model=to_m)
                buffer.append(chunk)
                for section in detector.feed(chunk):
                    yield SSEEventSection(section=section)  # type: ignore[arg-type]
                yield SSEEventToken(chunk=chunk)
        except LLMProviderError as exc:
            # Even on chain-exhaustion, surface every walk that happened
            # before the final failure — gives the user context for why
            # things took so long, and shows the system DID try fallbacks.
            for from_m, to_m, reason in provider.consume_fallback_events():
                yield SSEEventProviderFallback(
                    from_model=from_m, to_model=to_m, reason=reason
                )
                yield SSEEventProviderActive(model=to_m)
            # Friendly Spanish error message replacing the raw provider
            # JSON. The structured exception still goes to logs + DB
            # for ops; the user just sees a calm sentence.
            friendly = _friendly_provider_error_es(exc)
            yield SSEEventError(error_code=type(exc).__name__, message=friendly)
            await asyncio.to_thread(
                self._persist_failed_call,
                db,
                session=session,
                user=caller,
                attempt=1,
                status=_map_provider_error(exc),
                err=str(exc),
                prompt_hash=ph,
                idempotency_key=idempotency_key,
                latency_ms=int((loop.time() - start) * 1000),
            )
            return
        latency_ms = int((loop.time() - start) * 1000)
        raw_text = "".join(buffer)

        # Parse + retry-once.
        try:
            parsed = parse_iteration_output(raw_text, restructure_allowed=restructure_allowed)
            attempts = 1
        except IterationParseError as first_err:
            repair = build_repair_hint(first_err.render_for_repair_hint())
            try:
                second = await provider.generate(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt + repair,
                    attachments=attachments_blobs,
                    timeout_seconds=self._settings.ITER_REQUEST_TIMEOUT_SECONDS,
                    max_output_tokens=self._settings.ITER_MAX_OUTPUT_TOKENS,
                )
                parsed = parse_iteration_output(
                    second.raw_text, restructure_allowed=restructure_allowed
                )
                raw_text = second.raw_text
                attempts = 2
                latency_ms += second.usage.latency_ms
            except (IterationParseError, LLMProviderError) as second_err:
                detail = _format_parse_error(second_err, raw_text=raw_text)
                logger.warning("iter run_iteration JSON-invalid retry failed: %s", detail)
                yield SSEEventError(
                    error_code="json_invalid",
                    message=detail[:1_000],
                )
                await asyncio.to_thread(
                    self._persist_failed_call,
                    db,
                    session=session,
                    user=caller,
                    attempt=2,
                    status=FeedbackIterCallStatus.JSON_INVALID,
                    err=detail,
                    prompt_hash=ph,
                    idempotency_key=idempotency_key,
                    latency_ms=latency_ms,
                )
                return

        # Belt-and-braces: enforce no-remove invariant after parse.
        enforce_no_destructive_removal(list(parsed.diff), restructure_allowed=restructure_allowed)

        # Server-side jargon scrub. The prompt forbids these words but
        # open-weight models leak them anyway; this is the safety net.
        # Drops + rewrites are recorded on FeedbackIterCall.scrub_log.
        # v0.4.1 also scrubs ``unresolved_questions`` — same policy,
        # slot keys prefixed ``q_<idx>`` so admins can tell entries
        # apart when reading the log column.
        scrub_result = scrub_assumptions(
            list(parsed.assumptions),
            forbidden_words=self._settings.forbidden_words_list,
            glossary=self._glossary,
        )
        question_result = scrub_questions(
            list(parsed.unresolved_questions),
            forbidden_words=self._settings.forbidden_words_list,
            glossary=self._glossary,
        )
        parsed = parsed.model_copy(
            update={
                "assumptions": scrub_result.kept,
                "unresolved_questions": question_result.kept,
            }
        )
        scrub_log_dicts = [e.to_dict() for e in scrub_result.log]
        scrub_log_dicts.extend(e.to_dict() for e in question_result.log)

        # Persist version + call + assumptions.
        version_id, version_number = await asyncio.to_thread(
            self._persist_success,
            db,
            session=session,
            user=caller,
            user_message=user_message,
            restructure_allowed=restructure_allowed,
            parsed=parsed,
            raw_text=raw_text,
            attempts=attempts,
            prompt_hash=ph,
            idempotency_key=idempotency_key,
            latency_ms=latency_ms,
            provider=provider,
            scrub_log=scrub_log_dicts,
        )
        yield SSEEventDone(version_id=version_id, version_number=version_number)

    # ── Resolve assumption ───────────────────────────────────────────

    def resolve_assumption(
        self,
        db: Session,
        *,
        assumption_id: uuid.UUID,
        new_status: FeedbackIterAssumptionStatus,
        user_response: str | None,
        caller: CallerIdentity,
    ) -> FeedbackIterAssumption:
        if new_status == FeedbackIterAssumptionStatus.OPEN:
            raise IterStateError("cannot resolve to status=open")
        asm = db.get(FeedbackIterAssumption, assumption_id)
        if asm is None:
            raise IterNotFoundError(f"assumption {assumption_id} not found")
        version = db.get(FeedbackIterVersion, asm.version_id)
        assert version is not None
        session = db.get(FeedbackIterSession, version.session_id)
        assert session is not None
        self._enforce_session_ownership(session, caller)

        asm.status = new_status
        asm.user_response = (
            user_response if new_status == FeedbackIterAssumptionStatus.CORRECTED else None
        )
        asm.resolved_at = datetime.now(UTC)
        asm.resolved_by_user_id = caller.user_id
        db.add(asm)
        db.commit()
        db.refresh(asm)
        return asm

    # ── Manual markdown edit ────────────────────────────────────────

    def edit_version_markdown(
        self,
        db: Session,
        *,
        session_id: uuid.UUID,
        version_id: uuid.UUID,
        new_markdown: str,
        caller: CallerIdentity,
    ) -> FeedbackIterVersion:
        """Replace the rendered markdown on the LATEST non-finalized
        version. Lets users polish the spec by hand before finalize.
        Mutates the row in place (one exception to the otherwise
        append-only convention) and stamps a flag inside output_json
        so admins can tell hand-edits from LLM output."""
        session = self._load_session(db, session_id)
        self._enforce_session_ownership(session, caller)
        if session.status in {
            FeedbackIterSessionStatus.FINALIZED,
            FeedbackIterSessionStatus.ABANDONED,
        }:
            raise IterStateError("cannot edit markdown on a terminal session")
        if session.current_iteration_id != version_id:
            raise IterStateError("only the latest version's markdown is editable")
        version = db.get(FeedbackIterVersion, version_id)
        if version is None:
            raise IterNotFoundError(f"version {version_id} not found")
        version.output_markdown = new_markdown
        # Stamp the JSON snapshot so admin tooling shows "manually
        # edited" beside the version row.
        snapshot = dict(version.output_json or {})
        snapshot["markdown_rendered"] = new_markdown
        snapshot["manually_edited"] = True
        snapshot["manually_edited_at"] = datetime.now(UTC).isoformat()
        snapshot["manually_edited_by"] = str(caller.user_id)
        version.output_json = snapshot
        session.updated_at = datetime.now(UTC)
        db.add(version)
        db.add(session)
        db.commit()
        db.refresh(version)
        return version

    # ── Finalize ────────────────────────────────────────────────────

    def finalize_session(
        self,
        db: Session,
        *,
        session_id: uuid.UUID,
        caller: CallerIdentity,
    ) -> FeedbackIterPackage:
        session = self._load_session(db, session_id)
        self._enforce_session_ownership(session, caller)
        if session.status == FeedbackIterSessionStatus.FINALIZED:
            existing = self._find_existing_package(db, session_id)
            if existing is not None:
                return existing
        _check_transition(session.status, FeedbackIterSessionStatus.FINALIZED)
        if session.current_iteration_id is None:
            raise IterStateError("cannot finalize a session that has no versions yet")

        feedback = self._load_feedback(db, session.feedback_id)
        final_version = db.get(FeedbackIterVersion, session.current_iteration_id)
        assert final_version is not None
        final_output = IterationOutput.model_validate(final_version.output_json)

        attachments = self._load_attachment_refs(db, feedback.id)
        assumption_resolutions = self._load_all_assumption_resolutions(db, session_id)
        log_entries = self._load_iteration_log(db, session_id)

        package_id = uuid.uuid4()
        result = build_iter_package(
            inputs=PackageBuildInputs(
                feedback=_to_feedback_context(feedback),
                final_output=final_output,
                session_id=session_id,
                package_id=package_id,
                attachments=attachments,
                assumptions=assumption_resolutions,
                iteration_log=log_entries,
            ),
            storage=self._storage,
            settings=self._settings,
            feedback_created_at=feedback.created_at or datetime.now(UTC),
        )

        package = FeedbackIterPackage(
            id=package_id,
            session_id=session_id,
            tenant_id=session.tenant_id,
            final_version_id=final_version.id,
            minio_zip_key=result.zip_key,
            minio_folder_prefix=result.folder_prefix,
            byte_size_zip=result.zip_byte_size,
        )
        db.add(package)
        session.status = FeedbackIterSessionStatus.FINALIZED
        session.finalized_at = datetime.now(UTC)
        session.final_package_id = package_id
        session.updated_at = datetime.now(UTC)
        db.add(session)
        db.commit()
        db.refresh(package)
        return package

    # ── Abandon ─────────────────────────────────────────────────────

    def abandon_session(
        self,
        db: Session,
        *,
        session_id: uuid.UUID,
        caller: CallerIdentity,
    ) -> FeedbackIterSession:
        session = self._load_session(db, session_id)
        self._enforce_session_ownership(session, caller)
        if session.status == FeedbackIterSessionStatus.ABANDONED:
            return session
        _check_transition(session.status, FeedbackIterSessionStatus.ABANDONED)
        session.status = FeedbackIterSessionStatus.ABANDONED
        session.updated_at = datetime.now(UTC)
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    # ── Read helpers ─────────────────────────────────────────────────

    def get_session(
        self,
        db: Session,
        *,
        session_id: uuid.UUID,
        caller: CallerIdentity,
    ) -> FeedbackIterSession:
        s = self._load_session(db, session_id)
        self._enforce_session_ownership(s, caller)
        return s

    def list_versions(
        self,
        db: Session,
        *,
        session_id: uuid.UUID,
        caller: CallerIdentity,
    ) -> list[FeedbackIterVersion]:
        self._enforce_session_ownership(self._load_session(db, session_id), caller)
        rows = (
            db.execute(
                select(FeedbackIterVersion)
                .where(FeedbackIterVersion.session_id == session_id)
                .order_by(FeedbackIterVersion.version_number)
            )
            .scalars()
            .all()
        )
        return list(rows)

    def list_assumptions(
        self,
        db: Session,
        *,
        session_id: uuid.UUID,
        caller: CallerIdentity,
    ) -> list[FeedbackIterAssumption]:
        session = self._load_session(db, session_id)
        self._enforce_session_ownership(session, caller)
        if session.current_iteration_id is None:
            return []
        rows = (
            db.execute(
                select(FeedbackIterAssumption)
                .where(FeedbackIterAssumption.version_id == session.current_iteration_id)
                .order_by(FeedbackIterAssumption.created_at)
            )
            .scalars()
            .all()
        )
        return list(rows)

    def list_sessions_for_feedback(
        self,
        db: Session,
        *,
        feedback_id: uuid.UUID,
        caller: CallerIdentity,
    ) -> list[FeedbackIterSession]:
        """Return every iter session attached to a feedback row, newest
        first. Admin-only — the triage page uses this to surface all
        AI iterations on a feedback ticket plus their finalized
        package, if any. Tenant scoping is handled by the per-request
        RLS settings; we additionally filter by ``feedback_id`` which
        is the only thing the caller knows.
        """
        del caller  # ownership is enforced via tenant RLS on the row
        rows = (
            db.execute(
                select(FeedbackIterSession)
                .where(FeedbackIterSession.feedback_id == feedback_id)
                .order_by(FeedbackIterSession.created_at.desc())
            )
            .scalars()
            .all()
        )
        return list(rows)

    def list_calls(
        self,
        db: Session,
        *,
        session_id: uuid.UUID,
        caller: CallerIdentity,
    ) -> list[FeedbackIterCall]:
        session = self._load_session(db, session_id)
        self._enforce_session_ownership(session, caller)
        rows = (
            db.execute(
                select(FeedbackIterCall)
                .where(FeedbackIterCall.session_id == session_id)
                .order_by(FeedbackIterCall.created_at)
            )
            .scalars()
            .all()
        )
        return list(rows)

    def get_last_call_model_id(
        self,
        db: Session,
        *,
        session_id: uuid.UUID,
    ) -> str | None:
        """Return the model id of the newest successful call on the
        session, or ``None`` if no call has succeeded yet.

        Used by the read DTO mapper so the workspace header reflects
        what actually answered (post-fallback) rather than the model
        recorded once at session creation. Skips ownership checks
        because callers already enforced them on the parent session
        load.
        """
        return db.execute(
            select(FeedbackIterCall.model_id)
            .where(FeedbackIterCall.session_id == session_id)
            .where(FeedbackIterCall.status == FeedbackIterCallStatus.SUCCESS)
            .order_by(FeedbackIterCall.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()

    # ── Internal: persistence ────────────────────────────────────────

    def _persist_success(
        self,
        db: Session,
        *,
        session: FeedbackIterSession,
        user: CallerIdentity,
        user_message: str,
        restructure_allowed: bool,
        parsed: IterationOutput,
        raw_text: str,
        attempts: int,
        prompt_hash: str,
        idempotency_key: str | None,
        latency_ms: int,
        provider: LLMProvider,
        scrub_log: list[dict[str, Any]] | None = None,
    ) -> tuple[uuid.UUID, int]:
        # Allocate the next version number atomically.
        latest = db.execute(
            select(FeedbackIterVersion.version_number)
            .where(FeedbackIterVersion.session_id == session.id)
            .order_by(FeedbackIterVersion.version_number.desc())
        ).scalar()
        next_number = (latest or 0) + 1
        parent = session.current_iteration_id

        version = FeedbackIterVersion(
            session_id=session.id,
            tenant_id=session.tenant_id,
            version_number=next_number,
            parent_version_id=parent,
            user_message=user_message,
            restructure_allowed=restructure_allowed,
            output_json=parsed.model_dump(mode="json"),
            output_markdown=parsed.markdown_rendered,
            diff_json=[op.model_dump(mode="json") for op in parsed.diff],
            is_complete=bool(parsed.is_complete),
            completion_reason=parsed.completion_reason or None,
        )
        db.add(version)
        db.flush()  # need version.id for FK below

        # Slot-key carry-over: copy prior resolutions for matching keys.
        prior_resolutions = self._load_slot_key_resolutions(db, session.id)
        for asm in parsed.assumptions:
            prior = prior_resolutions.get(asm.slot_key)
            row = FeedbackIterAssumption(
                version_id=version.id,
                tenant_id=session.tenant_id,
                slot_key=asm.slot_key,
                kind=asm.kind,
                statement=asm.statement,
                rationale=asm.rationale,
                confidence=asm.confidence,
                status=(prior.status if prior is not None else FeedbackIterAssumptionStatus.OPEN),
                user_response=prior.user_response if prior is not None else None,
                resolved_at=prior.resolved_at if prior is not None else None,
                resolved_by_user_id=(prior.resolved_by_user_id if prior is not None else None),
                options=list(asm.options) if asm.options else None,
            )
            db.add(row)

        # Call audit row.
        call = FeedbackIterCall(
            session_id=session.id,
            tenant_id=session.tenant_id,
            version_id=version.id,
            model_id=session.model_id,
            model_provider=session.model_provider,
            input_tokens=0,
            output_tokens=0,
            cost_usd=None,
            latency_ms=latency_ms,
            status=FeedbackIterCallStatus.SUCCESS,
            attempt_number=attempts,
            error_message=None,
            prompt_sha256=prompt_hash,
            idempotency_key=idempotency_key,
            scrub_log=scrub_log if scrub_log else None,
        )
        db.add(call)

        # Promote session.
        session.status = FeedbackIterSessionStatus.ITERATING
        session.current_iteration_id = version.id
        session.updated_at = datetime.now(UTC)
        db.add(session)
        db.commit()
        db.refresh(version)

        self._rate_limiter.record_call(session_id=session.id, user_id=user.user_id)
        del raw_text, provider, prompt_hash  # used for hashing only
        return version.id, next_number

    def _persist_failed_call(
        self,
        db: Session,
        *,
        session: FeedbackIterSession,
        user: CallerIdentity,
        attempt: int,
        status: FeedbackIterCallStatus,
        err: str,
        prompt_hash: str,
        idempotency_key: str | None,
        latency_ms: int,
    ) -> None:
        call = FeedbackIterCall(
            session_id=session.id,
            tenant_id=session.tenant_id,
            version_id=None,
            model_id=session.model_id,
            model_provider=session.model_provider,
            input_tokens=0,
            output_tokens=0,
            cost_usd=None,
            latency_ms=latency_ms,
            status=status,
            attempt_number=attempt,
            error_message=err[:5_000],
            prompt_sha256=prompt_hash,
            idempotency_key=idempotency_key,
        )
        db.add(call)
        db.commit()
        self._rate_limiter.record_call(session_id=session.id, user_id=user.user_id)

    # ── Internal: loaders ────────────────────────────────────────────

    @staticmethod
    def _load_session(db: Session, sid: uuid.UUID) -> FeedbackIterSession:
        s = db.get(FeedbackIterSession, sid)
        if s is None:
            raise IterNotFoundError(f"iter session {sid} not found")
        return s

    @staticmethod
    def _load_feedback(db: Session, fid: uuid.UUID) -> Feedback:
        f = db.get(Feedback, fid)
        if f is None:
            raise IterNotFoundError(f"feedback {fid} not found")
        return f

    @staticmethod
    def _find_active_session(db: Session, fid: uuid.UUID) -> FeedbackIterSession | None:
        return db.execute(
            select(FeedbackIterSession)
            .where(FeedbackIterSession.feedback_id == fid)
            .where(
                FeedbackIterSession.status.notin_(  # type: ignore[attr-defined]
                    [
                        FeedbackIterSessionStatus.FINALIZED,
                        FeedbackIterSessionStatus.ABANDONED,
                    ]
                )
            )
            .limit(1)
        ).scalar_one_or_none()

    @staticmethod
    def _find_call_by_idem(db: Session, sid: uuid.UUID, idem: str) -> FeedbackIterCall | None:
        return db.execute(
            select(FeedbackIterCall)
            .where(FeedbackIterCall.session_id == sid)
            .where(FeedbackIterCall.idempotency_key == idem)
            .limit(1)
        ).scalar_one_or_none()

    @staticmethod
    def _find_existing_package(db: Session, sid: uuid.UUID) -> FeedbackIterPackage | None:
        return db.execute(
            select(FeedbackIterPackage).where(FeedbackIterPackage.session_id == sid).limit(1)
        ).scalar_one_or_none()

    @staticmethod
    def _load_prior_versions(db: Session, sid: uuid.UUID) -> list[PriorVersion]:
        rows = (
            db.execute(
                select(FeedbackIterVersion)
                .where(FeedbackIterVersion.session_id == sid)
                .order_by(FeedbackIterVersion.version_number)
            )
            .scalars()
            .all()
        )
        return [
            PriorVersion(
                version_number=v.version_number,
                markdown_rendered=v.output_markdown,
            )
            for v in rows
        ]

    @staticmethod
    def _load_resolved_assumptions(db: Session, sid: uuid.UUID) -> list[ResolvedAssumption]:
        # Carry every resolved assumption across all prior versions.
        rows = (
            db.execute(
                select(FeedbackIterAssumption)
                .join(
                    FeedbackIterVersion,
                    FeedbackIterVersion.id == FeedbackIterAssumption.version_id,
                )
                .where(FeedbackIterVersion.session_id == sid)
                .where(
                    FeedbackIterAssumption.status.notin_(  # type: ignore[attr-defined]
                        [FeedbackIterAssumptionStatus.OPEN]
                    )
                )
            )
            .scalars()
            .all()
        )
        # Deduplicate by slot_key, preferring the latest resolution.
        by_slot: dict[str, FeedbackIterAssumption] = {}
        for r in rows:
            existing = by_slot.get(r.slot_key)
            if existing is None or (
                r.resolved_at and existing.resolved_at and r.resolved_at > existing.resolved_at
            ):
                by_slot[r.slot_key] = r
        return [
            ResolvedAssumption(
                slot_key=r.slot_key,
                kind=r.kind.value,
                status=r.status.value,
                statement=r.statement,
                user_response=r.user_response or "",
            )
            for r in by_slot.values()
        ]

    @staticmethod
    def _load_slot_key_resolutions(
        db: Session, sid: uuid.UUID
    ) -> dict[str, FeedbackIterAssumption]:
        """Latest resolution per slot_key — used for carry-over on
        new version writes."""
        rows = (
            db.execute(
                select(FeedbackIterAssumption)
                .join(
                    FeedbackIterVersion,
                    FeedbackIterVersion.id == FeedbackIterAssumption.version_id,
                )
                .where(FeedbackIterVersion.session_id == sid)
                .where(
                    FeedbackIterAssumption.status.notin_(  # type: ignore[attr-defined]
                        [FeedbackIterAssumptionStatus.OPEN]
                    )
                )
            )
            .scalars()
            .all()
        )
        out: dict[str, FeedbackIterAssumption] = {}
        for r in rows:
            existing = out.get(r.slot_key)
            if existing is None or (
                r.resolved_at and existing.resolved_at and r.resolved_at > existing.resolved_at
            ):
                out[r.slot_key] = r
        return out

    @staticmethod
    def _load_attachment_metas(db: Session, fid: uuid.UUID) -> list[AttachmentMeta]:
        rows = (
            db.execute(
                select(FeedbackAttachment)
                .where(FeedbackAttachment.feedback_id == fid)
                .order_by(FeedbackAttachment.created_at)
            )
            .scalars()
            .all()
        )
        return [
            AttachmentMeta(
                filename=r.filename or _filename_for_screenshot(fid),
                mime_type=r.content_type,
                kind=_attachment_kind_label(r.kind),
            )
            for r in rows
        ]

    def _load_attachment_blobs(self, db: Session, fid: uuid.UUID) -> list[LLMAttachment]:
        """Load attachment bytes from MinIO for inclusion in the LLM prompt.

        Skips attachments larger than 10MB to avoid blowing the
        provider's context window. Conservative — most LLMs reject
        big PDFs anyway.
        """
        import base64

        rows = (
            db.execute(
                select(FeedbackAttachment)
                .where(FeedbackAttachment.feedback_id == fid)
                .order_by(FeedbackAttachment.created_at)
            )
            .scalars()
            .all()
        )
        out: list[LLMAttachment] = []
        for r in rows:
            if r.byte_size > 10_000_000:
                logger.warning(
                    "skipping iter attachment %s — too large (%d bytes)",
                    r.object_key,
                    r.byte_size,
                )
                continue
            try:
                blob = self._storage.download(r.object_key, bucket=r.bucket)
            except Exception:
                logger.exception("iter attachment download failed: %s", r.object_key)
                continue
            out.append(
                LLMAttachment(
                    kind=_llm_attachment_kind(r.content_type),
                    filename=r.filename or _filename_for_screenshot(fid),
                    mime_type=r.content_type,
                    bytes_b64=base64.b64encode(blob).decode("ascii"),
                )
            )
        return out

    def _load_attachment_refs(self, db: Session, fid: uuid.UUID) -> list[AttachmentRef]:
        rows = (
            db.execute(
                select(FeedbackAttachment)
                .where(FeedbackAttachment.feedback_id == fid)
                .order_by(FeedbackAttachment.created_at)
            )
            .scalars()
            .all()
        )
        return [
            AttachmentRef(
                object_key=r.object_key,
                filename=(
                    r.filename
                    if r.kind == FeedbackAttachmentKind.USER_ATTACHMENT
                    else "00_widget_screenshot.png"
                ),
                content_type=r.content_type,
                byte_size=r.byte_size,
                bucket=r.bucket,
            )
            for r in rows
        ]

    @staticmethod
    def _load_all_assumption_resolutions(db: Session, sid: uuid.UUID) -> list[AssumptionResolution]:
        rows = (
            db.execute(
                select(FeedbackIterAssumption)
                .join(
                    FeedbackIterVersion,
                    FeedbackIterVersion.id == FeedbackIterAssumption.version_id,
                )
                .where(FeedbackIterVersion.session_id == sid)
            )
            .scalars()
            .all()
        )
        # Latest per slot_key wins (matches what the package will
        # treat as the "final" status).
        by_slot: dict[str, FeedbackIterAssumption] = {}
        for r in rows:
            ex = by_slot.get(r.slot_key)
            if ex is None or (r.created_at and ex.created_at and r.created_at > ex.created_at):
                by_slot[r.slot_key] = r
        return [
            AssumptionResolution(
                slot_key=r.slot_key,
                kind=r.kind.value,
                statement=r.statement,
                status=r.status,
                user_response=r.user_response,
            )
            for r in by_slot.values()
        ]

    @staticmethod
    def _load_iteration_log(db: Session, sid: uuid.UUID) -> list[IterationLogEntry]:
        rows = (
            db.execute(
                select(FeedbackIterVersion)
                .where(FeedbackIterVersion.session_id == sid)
                .order_by(FeedbackIterVersion.version_number)
            )
            .scalars()
            .all()
        )
        out: list[IterationLogEntry] = []
        for r in rows:
            output_json = r.output_json or {}
            summary = ""
            if isinstance(output_json, dict):
                cs = output_json.get("changes_summary")
                if isinstance(cs, str):
                    summary = cs
            out.append(
                IterationLogEntry(
                    version_number=r.version_number,
                    created_at=r.created_at or datetime.now(UTC),
                    user_message=r.user_message,
                    restructure_allowed=r.restructure_allowed,
                    changes_summary=summary,
                )
            )
        return out

    # ── Internal: SSE replay ────────────────────────────────────────

    async def _replay_call_events(
        self,
        db: Session,
        existing: FeedbackIterCall,
    ) -> AsyncIterator[SSEEvent]:
        if existing.version_id is None:
            yield SSEEventError(
                error_code="replay_no_version",
                message="prior call exists but produced no version",
            )
            return
        version = db.get(FeedbackIterVersion, existing.version_id)
        if version is None:
            yield SSEEventError(
                error_code="replay_version_gone",
                message="prior call's version row no longer exists",
            )
            return
        # Replay the markdown as one big chunk so the UI re-paints
        # the working document; section detection runs the same
        # way it did the first time.
        detector = SectionDetector()
        for section in detector.feed(version.output_markdown):
            yield SSEEventSection(section=section)  # type: ignore[arg-type]
        yield SSEEventToken(chunk=version.output_markdown)
        yield SSEEventDone(version_id=version.id, version_number=version.version_number)

    # ── Internal: invariant checks ──────────────────────────────────

    def _enforce_session_ownership(
        self,
        session: FeedbackIterSession,
        caller: CallerIdentity,
    ) -> None:
        if caller.is_admin:
            return
        if session.created_by_user_id == caller.user_id:
            return
        raise IterAccessDeniedError(f"user {caller.user_id} cannot access session {session.id}")

    @staticmethod
    def _enforce_feedback_ownership(
        feedback: Feedback,
        caller: CallerIdentity,
    ) -> None:
        if caller.is_admin:
            return
        if feedback.user_id == caller.user_id:
            return
        raise IterAccessDeniedError(f"user {caller.user_id} cannot access feedback {feedback.id}")

    @staticmethod
    def _check_session_runnable(session: FeedbackIterSession) -> None:
        if session.status in {
            FeedbackIterSessionStatus.FINALIZED,
            FeedbackIterSessionStatus.ABANDONED,
        }:
            raise IterStateError(
                f"session is {session.status.value}; no further iterations allowed"
            )

    def _check_no_open_assumptions(
        self,
        db: Session,
        session: FeedbackIterSession,
    ) -> None:
        if session.current_iteration_id is None:
            return  # first iteration, nothing to gate on
        any_open = db.execute(
            select(FeedbackIterAssumption.id)
            .where(FeedbackIterAssumption.version_id == session.current_iteration_id)
            .where(FeedbackIterAssumption.status == FeedbackIterAssumptionStatus.OPEN)
            .limit(1)
        ).scalar_one_or_none()
        if any_open is not None:
            raise IterAssumptionsOpenError(
                "resolve all assumptions on the latest version before iterating"
            )

    def _check_turn_budget(
        self,
        db: Session,
        session: FeedbackIterSession,
    ) -> None:
        """Reject the run if the session has used its full ITER_MAX_TURNS budget.

        Counts persisted versions — one per successful iteration. The
        cap exists to force convergence; once exhausted, the UI swaps
        "Run iteration" for "Mark ready" / "Abandon".
        """
        max_turns = self._settings.ITER_MAX_TURNS
        if max_turns <= 0:
            return  # disabled
        used = self.count_session_turns(db, session.id)
        if used >= max_turns:
            raise IterTurnBudgetExhaustedError(
                f"session has used its {max_turns}-turn budget; finalize or abandon"
            )

    @staticmethod
    def count_session_turns(db: Session, session_id: uuid.UUID) -> int:
        """Number of persisted versions on the session (1 per successful turn).

        Public so the router can compute ``remaining_turns`` without
        leaking the count query to the wire layer.
        """
        from sqlalchemy import func

        return int(
            db.execute(
                select(func.count())
                .select_from(FeedbackIterVersion)
                .where(FeedbackIterVersion.session_id == session_id)
            ).scalar_one()
        )

    # ── Misc ────────────────────────────────────────────────────────

    def _resolve_model_id(self) -> str:
        """Pick the model id at session-start time so subsequent
        iterations remain consistent even if the host changes
        defaults mid-session."""
        return self.get_current_primary_model_id()

    def get_current_primary_model_id(self) -> str:
        """The primary model the next iteration would attempt first
        (index 0 of the live fallback chain).

        Reads the current settings every call so the workspace header
        tracks env changes — if the host swaps the primary from
        Gemma 4 to Flash Lite mid-session, this returns Flash Lite
        on the very next read. Distinct from the session row's
        ``model_id`` (frozen at creation) and from
        ``last_call_model_id`` (history)."""
        if self._settings.ITER_PROVIDER == "gemini":
            return self._settings.ITER_GEMINI_MODEL or "gemma-3-27b-it"
        if self._settings.ITER_PROVIDER == "claude":
            return self._settings.ITER_CLAUDE_MODEL or "claude-fallback"
        if self._settings.ITER_PROVIDER == "openai":
            return self._settings.ITER_OPENAI_MODEL or "gpt-fallback"
        return "fake-1"


# ────────────────────────────────────────────────────────────────────
# Module-private helpers (kept short to honour the line-cap)
# ────────────────────────────────────────────────────────────────────


def _compose_feedback_text(feedback: Feedback) -> str:
    parts: list[str] = [f"# {feedback.title}", "", feedback.description]
    if feedback.expected_outcome:
        parts.extend(["", "## Expected outcome", "", feedback.expected_outcome])
    return "\n".join(parts)


def _build_tech_meta(feedback: Feedback) -> TechnicalMetadata:
    bundle = feedback.metadata_bundle or {}
    viewport = bundle.get("viewport") or {}
    return TechnicalMetadata(
        url=feedback.url_captured,
        viewport_w=int(viewport.get("width") or 0) or None,
        viewport_h=int(viewport.get("height") or 0) or None,
        user_agent=feedback.user_agent,
        route=feedback.route_name,
        framework=str(bundle.get("framework") or "") or None,
        app_version=feedback.app_version,
        git_sha=feedback.git_commit_sha,
        selected_element_selector=feedback.element_selector,
        selected_element_outer_html=str(bundle.get("element_outer_html") or "") or None,
        console_errors_tail=list(bundle.get("console_tail") or [])[-20:],
        network_errors_tail=list(bundle.get("network_tail") or [])[-20:],
    )


def _to_feedback_context(feedback: Feedback) -> FeedbackContext:
    return FeedbackContext(
        feedback_id=feedback.id,
        title=feedback.title,
        description=feedback.description,
        expected_outcome=feedback.expected_outcome,
        url_captured=feedback.url_captured,
        route_name=feedback.route_name,
        metadata_bundle=feedback.metadata_bundle or {},
        app_version=feedback.app_version,
        git_commit_sha=feedback.git_commit_sha,
    )


def _filename_for_screenshot(fid: uuid.UUID) -> str:
    return f"feedback-{fid}-screenshot.png"


def _attachment_kind_label(kind: FeedbackAttachmentKind) -> str:
    if kind == FeedbackAttachmentKind.SCREENSHOT:
        return "image"
    return "user_attachment"


def _llm_attachment_kind(content_type: str) -> str:
    ct = (content_type or "").lower()
    if ct.startswith("image/"):
        return "image"
    if ct == "application/pdf":
        return "pdf"
    return "text"


def _map_provider_error(exc: Exception) -> FeedbackIterCallStatus:
    name = type(exc).__name__
    if "Timeout" in name:
        return FeedbackIterCallStatus.TIMEOUT
    if "RateLimited" in name:
        return FeedbackIterCallStatus.PROVIDER_ERROR
    return FeedbackIterCallStatus.PROVIDER_ERROR


def _friendly_provider_error_es(exc: Exception) -> str:
    """Render a provider failure as a calm Spanish sentence the user
    can act on, instead of leaking the raw provider JSON.

    The structured exception (with the original message) still goes
    to logs + the call audit row, so ops can debug; the user just
    sees something legible. Today's pain point: the SSE error event
    showed ``500 INTERNAL. {'error': {'code': 500, ...}}`` verbatim
    when the entire fallback chain exhausted, which felt broken.
    """
    name = type(exc).__name__
    if "Timeout" in name:
        return (
            "El modelo tardó demasiado en responder. Espera 30 s y vuelve a intentar."
        )
    if "RateLimited" in name:
        return (
            "Has alcanzado el límite de peticiones del modelo. Espera 60 s antes de "
            "volver a iterar."
        )
    if "Transient" in name:
        return (
            "Los modelos de IA están temporalmente saturados (Google AI Studio). "
            "Hemos intentado los modelos de respaldo pero todos fallaron. "
            "Espera 1-2 min y pulsa Run iteration de nuevo."
        )
    if "Fatal" in name:
        return (
            "El modelo rechazó la petición (configuración o esquema). Si persiste, "
            "avisa al equipo — los detalles técnicos quedaron registrados."
        )
    return (
        "El proveedor de IA falló inesperadamente. Espera y vuelve a intentar; "
        "si persiste, avisa al equipo."
    )


def _format_parse_error(exc: Exception, *, raw_text: str) -> str:
    """Render a parser failure with the validator-error list AND the
    first 2 KB of the raw model response, so the call audit row has
    enough context to debug a misbehaving model without re-running."""
    if isinstance(exc, IterationParseError):
        bullets = "\n".join(f"  - {e}" for e in exc.errors)
        head = f"{exc.args[0] if exc.args else 'parse error'}\n{bullets}"
    else:
        head = f"{type(exc).__name__}: {exc}"
    snippet = (raw_text or "")[:2_000]
    return f"{head}\n--- raw model response (first 2KB) ---\n{snippet}"
