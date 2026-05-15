"""FastAPI router factory for the feedback widget.

Endpoints (under whatever prefix the host passes to
:func:`register_feedback_router`, default ``/feedback``):

* ``POST   /``                 — create (any authenticated)
* ``GET    /``                 — list, filterable (MASTER_ADMIN)
* ``GET    /{id}``             — detail with presigned attachment URLs (MASTER_ADMIN)
* ``GET    /{id}/download``    — LLM-handoff ZIP (MASTER_ADMIN)
* ``PATCH  /{id}/status``      — change status / triage note (MASTER_ADMIN)
* ``DELETE /{id}``             — hard delete + storage cleanup (MASTER_ADMIN)
* ``GET    /mine``             — submitter's own recent rows
* ``GET    /health``           — version check

This module exposes :func:`build_router` rather than a module-level
``router`` because every host configures its own auth adapter, engine,
and settings via :func:`feedback_widget.register_feedback_router`. The
factory closes over those values so the same widget can run inside
multiple FastAPI apps in the same process.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Response,
    status,
)
from pydantic import ValidationError
from sqlmodel import Session
from starlette.datastructures import FormData
from starlette.datastructures import UploadFile as StarletteUploadFile

from feedback_widget.auth import CurrentUserSnapshot
from feedback_widget.bundle import _bundle_filename, build_feedback_bundle
from feedback_widget.deps import WidgetDependencies
from feedback_widget.email.render import (
    build_feedback_email,
    build_status_transition_email,
)
from feedback_widget.exceptions import (
    FeedbackError,
    FeedbackNotFoundError,
    FeedbackRateLimitExceededError,
)
from feedback_widget.helpers import (
    enqueue_notification,
    parse_feedback_form,
    read_attachments,
    read_screenshot,
)
from feedback_widget.models import DeletedByRole, FeedbackStatus, FeedbackType
from feedback_widget.schemas import (
    FeedbackAdminActionPayload,
    FeedbackCreatePayload,
    FeedbackListResponse,
    FeedbackRead,
    FeedbackStatusUpdate,
)
from feedback_widget.service import FeedbackService
from feedback_widget.settings import FeedbackSettings
from feedback_widget.storage import StorageBackend

logger = logging.getLogger(__name__)


def build_router(
    *,
    deps: WidgetDependencies,
    settings: FeedbackSettings,
    storage: StorageBackend,
) -> APIRouter:
    """Build the feedback APIRouter with host-provided dependencies.

    Use :func:`feedback_widget.register_feedback_router` instead of this
    function in normal code; this factory is exposed for advanced cases
    (custom prefix, conditional inclusion, multi-app processes).
    """

    router = APIRouter(tags=["feedback"])

    # FastAPI resolves dependencies via parameter *default values* (the
    # classic `param: T = Depends(callable)` pattern). Using
    # ``Annotated[T, Depends(...)]`` declared inside this closure does
    # NOT work — FastAPI's introspection treats the metadata as opaque
    # and the param shows up as a plain query parameter.
    SessionDep = Depends(deps.get_session)
    UserDep = Depends(deps.get_current_user)
    AdminDep = Depends(deps.get_current_admin)
    StorageDep = Depends(lambda: storage)
    SettingsDep = Depends(deps.get_settings)

    # ────────────────────────────────────────────────────────────────
    # Health endpoint — sanity-check from the host & smoke tests
    # ────────────────────────────────────────────────────────────────

    @router.get("/health", response_model=dict[str, str | bool])
    def health() -> dict[str, str | bool]:
        from feedback_widget import __version__

        return {"ok": True, "version": __version__}

    # ────────────────────────────────────────────────────────────────
    # POST / — create (any authenticated)
    # ────────────────────────────────────────────────────────────────

    # ────────────────────────────────────────────────────────────────
    # NOTE: ``POST /feedback`` (legacy multipart submission) was
    # removed in the 2026-05-16 unification. Tickets now originate
    # exclusively from the chat-first flow:
    #
    #   POST /feedback/chat/sessions            — create the ticket
    #   POST /feedback/chat/sessions/{sid}/attachments
    #                                            — upload screenshot/files
    #   POST /feedback/chat/sessions/{sid}/messages
    #                                            — discovery turns
    #   POST /feedback/chat/sessions/{sid}/confirm
    #                                            — close the capture
    #
    # The legacy entry point is gone on purpose; the target state
    # requires every ticket to carry a conversation.
    # ────────────────────────────────────────────────────────────────

    # ────────────────────────────────────────────────────────────────
    # GET / — list (MASTER_ADMIN)
    # ────────────────────────────────────────────────────────────────

    @router.get("", response_model=FeedbackListResponse)
    def list_feedback(
        session: Session = SessionDep,
        s3: StorageBackend = StorageDep,
        admin: CurrentUserSnapshot = AdminDep,
        cfg: FeedbackSettings = SettingsDep,
        type_filter: FeedbackType | None = Query(default=None, alias="type"),
        status_filter: FeedbackStatus | None = Query(default=None, alias="status"),
        q: str | None = Query(default=None, max_length=200),
        page: int = Query(default=1, ge=1),
        page_size: int = Query(default=25, ge=1, le=200),
        include_deleted: bool = Query(default=False),
    ) -> FeedbackListResponse:
        try:
            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=admin.tenant_id,
                settings=cfg,
            )
            rows, total = service.list_(
                type_filter=type_filter,
                status_filter=status_filter,
                q=q,
                page=page,
                page_size=page_size,
                include_deleted=include_deleted,
            )
            data = [service.to_read(r, sign_urls=False) for r in rows]
            return FeedbackListResponse(data=data, count=total, page=page, page_size=page_size)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("list_feedback failed unexpectedly")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    # ────────────────────────────────────────────────────────────────
    # GET /mine — declared BEFORE /{id}
    # ────────────────────────────────────────────────────────────────

    @router.get("/mine", response_model=list[FeedbackRead])
    def list_my_feedback(
        session: Session = SessionDep,
        current_user: CurrentUserSnapshot = UserDep,
        s3: StorageBackend = StorageDep,
        cfg: FeedbackSettings = SettingsDep,
        limit: int = Query(default=25, ge=1, le=100),
    ) -> list[FeedbackRead]:
        try:
            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=current_user.tenant_id,
                settings=cfg,
            )
            rows = service.list_mine(user_id=current_user.user_id, limit=limit)
            # Sign URLs so the submitter can preview their own
            # screenshots + attachments without going through admin
            # triage. The list is already user-scoped.
            return [service.to_read(r, sign_urls=True) for r in rows]
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("list_my_feedback failed unexpectedly")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    # ────────────────────────────────────────────────────────────────
    # GET /mine/{id}/download — same LLM-handoff ZIP as the admin
    # endpoint, scoped to the submitter's own tickets only. Mirrors
    # the v0.4.1 user request: "the download-as-zip function from
    # the feedback admin must be the same as from the feedback
    # client". Same bytes, same iter/ section, same comprehensive
    # metadata — just gated on user_id ownership instead of admin.
    # ────────────────────────────────────────────────────────────────

    @router.get("/mine/{feedback_id}/download")
    def download_my_feedback_bundle(
        feedback_id: uuid.UUID,
        session: Session = SessionDep,
        s3: StorageBackend = StorageDep,
        current_user: CurrentUserSnapshot = UserDep,
        cfg: FeedbackSettings = SettingsDep,
    ) -> Response:
        """Return the full feedback bundle ZIP — submitter's own ticket only."""
        try:
            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=current_user.tenant_id,
                settings=cfg,
            )
            try:
                feedback = service.get(feedback_id)
            except FeedbackNotFoundError as fnf:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf)) from fnf

            # Ownership check — return 404 (not 403) so we don't leak
            # the existence of someone else's ticket id.
            if feedback.user_id != current_user.user_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="feedback not found",
                )

            attachments = service.list_attachments(feedback.id)

            zip_bytes = build_feedback_bundle(
                fb=feedback,
                attachments=attachments,
                storage=s3,
                submitter={
                    "email": current_user.email,
                    "role": current_user.role,
                },
                repo_url=cfg.REPO_URL,
                db=session,
            )
            filename = _bundle_filename(feedback.ticket_code, feedback.created_at)

            logger.info(
                "feedback bundle downloaded by submitter: feedback_id=%s ticket_code=%s by_user=%s",
                feedback.id,
                feedback.ticket_code,
                current_user.user_id,
            )

            return Response(
                content=zip_bytes,
                media_type="application/zip",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception(
                "download_my_feedback_bundle failed unexpectedly (id=%s)",
                feedback_id,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    # ────────────────────────────────────────────────────────────────
    # GET /{id} — detail (MASTER_ADMIN)
    # ────────────────────────────────────────────────────────────────

    @router.get("/{feedback_id}", response_model=FeedbackRead)
    def get_feedback(
        feedback_id: uuid.UUID,
        session: Session = SessionDep,
        s3: StorageBackend = StorageDep,
        admin: CurrentUserSnapshot = AdminDep,
        cfg: FeedbackSettings = SettingsDep,
    ) -> FeedbackRead:
        try:
            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=admin.tenant_id,
                settings=cfg,
            )
            try:
                feedback = service.get(feedback_id)
            except FeedbackNotFoundError as exc:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
            return service.to_read(feedback, sign_urls=True)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("get_feedback failed unexpectedly (id=%s)", feedback_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    # ────────────────────────────────────────────────────────────────
    # GET /{id}/chat — chat session detail (MASTER_ADMIN, Sprint C)
    # ────────────────────────────────────────────────────────────────

    @router.get("/{feedback_id}/chat")
    def get_feedback_chat(
        feedback_id: uuid.UUID,
        session: Session = SessionDep,
        admin: CurrentUserSnapshot = AdminDep,
        cfg: FeedbackSettings = SettingsDep,
    ) -> dict[str, object]:
        """Admin view of the chat session that produced this feedback.

        Returns the conversation transcript (``messages`` JSONB), the
        structured synthesis, the auto_context snapshot, plus the
        ``feedback_chat_call`` audit rows so admins can correlate
        latency / status / prompt versions per turn.

        Returns ``204`` (empty body via 404 detail) when the feedback was
        created via the legacy multipart endpoint (no chat session
        linked). The admin UI uses this signal to hide the "chat" tab.
        """
        from sqlmodel import select as _select

        from feedback_widget.chat_models import (
            FeedbackChatCall,
            FeedbackChatSession,
        )

        try:
            service = FeedbackService(
                session=session,
                storage=storage,
                tenant_id=admin.tenant_id,
                settings=cfg,
            )
            try:
                feedback_row = service.get(feedback_id)
            except FeedbackNotFoundError as exc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
                ) from exc

            chat_session_id = feedback_row.chat_session_id
            if chat_session_id is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="feedback has no chat session",
                )

            chat_row = session.get(FeedbackChatSession, chat_session_id)
            if chat_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="chat session not found",
                )

            calls = list(
                session.exec(
                    _select(FeedbackChatCall)
                    .where(FeedbackChatCall.chat_session_id == chat_session_id)
                    .order_by(FeedbackChatCall.created_at)  # type: ignore[arg-type]
                ).all()
            )

            return {
                "feedback_id": str(feedback_row.id),
                "chat_session_id": str(chat_row.id),
                "mode": chat_row.mode.value,
                "status": chat_row.status.value,
                "messages": chat_row.messages or [],
                "synthesis_json": chat_row.synthesis_json,
                "auto_context": chat_row.auto_context or {},
                "detected_language": chat_row.detected_language,
                "created_at": chat_row.created_at.isoformat()
                if chat_row.created_at
                else None,
                "confirmed_at": chat_row.confirmed_at.isoformat()
                if chat_row.confirmed_at
                else None,
                "abandoned_at": chat_row.abandoned_at.isoformat()
                if chat_row.abandoned_at
                else None,
                "calls": [
                    {
                        "id": str(c.id),
                        "turn_index": c.turn_index,
                        "model_id": c.model_id,
                        "model_provider": c.model_provider,
                        "input_tokens": c.input_tokens,
                        "output_tokens": c.output_tokens,
                        "cost_usd": float(c.cost_usd) if c.cost_usd is not None else None,
                        "latency_ms": c.latency_ms,
                        "status": c.status.value,
                        "attempt_number": c.attempt_number,
                        "error_message": c.error_message,
                        "prompt_sha256": c.prompt_sha256,
                        "prompt_version": c.prompt_version,
                        "created_at": c.created_at.isoformat()
                        if c.created_at
                        else None,
                    }
                    for c in calls
                ],
            }
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception(
                "get_feedback_chat failed unexpectedly (id=%s)", feedback_id
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    # ────────────────────────────────────────────────────────────────
    # GET /{id}/download — LLM-handoff ZIP (MASTER_ADMIN)
    # ────────────────────────────────────────────────────────────────

    @router.get("/{feedback_id}/download")
    def download_feedback_bundle(
        feedback_id: uuid.UUID,
        session: Session = SessionDep,
        s3: StorageBackend = StorageDep,
        admin: CurrentUserSnapshot = AdminDep,
        cfg: FeedbackSettings = SettingsDep,
    ) -> Response:
        """Return a ZIP archive packaging the ticket for an LLM hand-off."""
        try:
            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=admin.tenant_id,
                settings=cfg,
            )
            try:
                feedback = service.get(feedback_id)
            except FeedbackNotFoundError as fnf:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf)) from fnf

            attachments = service.list_attachments(feedback.id)

            zip_bytes = build_feedback_bundle(
                fb=feedback,
                attachments=attachments,
                storage=s3,
                submitter={"email": None, "role": None},
                repo_url=cfg.REPO_URL,
                db=session,
            )
            filename = _bundle_filename(feedback.ticket_code, feedback.created_at)

            logger.info(
                "feedback bundle downloaded: feedback_id=%s ticket_code=%s by_user=%s",
                feedback.id,
                feedback.ticket_code,
                admin.user_id,
            )

            return Response(
                content=zip_bytes,
                media_type="application/zip",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("download_feedback_bundle failed unexpectedly (id=%s)", feedback_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    # ────────────────────────────────────────────────────────────────
    # PATCH /{id}/status — triage (MASTER_ADMIN)
    # ────────────────────────────────────────────────────────────────

    @router.patch("/{feedback_id}/status", response_model=FeedbackRead)
    def update_feedback_status(
        feedback_id: uuid.UUID,
        body: FeedbackStatusUpdate,
        background: BackgroundTasks,
        session: Session = SessionDep,
        s3: StorageBackend = StorageDep,
        admin: CurrentUserSnapshot = AdminDep,
        cfg: FeedbackSettings = SettingsDep,
    ) -> FeedbackRead:
        try:
            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=admin.tenant_id,
                settings=cfg,
            )
            try:
                feedback = service.update_status(
                    feedback_id=feedback_id,
                    triager_id=admin.user_id,
                    update=body,
                )
            except FeedbackNotFoundError as exc:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
            except FeedbackError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
                ) from exc

            session.commit()
            session.refresh(feedback)

            # Informational status-transition email — no magic-link
            # accept/reject. The submitter's email is the one on their
            # current account; if the host doesn't expose an email on
            # CurrentUserSnapshot we just skip the notification.
            notify_states = (
                FeedbackStatus.RESOLVED,
                FeedbackStatus.WONT_FIX,
                FeedbackStatus.IN_REVIEW,
                FeedbackStatus.IN_PROGRESS,
                FeedbackStatus.WAITING_FOR_USER,
                FeedbackStatus.CLOSED,
            )
            if feedback.ticket_status in notify_states:
                # Look up the submitter's email by their user_id is the
                # host's job — the widget doesn't store user records.
                # Hosts that want submitter-facing transition emails
                # implement it via their own observer hook. Out of the
                # box we only mail the NOTIFY_EMAILS list (admin), as
                # an audit trail of what the triage queue is doing.
                recipients = cfg.notify_emails_list
                if recipients:
                    subject, html, text_body = build_status_transition_email(
                        feedback=feedback,
                        settings=cfg,
                    )
                    feedback_id_for_log = feedback.id
                    from feedback_widget.email import send_email

                    def _task() -> None:
                        try:
                            send_email(
                                to=recipients,
                                subject=subject,
                                html=html,
                                text=text_body,
                                settings=cfg,
                            )
                        except (OSError, RuntimeError):
                            logger.exception(
                                "feedback status-transition email failed (id=%s)",
                                feedback_id_for_log,
                            )

                    background.add_task(_task)

            return service.to_read(feedback, sign_urls=True)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("update_feedback_status failed unexpectedly (id=%s)", feedback_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    # ────────────────────────────────────────────────────────────────
    # DELETE /{id} (MASTER_ADMIN)
    # ────────────────────────────────────────────────────────────────

    @router.delete("/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_feedback(
        feedback_id: uuid.UUID,
        session: Session = SessionDep,
        s3: StorageBackend = StorageDep,
        admin: CurrentUserSnapshot = AdminDep,
        cfg: FeedbackSettings = SettingsDep,
    ) -> None:
        try:
            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=admin.tenant_id,
                settings=cfg,
            )
            try:
                service.delete(feedback_id)
            except FeedbackNotFoundError as exc:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
            session.commit()
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("delete_feedback failed unexpectedly (id=%s)", feedback_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    # ────────────────────────────────────────────────────────────────
    # POST /{id}/admin-action — state change + message injection (MASTER_ADMIN)
    # Replaces the legacy comments endpoints (removed 2026-05-16).
    # ────────────────────────────────────────────────────────────────

    @router.post(
        "/{feedback_id}/admin-action",
        response_model=FeedbackRead,
    )
    def post_admin_action(
        feedback_id: uuid.UUID,
        body: FeedbackAdminActionPayload,
        session: Session = SessionDep,
        current_user: CurrentUserSnapshot = AdminDep,
        s3: StorageBackend = StorageDep,
        cfg: FeedbackSettings = SettingsDep,
    ) -> FeedbackRead:
        try:
            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=current_user.tenant_id,
                settings=cfg,
            )
            try:
                feedback = service.apply_admin_action(
                    feedback_id=feedback_id,
                    admin_user_id=current_user.user_id,
                    payload=body,
                )
            except FeedbackNotFoundError as exc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
                ) from exc
            session.commit()
            session.refresh(feedback)
            return service.to_read(feedback, sign_urls=True)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("post_admin_action failed (id=%s)", feedback_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    # ────────────────────────────────────────────────────────────────
    # POST /{id}/restore — undo soft delete (MASTER_ADMIN)
    # ────────────────────────────────────────────────────────────────

    @router.post(
        "/{feedback_id}/restore",
        response_model=FeedbackRead,
    )
    def restore_feedback(
        feedback_id: uuid.UUID,
        session: Session = SessionDep,
        current_user: CurrentUserSnapshot = AdminDep,
        s3: StorageBackend = StorageDep,
        cfg: FeedbackSettings = SettingsDep,
    ) -> FeedbackRead:
        try:
            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=current_user.tenant_id,
                settings=cfg,
            )
            try:
                feedback = service.restore(
                    feedback_id=feedback_id,
                    admin_user_id=current_user.user_id,
                )
            except FeedbackNotFoundError as exc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
                ) from exc
            session.commit()
            session.refresh(feedback)
            return service.to_read(feedback, sign_urls=True)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("restore_feedback failed (id=%s)", feedback_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    return router
