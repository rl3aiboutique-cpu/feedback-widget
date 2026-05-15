"""FeedbackService — pure-Python business logic for the feedback module.

Responsibilities:

* Submission flow (create + screenshot upload + N user attachments).
* Triage flow (list + get + update_status + delete).
* Per-user rate limit (Postgres-backed; no Redis).
* Server-side redaction of free-text + metadata bundle (defence in depth).

The service is constructed with a SQLModel ``Session`` and a
``StorageBackend``; the router passes both via FastAPI dependency
injection. The service has no FastAPI imports — it is callable from a
job, a CLI, or a test without any HTTP machinery.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, func, select

from feedback_widget.dto import AttachmentUpload, ScreenshotUpload
from feedback_widget.exceptions import (
    FeedbackError,
    FeedbackNotFoundError,
    FeedbackRateLimitExceededError,
)
from feedback_widget.models import (
    AdminActionKind,
    DeletedByRole,
    Feedback,  # alias for FeedbackTicket — keeps existing query sites intact.
    FeedbackAdminAction,
    FeedbackAttachment,
    FeedbackAttachmentKind,
    FeedbackStatus,
    FeedbackTicket,
    FeedbackType,
)
from feedback_widget.redaction import redact_bundle, redact_string
from feedback_widget.schemas import (
    FeedbackAdminActionPayload,
    FeedbackAttachmentRead,
    FeedbackCreatePayload,
    FeedbackRead,
    FeedbackStatusUpdate,
)
from feedback_widget.settings import FeedbackSettings, get_settings
from feedback_widget.storage import StorageBackend

logger = logging.getLogger(__name__)

__all__ = [
    "AttachmentUpload",
    "FeedbackError",
    "FeedbackNotFoundError",
    "FeedbackRateLimitExceededError",
    "FeedbackService",
    "ScreenshotUpload",
]


class FeedbackService:
    """Encapsulates feedback CRUD + rate limit + storage handling.

    Carries the caller's ``tenant_id`` so every query filters explicitly,
    matching the AuthorisationService / ClientService convention. RLS at
    the DB layer is the second line of defence; the explicit filter
    matters because a SELECT issued through a shared SQLAlchemy session
    can outlive the ``after_begin`` GUC reset window.
    """

    def __init__(
        self,
        session: Session,
        storage: StorageBackend,
        tenant_id: uuid.UUID | None = None,
        settings: FeedbackSettings | None = None,
    ) -> None:
        self.session = session
        self.storage = storage
        self.tenant_id = tenant_id
        self.settings = settings or get_settings()

    # ------------------------------------------------------------------
    # Rate limit
    # ------------------------------------------------------------------

    def check_rate_limit(self, user_id: uuid.UUID) -> None:
        """Raise FeedbackRateLimitExceededError if the user has hit the cap."""
        check_user_rate_limit(
            self.session,
            user_id=user_id,
            tenant_id=self.tenant_id,
            settings=self.settings,
        )

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    def create(
        self,
        *,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        payload: FeedbackCreatePayload,
        screenshot: ScreenshotUpload | None,
        attachments: list[AttachmentUpload] | None = None,
    ) -> Feedback:
        """Persist a feedback row + (optional) screenshot + N user attachments.

        Caller MUST run ``check_rate_limit`` first if rate limiting applies.
        """
        attachments = attachments or []
        if screenshot is not None and len(screenshot.content) > self.settings.MAX_SCREENSHOT_BYTES:
            raise FeedbackError(
                f"Screenshot exceeds size cap ({self.settings.MAX_SCREENSHOT_BYTES} bytes)"
            )

        # Server-side redaction (defence-in-depth). The widget redacts
        # client-side before submit, but a malicious or buggy client can
        # ship secrets anyway. Run every free-text field through the
        # redactor.
        redacted_metadata = redact_bundle(payload.metadata_bundle)
        redacted_title = redact_string(payload.title.strip())
        redacted_description = redact_string(payload.description)
        redacted_expected = (
            redact_string(payload.expected_outcome) if payload.expected_outcome else None
        )

        feedback = Feedback(
            tenant_id=tenant_id,
            user_id=user_id,
            type=payload.type,
            ticket_status=FeedbackStatus.OPEN,
            title=redacted_title,
            description=redacted_description,
            expected_outcome=redacted_expected,
            url_captured=payload.url_captured,
            route_name=payload.route_name,
            element_selector=payload.element.selector if payload.element else None,
            element_xpath=payload.element.xpath if payload.element else None,
            element_bounding_box=(payload.element.bounding_box if payload.element else None),
            metadata_bundle=redacted_metadata,
            app_version=payload.app_version,
            git_commit_sha=payload.git_commit_sha,
            user_agent=payload.user_agent,
            # Empty placeholder so the JSONB NOT NULL constraint is met
            # — chat-first tickets get filled progressively by run_turn.
            messages=[],
            auto_context={},
        )

        # Generate the per-tenant ticket code with bounded retry on the
        # ``ix_feedback_tenant_ticket_code`` UNIQUE collision.
        from sqlalchemy.exc import IntegrityError as _IntegrityError

        attempts = 0
        while True:
            feedback.ticket_code = self._generate_ticket_code(tenant_id=tenant_id)
            self.session.add(feedback)
            try:
                self.session.flush()
                break
            except _IntegrityError:
                self.session.rollback()
                attempts += 1
                if attempts >= 3:
                    raise

        if screenshot is not None:
            upload_feedback_attachment(
                self.session,
                self.storage,
                feedback_id=feedback.id,
                tenant_id=tenant_id,
                content=screenshot.content,
                content_type=screenshot.content_type,
                filename=None,
                kind=FeedbackAttachmentKind.SCREENSHOT,
                width=screenshot.width,
                height=screenshot.height,
                settings=self.settings,
            )

        for upload in attachments:
            upload_feedback_attachment(
                self.session,
                self.storage,
                feedback_id=feedback.id,
                tenant_id=tenant_id,
                content=upload.content,
                content_type=upload.content_type,
                filename=upload.filename,
                kind=upload.kind,
                width=upload.width,
                height=upload.height,
                settings=self.settings,
            )

        if screenshot is not None or attachments:
            self.session.flush()

        return feedback

    # ------------------------------------------------------------------
    # Ticketing helpers
    # ------------------------------------------------------------------

    def _generate_ticket_code(self, *, tenant_id: uuid.UUID) -> str:
        """Compute the next ``FB-YYYY-NNNN`` for the given tenant.

        Thin wrapper over :func:`generate_ticket_code` kept for ABI
        stability; the legacy multipart endpoint always passes a real
        ``tenant_id`` so single-tenant behavior is irrelevant here.
        """
        return generate_ticket_code(self.session, tenant_id=tenant_id)

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    def get(self, feedback_id: uuid.UUID) -> Feedback:
        row = self.session.get(Feedback, feedback_id)
        if row is None:
            raise FeedbackNotFoundError(str(feedback_id))
        if self.tenant_id is not None and row.tenant_id != self.tenant_id:
            raise FeedbackNotFoundError(str(feedback_id))
        return row

    def list_attachments(self, feedback_id: uuid.UUID) -> list[FeedbackAttachment]:
        stmt = select(FeedbackAttachment).where(FeedbackAttachment.ticket_id == feedback_id)
        if self.tenant_id is not None:
            stmt = stmt.where(FeedbackAttachment.tenant_id == self.tenant_id)
        run_query = self.session.exec
        return list(run_query(stmt).all())

    def list_mine(
        self,
        *,
        user_id: uuid.UUID,
        limit: int = 25,
    ) -> list[Feedback]:
        """Recent tickets submitted by the given user, newest first.

        Soft-deleted tickets are silently hidden so the user's list
        never surfaces rows they discarded.
        """
        stmt = (
            select(Feedback)
            .where(Feedback.user_id == user_id)
            .where(Feedback.deleted_at.is_(None))  # type: ignore[union-attr]
            .order_by(Feedback.updated_at.desc())  # type: ignore[union-attr]
            .limit(limit)
        )
        if self.tenant_id is not None:
            stmt = stmt.where(Feedback.tenant_id == self.tenant_id)
        run_query = self.session.exec
        return list(run_query(stmt).all())

    def list_(
        self,
        *,
        type_filter: FeedbackType | None = None,
        status_filter: FeedbackStatus | None = None,
        q: str | None = None,
        page: int = 1,
        page_size: int = 25,
        include_deleted: bool = False,
    ) -> tuple[list[Feedback], int]:
        """Tenant-scoped listing for the admin triage view.

        Soft-deleted tickets are hidden by default; pass
        ``include_deleted=True`` to surface them (papelera view).
        """
        page = max(page, 1)
        page_size = max(min(page_size, 200), 1)

        base_stmt = select(Feedback)
        count_stmt = select(func.count(Feedback.id))
        if not include_deleted:
            base_stmt = base_stmt.where(Feedback.deleted_at.is_(None))  # type: ignore[union-attr]
            count_stmt = count_stmt.where(Feedback.deleted_at.is_(None))  # type: ignore[union-attr]
        if self.tenant_id is not None:
            base_stmt = base_stmt.where(Feedback.tenant_id == self.tenant_id)
            count_stmt = count_stmt.where(Feedback.tenant_id == self.tenant_id)
        if type_filter is not None:
            base_stmt = base_stmt.where(Feedback.type == type_filter)
            count_stmt = count_stmt.where(Feedback.type == type_filter)
        if status_filter is not None:
            base_stmt = base_stmt.where(Feedback.ticket_status == status_filter)
            count_stmt = count_stmt.where(Feedback.ticket_status == status_filter)
        if q:
            like = f"%{q.lower()}%"
            base_stmt = base_stmt.where(func.lower(Feedback.title).like(like))
            count_stmt = count_stmt.where(func.lower(Feedback.title).like(like))

        base_stmt = (
            base_stmt.order_by(Feedback.created_at.desc())  # type: ignore[union-attr]
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        run_query = self.session.exec
        rows = list(run_query(base_stmt).all())
        total = run_query(count_stmt).one()
        return rows, total

    def to_read(
        self,
        feedback: Feedback,
        attachments: list[FeedbackAttachment] | None = None,
        sign_urls: bool = False,
    ) -> FeedbackRead:
        """Build the wire DTO from an ORM row.

        When ``sign_urls`` is True, every attachment carries a presigned
        URL valid for ``FEEDBACK_PRESIGNED_TTL_SECONDS``. Both kinds
        (auto-captured screenshot and user-uploaded attachment) are
        signed — the triage UI needs to display all of them.
        """
        attachment_rows = (
            attachments if attachments is not None else self.list_attachments(feedback.id)
        )
        ttl = self.settings.PRESIGNED_TTL_SECONDS
        attachment_dtos: list[FeedbackAttachmentRead] = []
        signable = {
            FeedbackAttachmentKind.SCREENSHOT,
            FeedbackAttachmentKind.USER_ATTACHMENT,
        }
        for a in attachment_rows:
            dto = FeedbackAttachmentRead.model_validate(a)
            if sign_urls and a.kind in signable:
                dto.presigned_url = self.storage.presigned_url(
                    key=a.object_key,
                    expires=ttl,
                    bucket=a.bucket,
                )
            attachment_dtos.append(dto)
        read = FeedbackRead.model_validate(feedback)
        read.attachments = attachment_dtos
        return read

    # ------------------------------------------------------------------
    # Updates
    # ------------------------------------------------------------------

    def update_status(
        self,
        *,
        feedback_id: uuid.UUID,
        triager_id: uuid.UUID,
        update: FeedbackStatusUpdate,
    ) -> Feedback:
        feedback = self.get(feedback_id)
        was_open = feedback.ticket_status == FeedbackStatus.OPEN

        feedback.ticket_status = update.status
        feedback.updated_at = datetime.now(UTC)
        if update.triage_note is not None:
            feedback.triage_note = update.triage_note
        if was_open and update.status != FeedbackStatus.OPEN:
            feedback.triaged_by = triager_id
            feedback.triaged_at = datetime.now(UTC)
        if update.status in (
            FeedbackStatus.RESOLVED,
            FeedbackStatus.WONT_FIX,
            FeedbackStatus.CLOSED,
        ):
            feedback.closed_at = datetime.now(UTC)

        self.session.add(feedback)
        self.session.flush()
        return feedback

    # ------------------------------------------------------------------
    # Admin actions (S3 — state changes + message injections)
    # ------------------------------------------------------------------

    def apply_admin_action(
        self,
        *,
        feedback_id: uuid.UUID,
        admin_user_id: uuid.UUID,
        payload: FeedbackAdminActionPayload,
    ) -> Feedback:
        """Apply an admin action atomically: optionally transition the
        ticket status AND/OR inject a message into the conversation.

        Updates ``feedback_ticket.messages`` (append role=admin entry),
        ``feedback_ticket.user_action_required`` (true when
        ``to_status=waiting_for_user``), ``last_admin_msg_at``, and
        records a forensic row in ``feedback_admin_action``.
        """
        from sqlalchemy.orm.attributes import flag_modified

        feedback = self.get(feedback_id)
        if feedback.deleted_at is not None:
            raise FeedbackNotFoundError(str(feedback_id))

        now = datetime.now(UTC)
        from_status = feedback.ticket_status.value
        to_status: str | None = None

        if payload.to_status is not None:
            feedback.ticket_status = payload.to_status
            to_status = payload.to_status.value
            if payload.to_status == FeedbackStatus.WAITING_FOR_USER:
                feedback.user_action_required = True
            if payload.to_status in (
                FeedbackStatus.RESOLVED,
                FeedbackStatus.WONT_FIX,
                FeedbackStatus.CLOSED,
            ):
                feedback.closed_at = now

        message_text: str | None = None
        if payload.message_text:
            message_text = redact_string(payload.message_text.strip())
            if feedback.messages is None:
                feedback.messages = []
            feedback.messages.append(
                {
                    "role": "admin",
                    "text": message_text,
                    "ts": now.isoformat(),
                    "author_user_id": str(admin_user_id),
                }
            )
            flag_modified(feedback, "messages")
            feedback.last_admin_msg_at = now
            feedback.user_action_required = True

        feedback.updated_at = now
        self.session.add(feedback)

        action_kind = AdminActionKind.STATE_CHANGE
        if payload.to_status and payload.message_text:
            action_kind = AdminActionKind.STATE_CHANGE_WITH_MESSAGE
        elif payload.message_text:
            action_kind = AdminActionKind.MESSAGE_INJECTION

        action_row = FeedbackAdminAction(
            ticket_id=feedback.id,
            tenant_id=feedback.tenant_id,
            admin_user_id=admin_user_id,
            kind=action_kind,
            from_status=from_status,
            to_status=to_status,
            message_text=message_text,
        )
        self.session.add(action_row)
        self.session.flush()
        return feedback

    # ------------------------------------------------------------------
    # Soft delete + restore
    # ------------------------------------------------------------------

    def soft_delete(
        self,
        *,
        feedback_id: uuid.UUID,
        current_user_id: uuid.UUID,
        role: DeletedByRole,
    ) -> Feedback:
        """Mark the ticket as soft-deleted. Caller MUST check ownership
        for user-role deletions before invoking this — the service
        trusts the role hint."""
        feedback = self.get(feedback_id)
        if feedback.deleted_at is not None:
            return feedback  # idempotent
        now = datetime.now(UTC)
        feedback.deleted_at = now
        feedback.deleted_by_user_id = current_user_id
        feedback.deleted_by_role = role
        feedback.updated_at = now
        self.session.add(feedback)

        if role == DeletedByRole.ADMIN:
            self.session.add(
                FeedbackAdminAction(
                    ticket_id=feedback.id,
                    tenant_id=feedback.tenant_id,
                    admin_user_id=current_user_id,
                    kind=AdminActionKind.SOFT_DELETE,
                )
            )
        self.session.flush()
        return feedback

    def restore(self, *, feedback_id: uuid.UUID, admin_user_id: uuid.UUID) -> Feedback:
        """Undo a soft delete (admin-only)."""
        feedback = self.session.get(Feedback, feedback_id)
        if feedback is None:
            raise FeedbackNotFoundError(str(feedback_id))
        if self.tenant_id is not None and feedback.tenant_id != self.tenant_id:
            raise FeedbackNotFoundError(str(feedback_id))
        if feedback.deleted_at is None:
            return feedback
        feedback.deleted_at = None
        feedback.deleted_by_user_id = None
        feedback.deleted_by_role = None
        feedback.updated_at = datetime.now(UTC)
        self.session.add(feedback)
        self.session.add(
            FeedbackAdminAction(
                ticket_id=feedback.id,
                tenant_id=feedback.tenant_id,
                admin_user_id=admin_user_id,
                kind=AdminActionKind.RESTORE,
            )
        )
        self.session.flush()
        return feedback

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    def delete(self, feedback_id: uuid.UUID) -> None:
        """Hard-delete the feedback row + cascade to attachments + storage."""
        feedback = self.get(feedback_id)
        attachments = self.list_attachments(feedback_id)

        # Storage cleanup is best-effort. We catch only the S3-shaped
        # transient errors so the DB delete can still proceed when
        # MinIO is down — the orphaned object is far less harmful than
        # a zombie row that admin can't get rid of. **Bug-shaped
        # exceptions (TypeError, AttributeError, ValueError) bubble up
        # so silent regressions surface in tests** rather than letting
        # the storage call fail mysteriously and leave orphaned objects
        # forever.
        from botocore.exceptions import BotoCoreError, ClientError

        orphaned: list[tuple[str, str]] = []
        for a in attachments:
            try:
                self.storage.delete(a.object_key, bucket=a.bucket)
            except (BotoCoreError, ClientError):
                logger.exception(
                    "feedback storage delete failed: bucket=%s key=%s — orphaned object",
                    a.bucket,
                    a.object_key,
                )
                orphaned.append((a.bucket, a.object_key))
                continue

        if orphaned:
            # Surface a single summary line so a sweep job can grep for
            # this string and reconcile orphaned objects. The DB row is
            # still being deleted (zombie row > orphaned object) but the
            # admin should see this, not just discover it months later.
            logger.warning(
                "feedback delete: %d S3 object(s) orphaned for feedback_id=%s tenant_id=%s: %s",
                len(orphaned),
                feedback_id,
                feedback.tenant_id,
                ", ".join(f"{b}/{k}" for b, k in orphaned),
            )

        # FK ON DELETE CASCADE removes the attachment + comment rows.
        self.session.delete(feedback)
        self.session.flush()

    # NOTE: ``feedback_comment`` was removed in the 2026-05-16
    # unification. Admin messages now live inside the ticket's
    # ``messages`` JSONB as ``role="admin"`` entries — see
    # :meth:`apply_admin_action`. User replies after admin injection
    # flow through ``ChatService.run_turn`` like any other chat turn.


# ──────────────────────────────────────────────────────────────────────
# Module-level helpers
#
# These functions are the single source of truth for cross-flow
# concerns (ticket code generation, rate limiting, attachment upload).
# Both the legacy multipart endpoint (FeedbackService.create) and the
# chat-first confirm path (chat_service.confirm_session) call into
# them, so behavior stays identical regardless of how the feedback
# row was produced.
# ──────────────────────────────────────────────────────────────────────


def _screenshot_object_key(feedback_id: uuid.UUID) -> str:
    """``feedback/yyyy/mm/dd/{feedback_id}/{uuid}.png``."""
    now = datetime.now(UTC)
    return (
        f"feedback/{now.year:04d}/{now.month:02d}/{now.day:02d}/"
        f"{feedback_id}/{uuid.uuid4()}.png"
    )


def _attachment_object_key(feedback_id: uuid.UUID, safe_filename: str) -> str:
    """``feedback/yyyy/mm/dd/{feedback_id}/attachments/{uuid}-{safe_filename}``."""
    now = datetime.now(UTC)
    return (
        f"feedback/{now.year:04d}/{now.month:02d}/{now.day:02d}/"
        f"{feedback_id}/attachments/{uuid.uuid4()}-{safe_filename}"
    )


def generate_ticket_code(
    session: Session,
    *,
    tenant_id: uuid.UUID | None,
) -> str:
    """Compute the next ``FB-YYYY-NNNN`` for the given tenant.

    ``tenant_id=None`` maps to ``IS NULL`` so single-tenant hosts share
    one sequence. Race-safe: the UNIQUE index
    ``ix_feedback_tenant_ticket_code`` raises on collision and the
    caller can retry.
    """
    year = datetime.now(UTC).year
    prefix = f"FB-{year}-"
    stmt = select(func.max(Feedback.ticket_code)).where(
        Feedback.ticket_code.like(f"{prefix}%")  # type: ignore[attr-defined]
    )
    if tenant_id is None:
        stmt = stmt.where(Feedback.tenant_id.is_(None))  # type: ignore[attr-defined]
    else:
        stmt = stmt.where(Feedback.tenant_id == tenant_id)
    max_code = session.exec(stmt).one_or_none()
    if max_code:
        try:
            next_seq = int(max_code.split("-")[-1]) + 1
        except (ValueError, IndexError):
            next_seq = 1
    else:
        next_seq = 1
    return f"{prefix}{next_seq:04d}"


def check_user_rate_limit(
    session: Session,
    *,
    user_id: uuid.UUID,
    tenant_id: uuid.UUID | None,
    settings: FeedbackSettings,
) -> None:
    """Raise :class:`FeedbackRateLimitExceededError` if the user has
    hit ``settings.RATE_LIMIT_PER_HOUR`` in the trailing hour."""
    cap = settings.RATE_LIMIT_PER_HOUR
    window = timedelta(hours=1)
    now = datetime.now(UTC)
    cutoff = now - window
    count_stmt = (
        select(func.count(Feedback.id))
        .where(Feedback.user_id == user_id)
        .where(Feedback.created_at >= cutoff)
    )
    oldest_stmt = (
        select(func.min(Feedback.created_at))
        .where(Feedback.user_id == user_id)
        .where(Feedback.created_at >= cutoff)
    )
    if tenant_id is not None:
        count_stmt = count_stmt.where(Feedback.tenant_id == tenant_id)
        oldest_stmt = oldest_stmt.where(Feedback.tenant_id == tenant_id)
    count = session.exec(count_stmt).one()
    if count < cap:
        return
    oldest = session.exec(oldest_stmt).one()
    if oldest is None:
        raise FeedbackRateLimitExceededError(
            retry_after_seconds=int(window.total_seconds())
        )
    retry_after = int((oldest + window - now).total_seconds())
    raise FeedbackRateLimitExceededError(retry_after_seconds=max(retry_after, 1))


def upload_feedback_attachment(
    session: Session,
    storage: StorageBackend,
    *,
    feedback_id: uuid.UUID,
    tenant_id: uuid.UUID | None,
    content: bytes,
    content_type: str,
    filename: str | None,
    kind: FeedbackAttachmentKind,
    width: int | None,
    height: int | None,
    settings: FeedbackSettings,
) -> FeedbackAttachment:
    """Upload bytes to the configured bucket and create the matching
    :class:`FeedbackAttachment` row. The row is added to the session;
    caller flushes."""
    if kind == FeedbackAttachmentKind.SCREENSHOT:
        object_key = _screenshot_object_key(feedback_id)
    else:
        safe = filename or "attachment"
        object_key = _attachment_object_key(feedback_id, safe)
    storage.upload(
        key=object_key,
        data=content,
        content_type=content_type,
        bucket=settings.BUCKET,
    )
    row = FeedbackAttachment(
        ticket_id=feedback_id,
        tenant_id=tenant_id,
        kind=kind,
        bucket=settings.BUCKET,
        object_key=object_key,
        content_type=content_type,
        byte_size=len(content),
        filename=filename,
        width=width,
        height=height,
    )
    session.add(row)
    return row
