"""FastAPI router factory for the feedback widget.

Endpoints (under whatever prefix the host passes to
:func:`register_feedback_router`, default ``/feedback``):

* ``POST   /``                 — create (any authenticated)
* ``GET    /``                 — list, filterable (MASTER_ADMIN)
* ``GET    /{id}``             — detail with presigned screenshot URL (MASTER_ADMIN)
* ``GET    /{id}/download``    — LLM-handoff ZIP (MASTER_ADMIN)
* ``PATCH  /{id}/status``      — change status / triage note (MASTER_ADMIN)
* ``DELETE /{id}``             — hard delete + storage cleanup (MASTER_ADMIN)
* ``GET    /personas``         — autocomplete source (any authenticated)
* ``GET    /user-stories``     — autocomplete source (any authenticated)
* ``GET    /mine``             — submitter's own recent rows
* ``POST   /action/{token}``   — magic-link accept/reject (PUBLIC — token IS the auth)

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
from pydantic import BaseModel, ValidationError
from sqlalchemy import text
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
    FeedbackTypeRequiresFieldError,
)
from feedback_widget.helpers import (
    enqueue_notification,
    parse_feedback_form,
    read_screenshot,
)
from feedback_widget.models import FeedbackStatus, FeedbackType
from feedback_widget.schemas import (
    FeedbackCreatePayload,
    FeedbackListResponse,
    FeedbackRead,
    FeedbackStatusUpdate,
)
from feedback_widget.service import FeedbackService
from feedback_widget.settings import FeedbackSettings
from feedback_widget.storage import StorageBackend

logger = logging.getLogger(__name__)


class _ActionResponse(BaseModel):
    """Public response for the accept/reject endpoints."""

    status: str
    ticket_code: str
    message: str
    cascade_count: int = 0


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
    # and the param shows up as a plain query parameter. Bound the
    # ``Depends`` objects to module-equivalent locals here and use them
    # as defaults below.
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
        """Submit one feedback row + optional screenshot."""
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
                screenshot_value
                if isinstance(screenshot_value, StarletteUploadFile)
                else None
            )

            try:
                parsed = FeedbackCreatePayload.model_validate_json(payload)
            except ValidationError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=exc.errors(),
                ) from exc

            # Anti-harassment: a submitter MAY only route status-transition
            # notifications to their own account email. Without this an
            # authenticated user could direct the magic-link email to an
            # arbitrary recipient.
            #
            # When the host's CurrentUserSnapshot does not carry an email
            # (e.g. minimal JWTs without the email claim — see ADR-006bis),
            # the widget cannot enforce the match. In that mode we accept
            # whatever the submitter types: the host opted into a more
            # permissive auth surface by not exposing email, and the
            # follow_up_email shape validator (schemas.py) still keeps
            # garbage out.
            if (
                current_user.email is not None
                and parsed.follow_up_email is not None
                and parsed.follow_up_email.strip().lower() != current_user.email.strip().lower()
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "follow_up_email must match the authenticated user's email."
                    ),
                )

            screenshot_upload = await read_screenshot(screenshot, settings=cfg)

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
                )
            except FeedbackTypeRequiresFieldError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"missing_field": exc.field_name, "message": str(exc)},
                ) from exc
            except FeedbackError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                ) from exc

            session.commit()
            session.refresh(feedback)

            attachments = service.list_attachments(feedback.id)
            presigned_url: str | None = None
            if attachments:
                first = attachments[0]
                presigned_url = s3.presigned_url(
                    key=first.object_key,
                    expires=cfg.PRESIGNED_TTL_SECONDS,
                    bucket=first.bucket,
                )

            subject, html, text_body = build_feedback_email(
                feedback=feedback,
                submitter_email=current_user.email,
                presigned_url=presigned_url,
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

            return service.to_read(feedback, attachments=attachments, sign_urls=True)
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
            return FeedbackListResponse(
                data=data, count=total, page=page, page_size=page_size
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("list_feedback failed unexpectedly")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    # ────────────────────────────────────────────────────────────────
    # GET /personas, /user-stories, /mine — declared BEFORE /{id}
    # ────────────────────────────────────────────────────────────────

    @router.get("/personas", response_model=list[str])
    def list_personas(
        session: Session = SessionDep,
        current_user: CurrentUserSnapshot = UserDep,
        s3: StorageBackend = StorageDep,
        cfg: FeedbackSettings = SettingsDep,
        limit: int = Query(default=50, ge=1, le=200),
    ) -> list[str]:
        try:
            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=current_user.tenant_id,
                settings=cfg,
            )
            return service.list_distinct_personas(limit=limit)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("list_personas failed unexpectedly")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    @router.get("/user-stories")
    def list_user_stories(
        session: Session = SessionDep,
        current_user: CurrentUserSnapshot = UserDep,
        s3: StorageBackend = StorageDep,
        cfg: FeedbackSettings = SettingsDep,
        limit: int = Query(default=100, ge=1, le=500),
    ) -> list[dict[str, str | None]]:
        try:
            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=current_user.tenant_id,
                settings=cfg,
            )
            return service.list_distinct_user_stories(limit=limit)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("list_user_stories failed unexpectedly")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

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
            return [service.to_read(r, sign_urls=False) for r in rows]
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
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
                ) from exc
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
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf)
                ) from fnf

            attachments = service.list_attachments(feedback.id)
            parents = (
                service.walk_parent_chain(feedback.parent_feedback_id)
                if feedback.parent_feedback_id is not None
                else []
            )

            # Submitter info: in the package version we use only the
            # follow_up_email recorded on the row. Hosts that want richer
            # submitter metadata (e.g. role / tenant assignment) can extend
            # the bundle in their own integration code.
            submitter_email: str | None = feedback.follow_up_email
            submitter_role: str | None = None

            zip_bytes = build_feedback_bundle(
                fb=feedback,
                attachments=attachments,
                parent_chain=parents,
                storage=s3,
                deep_link_base=cfg.ADMIN_DEEP_LINK_BASE,
                submitter={"email": submitter_email, "role": submitter_role},
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
            logger.exception(
                "download_feedback_bundle failed unexpectedly (id=%s)", feedback_id
            )
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
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
                ) from exc
            except FeedbackError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
                ) from exc

            accept_url: str | None = None
            reject_url: str | None = None
            if feedback.status == FeedbackStatus.DONE:
                token = service.issue_acceptance_token(feedback_id=feedback.id)
                configured_base = cfg.ADMIN_DEEP_LINK_BASE.rstrip("/")
                if not configured_base:
                    logger.warning(
                        "FEEDBACK_ADMIN_DEEP_LINK_BASE is empty — magic-link "
                        "emails will be skipped (no accept/reject URLs)"
                    )
                else:
                    accept_url = f"{configured_base}/feedback/accept?token={token}"
                    reject_url = f"{configured_base}/feedback/reject?token={token}"

            session.commit()
            session.refresh(feedback)

            notify_states = (
                FeedbackStatus.DONE,
                FeedbackStatus.WONT_FIX,
                FeedbackStatus.ACCEPTED_BY_USER,
                FeedbackStatus.REJECTED_BY_USER,
            )
            if (
                feedback.follow_up_email
                and feedback.status in notify_states
                and (feedback.status != FeedbackStatus.DONE or accept_url is not None)
            ):
                subject, html, text_body = build_status_transition_email(
                    feedback=feedback,
                    accept_url=accept_url,
                    reject_url=reject_url,
                    settings=cfg,
                )
                recipient = feedback.follow_up_email
                feedback_id_for_log = feedback.id
                from feedback_widget.email import send_email

                def _task() -> None:
                    if not recipient:
                        return
                    try:
                        send_email(
                            to=[recipient],
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
            logger.exception(
                "update_feedback_status failed unexpectedly (id=%s)", feedback_id
            )
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
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
                ) from exc
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
    # POST /action/{token} — magic-link accept/reject (PUBLIC)
    # ────────────────────────────────────────────────────────────────

    @router.post(
        "/action/{token}",
        response_model=_ActionResponse,
        status_code=status.HTTP_200_OK,
    )
    def consume_action_token(
        token: uuid.UUID,
        action: str = Query(pattern="^(accept|reject)$"),
        session: Session = SessionDep,
        s3: StorageBackend = StorageDep,
        cfg: FeedbackSettings = SettingsDep,
    ) -> _ActionResponse:
        """Apply the user's accept/reject choice via the magic link.

        No tenant filter on the lookup — the token is the sole credential.
        The service enforces single-use (token cleared after consumption).
        """
        try:
            # When the host runs Postgres RLS for multi-tenant isolation,
            # this endpoint has to bypass the tenant GUC because the
            # caller carries no tenant context. ``RESET ROLE`` + ``SET
            # LOCAL row_security = off`` does that; both are scoped to
            # the current transaction. Skip when the host is single-tenant.
            if cfg.MULTI_TENANT_MODE:
                session.execute(text("RESET ROLE"))
                session.execute(text("SET LOCAL row_security = off"))

            service = FeedbackService(
                session=session,
                storage=s3,
                tenant_id=None,
                settings=cfg,
            )
            try:
                feedback = service.consume_acceptance_token(token=token, action=action)
            except FeedbackNotFoundError as exc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="This link is invalid, already used, or has expired.",
                ) from exc
            except FeedbackError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
                ) from exc

            cascade_count = 0
            if action == "accept":
                cur_id = feedback.parent_feedback_id
                seen: set[uuid.UUID] = {feedback.id}
                while cur_id is not None and cur_id not in seen:
                    seen.add(cur_id)
                    parent = session.get(type(feedback), cur_id)
                    if (
                        parent is None
                        or parent.tenant_id != feedback.tenant_id
                        or parent.status != FeedbackStatus.ACCEPTED_BY_USER
                    ):
                        break
                    cascade_count += 1
                    cur_id = parent.parent_feedback_id

            ticket_code = feedback.ticket_code
            session.commit()

            if action == "accept":
                cascade_note = (
                    f" {cascade_count} linked ticket"
                    + ("s" if cascade_count != 1 else "")
                    + " also auto-accepted."
                    if cascade_count
                    else ""
                )
                return _ActionResponse(
                    status="accepted",
                    ticket_code=ticket_code,
                    message=f"Thanks — {ticket_code} is now closed.{cascade_note}",
                    cascade_count=cascade_count,
                )
            return _ActionResponse(
                status="rejected",
                ticket_code=ticket_code,
                message=(
                    f"Got it — {ticket_code} marked as not resolved. "
                    "Please file a follow-up linked to this ticket so we can iterate."
                ),
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception(
                "consume_action_token failed unexpectedly (action=%s)", action
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error.",
            ) from exc

    return router
