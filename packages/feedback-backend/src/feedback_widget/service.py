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
    Feedback,
    FeedbackAttachment,
    FeedbackAttachmentKind,
    FeedbackComment,
    FeedbackCommentAuthorRole,
    FeedbackStatus,
    FeedbackType,
)
from feedback_widget.redaction import redact_bundle, redact_string
from feedback_widget.schemas import (
    FeedbackAttachmentRead,
    FeedbackCommentCreatePayload,
    FeedbackCommentRead,
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
        cap = self.settings.RATE_LIMIT_PER_HOUR
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
        if self.tenant_id is not None:
            count_stmt = count_stmt.where(Feedback.tenant_id == self.tenant_id)
            oldest_stmt = oldest_stmt.where(Feedback.tenant_id == self.tenant_id)
        run_query = self.session.exec
        count = run_query(count_stmt).one()
        if count < cap:
            return

        oldest = run_query(oldest_stmt).one()
        if oldest is None:
            raise FeedbackRateLimitExceededError(retry_after_seconds=int(window.total_seconds()))
        retry_after = int((oldest + window - now).total_seconds())
        raise FeedbackRateLimitExceededError(retry_after_seconds=max(retry_after, 1))

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
            status=FeedbackStatus.NEW,
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
            object_key = self._screenshot_object_key(feedback.id)
            self.storage.upload(
                key=object_key,
                data=screenshot.content,
                content_type=screenshot.content_type,
                bucket=self.settings.BUCKET,
            )
            self.session.add(
                FeedbackAttachment(
                    feedback_id=feedback.id,
                    tenant_id=tenant_id,
                    kind=FeedbackAttachmentKind.SCREENSHOT,
                    bucket=self.settings.BUCKET,
                    object_key=object_key,
                    content_type=screenshot.content_type,
                    byte_size=len(screenshot.content),
                    width=screenshot.width,
                    height=screenshot.height,
                )
            )

        for upload in attachments:
            object_key = self._attachment_object_key(feedback.id, upload.filename)
            self.storage.upload(
                key=object_key,
                data=upload.content,
                content_type=upload.content_type,
                bucket=self.settings.BUCKET,
            )
            self.session.add(
                FeedbackAttachment(
                    feedback_id=feedback.id,
                    tenant_id=tenant_id,
                    kind=upload.kind,
                    bucket=self.settings.BUCKET,
                    object_key=object_key,
                    content_type=upload.content_type,
                    byte_size=len(upload.content),
                    filename=upload.filename,
                    width=upload.width,
                    height=upload.height,
                )
            )

        if screenshot is not None or attachments:
            self.session.flush()

        return feedback

    @staticmethod
    def _screenshot_object_key(feedback_id: uuid.UUID) -> str:
        """``feedback/yyyy/mm/dd/{feedback_id}/{uuid}.png``."""
        now = datetime.now(UTC)
        return (
            f"feedback/{now.year:04d}/{now.month:02d}/{now.day:02d}/"
            f"{feedback_id}/{uuid.uuid4()}.png"
        )

    @staticmethod
    def _attachment_object_key(feedback_id: uuid.UUID, safe_filename: str) -> str:
        """``feedback/yyyy/mm/dd/{feedback_id}/attachments/{uuid}-{safe_filename}``."""
        now = datetime.now(UTC)
        return (
            f"feedback/{now.year:04d}/{now.month:02d}/{now.day:02d}/"
            f"{feedback_id}/attachments/{uuid.uuid4()}-{safe_filename}"
        )

    # ------------------------------------------------------------------
    # Ticketing helpers
    # ------------------------------------------------------------------

    def _generate_ticket_code(self, *, tenant_id: uuid.UUID) -> str:
        """Compute the next ``FB-YYYY-NNNN`` for the given tenant.

        Race-safe: if two concurrent INSERTs see the same max, the
        UNIQUE index ``ix_feedback_tenant_ticket_code`` raises and the
        caller can retry.
        """
        year = datetime.now(UTC).year
        prefix = f"FB-{year}-"
        stmt = (
            select(func.max(Feedback.ticket_code))
            .where(Feedback.tenant_id == tenant_id)
            .where(Feedback.ticket_code.like(f"{prefix}%"))  # type: ignore[attr-defined]
        )
        run_query = self.session.exec
        max_code = run_query(stmt).one_or_none()
        if max_code:
            try:
                next_seq = int(max_code.split("-")[-1]) + 1
            except (ValueError, IndexError):
                next_seq = 1
        else:
            next_seq = 1
        return f"{prefix}{next_seq:04d}"

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
        stmt = select(FeedbackAttachment).where(FeedbackAttachment.feedback_id == feedback_id)
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
        """Recent feedback rows submitted by the given user, newest first."""
        stmt = (
            select(Feedback)
            .where(Feedback.user_id == user_id)
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
    ) -> tuple[list[Feedback], int]:
        """Tenant-scoped listing for the admin triage view."""
        page = max(page, 1)
        page_size = max(min(page_size, 200), 1)

        base_stmt = select(Feedback)
        count_stmt = select(func.count(Feedback.id))
        if self.tenant_id is not None:
            base_stmt = base_stmt.where(Feedback.tenant_id == self.tenant_id)
            count_stmt = count_stmt.where(Feedback.tenant_id == self.tenant_id)
        if type_filter is not None:
            base_stmt = base_stmt.where(Feedback.type == type_filter)
            count_stmt = count_stmt.where(Feedback.type == type_filter)
        if status_filter is not None:
            base_stmt = base_stmt.where(Feedback.status == status_filter)
            count_stmt = count_stmt.where(Feedback.status == status_filter)
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
        was_new = feedback.status == FeedbackStatus.NEW

        feedback.status = update.status
        feedback.updated_at = datetime.now(UTC)
        if update.triage_note is not None:
            feedback.triage_note = update.triage_note
        if was_new and update.status != FeedbackStatus.NEW:
            feedback.triaged_by = triager_id
            feedback.triaged_at = datetime.now(UTC)

        self.session.add(feedback)
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

    # ------------------------------------------------------------------
    # Comments (v0.2.2)
    # ------------------------------------------------------------------

    def list_comments(
        self,
        *,
        feedback_id: uuid.UUID,
        is_admin: bool,
        current_user_id: uuid.UUID,
    ) -> list[FeedbackComment]:
        """Return the conversation thread, oldest first.

        The submitter sees comments only for their own ticket; admin
        sees comments for any ticket in the same tenant. Otherwise
        FeedbackNotFoundError so callers translate to 404.
        """
        feedback = self.get(feedback_id)
        if not is_admin and feedback.user_id != current_user_id:
            raise FeedbackNotFoundError(str(feedback_id))
        stmt = (
            select(FeedbackComment)
            .where(FeedbackComment.feedback_id == feedback_id)
            .order_by(FeedbackComment.created_at.asc())  # type: ignore[union-attr]
        )
        if self.tenant_id is not None:
            stmt = stmt.where(FeedbackComment.tenant_id == self.tenant_id)
        run_query = self.session.exec
        return list(run_query(stmt).all())

    def create_comment(
        self,
        *,
        feedback_id: uuid.UUID,
        is_admin: bool,
        current_user_id: uuid.UUID,
        payload: FeedbackCommentCreatePayload,
    ) -> FeedbackComment:
        """Append a comment to the conversation thread."""
        feedback = self.get(feedback_id)
        if not is_admin and feedback.user_id != current_user_id:
            raise FeedbackNotFoundError(str(feedback_id))
        author_role = (
            FeedbackCommentAuthorRole.ADMIN if is_admin else FeedbackCommentAuthorRole.SUBMITTER
        )
        original = payload.body.strip()
        redacted = redact_string(original)
        if redacted != original:
            # The redactor matched something inside user-typed text. Log
            # so an operator can see when feedback content is being
            # rewritten — the user never sees the diff, so silent
            # rewrites would otherwise be invisible. Don't log the body.
            logger.info(
                "feedback_comment redactor modified user input: feedback_id=%s author=%s "
                "before=%d after=%d",
                feedback_id,
                current_user_id,
                len(original),
                len(redacted),
            )
        comment = FeedbackComment(
            feedback_id=feedback_id,
            tenant_id=feedback.tenant_id,
            author_user_id=current_user_id,
            author_role=author_role,
            body=redacted,
        )
        self.session.add(comment)
        self.session.flush()
        return comment

    @staticmethod
    def comment_to_read(comment: FeedbackComment) -> FeedbackCommentRead:
        return FeedbackCommentRead.model_validate(comment)
