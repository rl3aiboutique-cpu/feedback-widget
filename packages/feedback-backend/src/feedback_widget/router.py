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
from feedback_widget.models import FeedbackStatus, FeedbackType
from feedback_widget.schemas import (
    FeedbackCommentCreatePayload,
    FeedbackCommentListResponse,
    FeedbackCommentRead,
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

    @router.post(
        "",
        response_model=FeedbackRead,
        status_code=status.HTTP_201_CREATED,
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    "multipart/form-data": {
                        "schema": {
                            "type": "object",
                            "required": ["payload"],
                            "properties": {
                                "payload": {
                                    "type": "string",
                                    "description": "JSON-encoded FeedbackCreatePayload",
                                },
                                "screenshot": {
                                    "type": "string",
                                    "format": "binary",
                                    "nullable": True,
                                    "description": "Auto-captured page screenshot.",
                                },
                                "attachments": {
                                    "type": "array",
                                    "items": {
                                        "type": "string",
                                        "format": "binary",
                                    },
                                    "description": (
                                        "Up to 5 user-uploaded files (images, PDF, text, logs)."
                                    ),
                                },
                            },
                        }
                    }
                },
            }
        },
    )
    async def create_feedback(
        background: BackgroundTasks,
        response: Response,
        session: Session = SessionDep,
        current_user: CurrentUserSnapshot = UserDep,
        s3: StorageBackend = StorageDep,
        cfg: FeedbackSettings = SettingsDep,
        form: FormData = Depends(parse_feedback_form),
    ) -> FeedbackRead:
        """Submit one feedback row + optional screenshot + N user attachments."""
        try:
            if not cfg.ENABLED:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Feedback widget is disabled in this environment.",
                )

            payload_value = form.get("payload")
            if not isinstance(payload_value, str):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=[
                        {
                            "type": "missing",
                            "loc": ["body", "payload"],
                            "msg": "Field required",
                            "input": None,
                        }
                    ],
                )
            payload: str = payload_value
            screenshot_value = form.get("screenshot")
            screenshot: StarletteUploadFile | None = (
                screenshot_value if isinstance(screenshot_value, StarletteUploadFile) else None
            )
            attachment_values = form.getlist("attachments")
            attachment_uploads: list[StarletteUploadFile] = [
                v for v in attachment_values if isinstance(v, StarletteUploadFile)
            ]

            try:
                parsed = FeedbackCreatePayload.model_validate_json(payload)
            except ValidationError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=exc.errors(),
                ) from exc

            screenshot_upload = await read_screenshot(screenshot, settings=cfg)
            attachments_uploaded = await read_attachments(attachment_uploads, settings=cfg)

            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=current_user.tenant_id,
                settings=cfg,
            )

            try:
                service.check_rate_limit(current_user.user_id)
            except FeedbackRateLimitExceededError as exc:
                response.headers["Retry-After"] = str(exc.retry_after_seconds)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=str(exc),
                    headers={"Retry-After": str(exc.retry_after_seconds)},
                ) from exc

            try:
                feedback = service.create(
                    tenant_id=current_user.tenant_id,
                    user_id=current_user.user_id,
                    payload=parsed,
                    screenshot=screenshot_upload,
                    attachments=attachments_uploaded,
                )
            except FeedbackError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                ) from exc

            session.commit()
            session.refresh(feedback)

            attachment_rows = service.list_attachments(feedback.id)
            screenshot_row = next(
                (a for a in attachment_rows if a.kind.value == "screenshot"),
                None,
            )
            presigned_url: str | None = None
            if screenshot_row is not None:
                presigned_url = s3.presigned_url(
                    key=screenshot_row.object_key,
                    expires=cfg.PRESIGNED_TTL_SECONDS,
                    bucket=screenshot_row.bucket,
                )
            extra_attachment_count = sum(
                1 for a in attachment_rows if a.kind.value == "user_attachment"
            )

            subject, html, text_body = build_feedback_email(
                feedback=feedback,
                submitter_email=current_user.email or "(unknown)",
                presigned_url=presigned_url,
                extra_attachment_count=extra_attachment_count,
                settings=cfg,
            )

            enqueue_notification(
                background,
                feedback_id=feedback.id,
                feedback_snapshot_subject=subject,
                html=html,
                text=text_body,
                screenshot_bytes=screenshot_upload.content if screenshot_upload else None,
                screenshot_content_type=(
                    screenshot_upload.content_type if screenshot_upload else None
                ),
                settings=cfg,
            )

            return service.to_read(feedback, attachments=attachment_rows, sign_urls=True)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("create_feedback failed unexpectedly")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

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
                FeedbackStatus.DONE,
                FeedbackStatus.WONT_FIX,
                FeedbackStatus.TRIAGED,
                FeedbackStatus.IN_PROGRESS,
            )
            if feedback.status in notify_states:
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
    # GET /{id}/comments — list (submitter for own ticket OR MASTER_ADMIN)
    # ────────────────────────────────────────────────────────────────

    @router.get("/{feedback_id}/comments", response_model=FeedbackCommentListResponse)
    def list_feedback_comments(
        feedback_id: uuid.UUID,
        session: Session = SessionDep,
        current_user: CurrentUserSnapshot = UserDep,
        s3: StorageBackend = StorageDep,
        cfg: FeedbackSettings = SettingsDep,
    ) -> FeedbackCommentListResponse:
        try:
            is_admin = deps.auth.is_master_admin(current_user)
            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=current_user.tenant_id,
                settings=cfg,
            )
            try:
                rows = service.list_comments(
                    feedback_id=feedback_id,
                    is_admin=is_admin,
                    current_user_id=current_user.user_id,
                )
            except FeedbackNotFoundError as exc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
                ) from exc
            data = [FeedbackCommentRead.model_validate(r) for r in rows]
            return FeedbackCommentListResponse(data=data, count=len(data))
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("list_feedback_comments failed (id=%s)", feedback_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    # ────────────────────────────────────────────────────────────────
    # POST /{id}/comments — append (submitter for own OR MASTER_ADMIN)
    # ────────────────────────────────────────────────────────────────

    @router.post(
        "/{feedback_id}/comments",
        response_model=FeedbackCommentRead,
        status_code=status.HTTP_201_CREATED,
    )
    def create_feedback_comment(
        feedback_id: uuid.UUID,
        body: FeedbackCommentCreatePayload,
        session: Session = SessionDep,
        current_user: CurrentUserSnapshot = UserDep,
        s3: StorageBackend = StorageDep,
        cfg: FeedbackSettings = SettingsDep,
    ) -> FeedbackCommentRead:
        try:
            is_admin = deps.auth.is_master_admin(current_user)
            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=current_user.tenant_id,
                settings=cfg,
            )
            try:
                comment = service.create_comment(
                    feedback_id=feedback_id,
                    is_admin=is_admin,
                    current_user_id=current_user.user_id,
                    payload=body,
                )
            except FeedbackNotFoundError as exc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
                ) from exc
            except FeedbackError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
                ) from exc

            session.commit()
            session.refresh(comment)
            return FeedbackCommentRead.model_validate(comment)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("create_feedback_comment failed (id=%s)", feedback_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    return router
