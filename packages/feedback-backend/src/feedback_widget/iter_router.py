"""FastAPI router for the Iterate-with-AI module.

All endpoints sit under the host's chosen prefix +
``/iterate``. Mounted by :func:`register_feedback_iter_router`
(in ``__init__.py``) when ``FEEDBACK_ITER_ENABLED`` is true.

The router itself stays thin — every code path translates a
request into one :class:`IterService` call and translates service
errors into the appropriate HTTP status. Streaming endpoints
return :class:`fastapi.responses.StreamingResponse` so reverse
proxies can flush bytes as the LLM produces them.
"""

# NOTE: deliberately not using `from __future__ import annotations`
# here for the same reason `deps.py` doesn't — FastAPI's OpenAPI
# generator needs eager type-hint resolution for closure-bound deps.

import json
import logging
import uuid
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Header,
    HTTPException,
    Path,
    Request,
    status,
)
from fastapi.responses import JSONResponse, StreamingResponse
from sqlmodel import Session

from feedback_widget.auth import CurrentUserSnapshot
from feedback_widget.deps import WidgetDependencies
from feedback_widget.email.iter_email import build_iter_finalized_email
from feedback_widget.email.mailer import send_email
from feedback_widget.iter_llm import build_provider
from feedback_widget.iter_models import (
    FeedbackIterAssumption,
    FeedbackIterAssumptionStatus,
    FeedbackIterCall,
    FeedbackIterPackage,
    FeedbackIterSession,
    FeedbackIterVersion,
)
from feedback_widget.iter_parser import normalise_markdown_diagrams
from feedback_widget.iter_rate_limit import IterRateLimitExceededError
from feedback_widget.iter_schemas import (
    IterAssumptionRead,
    IterAssumptionResolveRequest,
    IterCallRead,
    IterFinalizeRequest,
    IterPackageRead,
    IterRunRequest,
    IterSessionRead,
    IterStartRequest,
    IterUsageRead,
    IterVersionMarkdownEditRequest,
    IterVersionRead,
)
from feedback_widget.iter_service import (
    CallerIdentity,
    IterAccessDeniedError,
    IterAssumptionsOpenError,
    IterNotFoundError,
    IterServiceError,
    IterStateError,
)
from feedback_widget.iter_sse import format_sse
from feedback_widget.models import Feedback
from feedback_widget.settings import FeedbackSettings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class IterRouterRuntime:
    """The closures `build_iter_router` packages up; held inside the
    router by FastAPI's dependency-injection."""

    deps: WidgetDependencies
    service_factory: Callable[[], "object"]  # IterService — circular avoided
    settings: FeedbackSettings


def _caller_from(user: CurrentUserSnapshot, deps: WidgetDependencies) -> CallerIdentity:
    return CallerIdentity(
        user_id=user.user_id,
        tenant_id=user.tenant_id,
        is_admin=deps.auth.is_master_admin(user),
    )


def _to_session_read(s: FeedbackIterSession) -> IterSessionRead:
    return IterSessionRead(
        id=s.id,
        feedback_id=s.feedback_id,
        created_by_user_id=s.created_by_user_id,
        status=s.status,
        model_id=s.model_id,
        model_provider=s.model_provider,
        language=s.language,
        current_iteration_id=s.current_iteration_id,
        final_package_id=s.final_package_id,
        created_at=s.created_at or datetime.now(UTC),
        updated_at=s.updated_at or datetime.now(UTC),
        finalized_at=s.finalized_at,
    )


def _to_version_read(v: FeedbackIterVersion) -> IterVersionRead:
    output_json = v.output_json or {}
    summary = ""
    if isinstance(output_json, dict):
        cs = output_json.get("changes_summary")
        if isinstance(cs, str):
            summary = cs
    # Apply the diagram-fence normaliser on read so legacy versions
    # stored before the parse-time normaliser landed in v0.3.0-rc.11
    # render correctly without a data migration. The function is
    # idempotent on already-fenced input, so newer rows pass through
    # untouched.
    rendered_md = normalise_markdown_diagrams(v.output_markdown)
    return IterVersionRead(
        id=v.id,
        session_id=v.session_id,
        version_number=v.version_number,
        parent_version_id=v.parent_version_id,
        user_message=v.user_message,
        restructure_allowed=v.restructure_allowed,
        output_markdown=rendered_md,
        diff_json=list(v.diff_json or []),
        changes_summary=summary,
        created_at=v.created_at or datetime.now(UTC),
    )


def _to_assumption_read(a: FeedbackIterAssumption) -> IterAssumptionRead:
    return IterAssumptionRead(
        id=a.id,
        version_id=a.version_id,
        slot_key=a.slot_key,
        kind=a.kind,
        statement=a.statement,
        rationale=a.rationale,
        confidence=a.confidence,
        status=a.status,
        user_response=a.user_response,
        resolved_at=a.resolved_at,
        resolved_by_user_id=a.resolved_by_user_id,
        created_at=a.created_at or datetime.now(UTC),
    )


def _to_call_read(c: FeedbackIterCall) -> IterCallRead:
    return IterCallRead(
        id=c.id,
        session_id=c.session_id,
        version_id=c.version_id,
        model_id=c.model_id,
        model_provider=c.model_provider,
        input_tokens=c.input_tokens,
        output_tokens=c.output_tokens,
        cost_usd=c.cost_usd,
        latency_ms=c.latency_ms,
        status=c.status,
        attempt_number=c.attempt_number,
        error_message=c.error_message,
        prompt_sha256=c.prompt_sha256,
        created_at=c.created_at or datetime.now(UTC),
    )


def _to_package_read(
    p: FeedbackIterPackage,
    presigned_url: str | None,
) -> IterPackageRead:
    return IterPackageRead(
        id=p.id,
        session_id=p.session_id,
        final_version_id=p.final_version_id,
        minio_zip_key=p.minio_zip_key,
        minio_folder_prefix=p.minio_folder_prefix,
        byte_size_zip=p.byte_size_zip,
        created_at=p.created_at or datetime.now(UTC),
        presigned_zip_url=presigned_url,
    )


def _service_error_to_http(exc: IterServiceError) -> HTTPException:
    if isinstance(exc, IterNotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, IterAccessDeniedError):
        return HTTPException(status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, IterAssumptionsOpenError):
        return HTTPException(status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, IterStateError):
        return HTTPException(status.HTTP_409_CONFLICT, detail=str(exc))
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


def _rate_limit_response(exc: IterRateLimitExceededError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content=exc.body.model_dump(mode="json"),
    )


def build_iter_router(
    *,
    deps: WidgetDependencies,
    settings: FeedbackSettings,
    service: "object",  # IterService — circular avoided
) -> APIRouter:
    """Build the iter APIRouter with closures over the auth adapter,
    settings, and shared service singleton."""
    from feedback_widget.iter_service import IterService  # local import to break cycle

    if not isinstance(service, IterService):
        raise TypeError(
            "service must be an IterService; got " + type(service).__name__
        )

    router = APIRouter(tags=["feedback-iterate"])

    UserDep = Annotated[CurrentUserSnapshot, Depends(deps.get_current_user)]
    SessionDep = Annotated[Session, Depends(deps.get_session)]

    # ── Sessions ────────────────────────────────────────────────────

    @router.post(
        "/iterate/sessions",
        response_model=IterSessionRead,
        status_code=status.HTTP_201_CREATED,
    )
    def start_session(
        body: IterStartRequest,
        db: SessionDep,
        user: UserDep,
    ) -> IterSessionRead:
        try:
            row = service.start_session(
                db,
                feedback_id=body.feedback_id,
                caller=_caller_from(user, deps),
            )
        except IterServiceError as exc:
            raise _service_error_to_http(exc) from exc
        return _to_session_read(row)

    @router.get(
        "/iterate/sessions/{session_id}",
        response_model=IterSessionRead,
    )
    def get_session(
        session_id: Annotated[uuid.UUID, Path()],
        db: SessionDep,
        user: UserDep,
    ) -> IterSessionRead:
        try:
            return _to_session_read(
                service.get_session(
                    db,
                    session_id=session_id,
                    caller=_caller_from(user, deps),
                )
            )
        except IterServiceError as exc:
            raise _service_error_to_http(exc) from exc

    @router.post("/iterate/sessions/{session_id}/abandon", response_model=IterSessionRead)
    def abandon_session(
        session_id: Annotated[uuid.UUID, Path()],
        db: SessionDep,
        user: UserDep,
    ) -> IterSessionRead:
        try:
            return _to_session_read(
                service.abandon_session(
                    db,
                    session_id=session_id,
                    caller=_caller_from(user, deps),
                )
            )
        except IterServiceError as exc:
            raise _service_error_to_http(exc) from exc

    # ── Iterations (run + list + detail + diff) ─────────────────────

    @router.post("/iterate/sessions/{session_id}/iterations")
    async def run_iteration(
        session_id: Annotated[uuid.UUID, Path()],
        body: IterRunRequest,
        db: SessionDep,
        user: UserDep,
        request: Request,
        idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    ) -> StreamingResponse:
        try:
            provider = build_provider(settings)
        except Exception as exc:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"LLM provider unavailable: {exc}",
            ) from exc

        caller = _caller_from(user, deps)

        async def event_source() -> AsyncIterator[bytes]:
            try:
                async for ev in service.run_iteration(
                    db,
                    session_id=session_id,
                    user_message=body.user_message,
                    restructure_allowed=body.restructure_allowed,
                    idempotency_key=idempotency_key,
                    provider=provider,
                    caller=caller,
                ):
                    if await request.is_disconnected():
                        logger.info("iter SSE client disconnected mid-stream")
                        break
                    yield format_sse(ev)
            except IterRateLimitExceededError as exc:
                yield _format_error_event(
                    "rate_limited", json.dumps(exc.body.model_dump(mode="json"))
                )
            except IterServiceError as exc:
                yield _format_error_event(
                    type(exc).__name__,
                    str(exc),
                )
            except Exception as exc:
                logger.exception("iter run_iteration failed")
                yield _format_error_event("internal_error", str(exc))

        return StreamingResponse(
            event_source(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",  # nginx: don't buffer
            },
        )

    @router.get(
        "/iterate/sessions/{session_id}/iterations",
        response_model=list[IterVersionRead],
    )
    def list_versions(
        session_id: Annotated[uuid.UUID, Path()],
        db: SessionDep,
        user: UserDep,
    ) -> list[IterVersionRead]:
        try:
            rows = service.list_versions(
                db, session_id=session_id, caller=_caller_from(user, deps)
            )
        except IterServiceError as exc:
            raise _service_error_to_http(exc) from exc
        return [_to_version_read(r) for r in rows]

    @router.get(
        "/iterate/sessions/{session_id}/iterations/{version_id}",
        response_model=IterVersionRead,
    )
    def get_version(
        session_id: Annotated[uuid.UUID, Path()],
        version_id: Annotated[uuid.UUID, Path()],
        db: SessionDep,
        user: UserDep,
    ) -> IterVersionRead:
        # Ownership check via session lookup; then the version row.
        try:
            service.get_session(
                db,
                session_id=session_id,
                caller=_caller_from(user, deps),
            )
        except IterServiceError as exc:
            raise _service_error_to_http(exc) from exc
        v = db.get(FeedbackIterVersion, version_id)
        if v is None or v.session_id != session_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="version not found")
        return _to_version_read(v)

    @router.patch(
        "/iterate/sessions/{session_id}/iterations/{version_id}/markdown",
        response_model=IterVersionRead,
    )
    def edit_version_markdown(
        session_id: Annotated[uuid.UUID, Path()],
        version_id: Annotated[uuid.UUID, Path()],
        body: IterVersionMarkdownEditRequest,
        db: SessionDep,
        user: UserDep,
    ) -> IterVersionRead:
        try:
            row = service.edit_version_markdown(
                db,
                session_id=session_id,
                version_id=version_id,
                new_markdown=body.output_markdown,
                caller=_caller_from(user, deps),
            )
        except IterServiceError as exc:
            raise _service_error_to_http(exc) from exc
        return _to_version_read(row)

    @router.get(
        "/iterate/sessions/{session_id}/iterations/{version_id}/diff",
    )
    def get_version_diff(
        session_id: Annotated[uuid.UUID, Path()],
        version_id: Annotated[uuid.UUID, Path()],
        db: SessionDep,
        user: UserDep,
    ) -> dict[str, object]:
        try:
            service.get_session(
                db,
                session_id=session_id,
                caller=_caller_from(user, deps),
            )
        except IterServiceError as exc:
            raise _service_error_to_http(exc) from exc
        v = db.get(FeedbackIterVersion, version_id)
        if v is None or v.session_id != session_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="version not found")
        return {
            "version_id": str(v.id),
            "version_number": v.version_number,
            "parent_version_id": str(v.parent_version_id) if v.parent_version_id else None,
            "diff": list(v.diff_json or []),
        }

    # ── Assumptions (list + resolve) ────────────────────────────────

    @router.get(
        "/iterate/sessions/{session_id}/assumptions",
        response_model=list[IterAssumptionRead],
    )
    def list_assumptions(
        session_id: Annotated[uuid.UUID, Path()],
        db: SessionDep,
        user: UserDep,
    ) -> list[IterAssumptionRead]:
        try:
            rows = service.list_assumptions(
                db, session_id=session_id, caller=_caller_from(user, deps)
            )
        except IterServiceError as exc:
            raise _service_error_to_http(exc) from exc
        return [_to_assumption_read(r) for r in rows]

    @router.patch(
        "/iterate/assumptions/{assumption_id}",
        response_model=IterAssumptionRead,
    )
    def resolve_assumption(
        assumption_id: Annotated[uuid.UUID, Path()],
        body: IterAssumptionResolveRequest,
        db: SessionDep,
        user: UserDep,
    ) -> IterAssumptionRead:
        new_status = FeedbackIterAssumptionStatus(body.status)
        try:
            row = service.resolve_assumption(
                db,
                assumption_id=assumption_id,
                new_status=new_status,
                user_response=body.user_response,
                caller=_caller_from(user, deps),
            )
        except IterServiceError as exc:
            raise _service_error_to_http(exc) from exc
        return _to_assumption_read(row)

    # ── Calls audit (admin-only) ────────────────────────────────────

    @router.get(
        "/iterate/sessions/{session_id}/calls",
        response_model=list[IterCallRead],
    )
    def list_calls(
        session_id: Annotated[uuid.UUID, Path()],
        db: SessionDep,
        user: UserDep,
    ) -> list[IterCallRead]:
        try:
            rows = service.list_calls(
                db, session_id=session_id, caller=_caller_from(user, deps)
            )
        except IterServiceError as exc:
            raise _service_error_to_http(exc) from exc
        return [_to_call_read(r) for r in rows]

    # ── Finalize + package download ─────────────────────────────────

    @router.post(
        "/iterate/sessions/{session_id}/finalize",
        response_model=IterPackageRead,
    )
    def finalize_session(
        session_id: Annotated[uuid.UUID, Path()],
        body: IterFinalizeRequest,
        db: SessionDep,
        user: UserDep,
        background_tasks: BackgroundTasks,
    ) -> IterPackageRead:
        del body  # reserved for future per-finalize knobs
        try:
            package = service.finalize_session(
                db,
                session_id=session_id,
                caller=_caller_from(user, deps),
            )
        except IterServiceError as exc:
            raise _service_error_to_http(exc) from exc

        presigned = service._storage.presigned_url(
            key=package.minio_zip_key,
        )

        if settings.ITER_NOTIFY_ON_FINALIZE:
            _enqueue_finalize_email(
                db=db,
                background_tasks=background_tasks,
                package=package,
                user=user,
                deps=deps,
                settings=settings,
                presigned_zip_url=presigned,
            )

        return _to_package_read(package, presigned)

    @router.get(
        "/iterate/sessions/{session_id}/package",
        response_model=IterPackageRead,
    )
    def get_package(
        session_id: Annotated[uuid.UUID, Path()],
        db: SessionDep,
        user: UserDep,
    ) -> IterPackageRead:
        try:
            service.get_session(
                db,
                session_id=session_id,
                caller=_caller_from(user, deps),
            )
        except IterServiceError as exc:
            raise _service_error_to_http(exc) from exc
        from sqlalchemy import select
        package = db.execute(
            select(FeedbackIterPackage).where(
                FeedbackIterPackage.session_id == session_id
            )
        ).scalar_one_or_none()
        if package is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                detail="session is not finalized",
            )
        presigned = service._storage.presigned_url(
            key=package.minio_zip_key,
        )
        return _to_package_read(package, presigned)

    # ── Usage ───────────────────────────────────────────────────────

    @router.get("/iterate/usage/me", response_model=IterUsageRead)
    def get_my_usage(
        db: SessionDep,
        user: UserDep,
    ) -> IterUsageRead:
        from feedback_widget.iter_rate_limit import IterRateLimiter
        rl: IterRateLimiter = service.rate_limiter
        used = rl._sql_user_week_count(db, user.user_id)
        limit = settings.ITER_MAX_CALLS_PER_USER_WEEK
        reset_seconds = rl._user_week_reset_seconds(db, user.user_id)
        return IterUsageRead(
            user_id=user.user_id,
            used_this_week=used,
            weekly_limit=limit,
            remaining_this_week=max(0, limit - used),
            window_resets_at=datetime.now(UTC) + timedelta(seconds=reset_seconds),
        )

    return router


# ────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────


def _format_error_event(error_code: str, message: str) -> bytes:
    payload = json.dumps({"type": "error", "error_code": error_code, "message": message})
    return f"event: error\ndata: {payload}\n\n".encode()


def _enqueue_finalize_email(
    *,
    db: Session,
    background_tasks: BackgroundTasks,
    package: FeedbackIterPackage,
    user: CurrentUserSnapshot,
    deps: WidgetDependencies,
    settings: FeedbackSettings,
    presigned_zip_url: str,
) -> None:
    feedback = db.get(Feedback, package_to_feedback_id(db, package))
    if feedback is None:
        logger.warning("finalize email skipped: feedback not found")
        return
    s = db.get(FeedbackIterSession, package.session_id)
    if s is None:
        return
    from sqlalchemy import select
    version_count = (
        db.execute(
            select(FeedbackIterVersion).where(FeedbackIterVersion.session_id == s.id)
        )
        .scalars()
        .all()
    )
    call_count = (
        db.execute(
            select(FeedbackIterCall).where(FeedbackIterCall.session_id == s.id)
        )
        .scalars()
        .all()
    )

    email = build_iter_finalized_email(
        feedback=feedback,
        submitter_email=user.email or "",
        version_count=len(version_count),
        call_count=len(call_count),
        model_id=s.model_id,
        consumer_model=settings.ITER_DOWNSTREAM_CONSUMER_MODEL,
        presigned_zip_url=presigned_zip_url,
        deep_link=None,
        brand_name=settings.BRAND_NAME,
    )

    recipients = settings.notify_emails_list
    if not recipients:
        return
    background_tasks.add_task(
        _send_email_safe,
        to=recipients[0],
        cc=recipients[1:],
        subject=email.subject,
        html=email.html_body,
        text=email.text_body,
        settings=settings,
    )
    del deps  # not used here; kept for future per-host hooks


def _send_email_safe(
    *,
    to: str,
    cc: list[str],
    subject: str,
    html: str,
    text: str,
    settings: FeedbackSettings,
) -> None:
    """Background task wrapper that swallows email errors so a
    broken SMTP doesn't block finalize."""
    try:
        send_email(
            to=to,
            cc=cc,
            subject=subject,
            html=html,
            text=text,
            settings=settings,
        )
    except Exception:
        logger.exception("iter finalize email failed (non-fatal)")


def package_to_feedback_id(db: Session, package: FeedbackIterPackage) -> uuid.UUID:
    """Resolve the feedback row id from a package by walking the session."""
    s = db.get(FeedbackIterSession, package.session_id)
    if s is None:
        raise RuntimeError(f"package {package.id} session missing")
    return s.feedback_id
