"""FeedbackService — pure-Python business logic for the feedback module.

Responsibilities:

* Submission flow (create + screenshot upload + attachment row).
* Triage flow (list + get + update_status + delete).
* Per-user rate limit (Postgres-backed; no Redis).
* Server-side redaction of the metadata bundle (defence in depth).

The service is constructed with a SQLModel ``Session`` and a
``StorageBackend``; the router passes both via FastAPI dependency
injection. The service has no FastAPI imports — it is callable from a
job, a CLI, or a test without any HTTP machinery.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlmodel import Session, func, select

from feedback_widget.dto import ScreenshotUpload
from feedback_widget.exceptions import (
    FeedbackError,
    FeedbackNotFoundError,
    FeedbackRateLimitExceededError,
    FeedbackTypeRequiresFieldError,
)
from feedback_widget.models import (
    Feedback,
    FeedbackAttachment,
    FeedbackAttachmentKind,
    FeedbackStatus,
    FeedbackType,
)
from feedback_widget.redaction import redact_bundle, redact_string
from feedback_widget.schemas import (
    FeedbackAttachmentRead,
    FeedbackCreatePayload,
    FeedbackRead,
    FeedbackStatusUpdate,
)
from feedback_widget.settings import FeedbackSettings, get_settings
from feedback_widget.storage import StorageBackend

logger = logging.getLogger(__name__)

# Re-export so existing ``from app.feedback.service import FeedbackError``
# call sites keep working. New code should import directly from
# ``app.feedback.exceptions`` and ``app.feedback.dto``.
__all__ = [
    "TYPES_REQUIRING_LINKED_STORIES",
    "TYPES_REQUIRING_PERSONA",
    "TYPE_REQUIRED_FIELDS",
    "FeedbackError",
    "FeedbackNotFoundError",
    "FeedbackRateLimitExceededError",
    "FeedbackService",
    "FeedbackTypeRequiresFieldError",
    "ScreenshotUpload",
]


# ────────────────────────────────────────────────────────────────────
# Type-specific required fields
# ────────────────────────────────────────────────────────────────────

# Service-layer validation in addition to schemas — the JSONB type_fields
# blob is intentionally schemaless at the wire level so the frontend can
# evolve fast in beta. The service holds the contract.
TYPE_REQUIRED_FIELDS: dict[FeedbackType, frozenset[str]] = {
    FeedbackType.BUG: frozenset(
        {"severity", "reproduction_steps", "expected_behavior", "actual_behavior"}
    ),
    FeedbackType.NEW_FEATURE: frozenset(
        {"problem_statement", "proposed_solution", "business_value"}
    ),
    FeedbackType.EXTEND_FEATURE: frozenset(
        {"existing_feature", "gap_today", "proposed_extension", "business_value"}
    ),
    FeedbackType.NEW_USER_STORY: frozenset({"user_story", "acceptance_criteria", "priority"}),
    FeedbackType.QUESTION: frozenset(
        {"what_were_you_trying_to_do", "what_was_unclear", "where_did_you_look_first"}
    ),
    FeedbackType.UX_POLISH: frozenset({"what_feels_off", "suggested_change"}),
    FeedbackType.PERFORMANCE: frozenset(
        {"what_was_slow", "when_did_it_happen", "perceived_duration_seconds"}
    ),
    FeedbackType.DATA_ISSUE: frozenset({"which_record", "expected_data", "actual_data", "impact"}),
}

# Types that require a non-empty persona block. Per spec §"Type 1: Bug",
# Bug also requires a persona — the triager needs to know which actor's
# job broke, not just the symptom. Linked stories are still optional
# for Bug (see TYPES_REQUIRING_LINKED_STORIES).
TYPES_REQUIRING_PERSONA: frozenset[FeedbackType] = frozenset(
    {
        FeedbackType.BUG,
        FeedbackType.NEW_FEATURE,
        FeedbackType.EXTEND_FEATURE,
        FeedbackType.NEW_USER_STORY,
    }
)

# Types that require AT LEAST ONE linked user story. Bug intentionally
# does NOT require stories — bugs are surfaced from real persona pain
# but don't always have a clean "as X I want Y" frame yet.
TYPES_REQUIRING_LINKED_STORIES: frozenset[FeedbackType] = frozenset(
    {
        FeedbackType.NEW_FEATURE,
        FeedbackType.EXTEND_FEATURE,
        FeedbackType.NEW_USER_STORY,
    }
)


class FeedbackService:
    """Encapsulates feedback CRUD + rate limit + screenshot handling.

    Carries the caller's ``tenant_id`` so every query filters explicitly,
    matching the AuthorisationService / ClientService convention. RLS at
    the DB layer is the second line of defence; the explicit filter
    matters because a SELECT issued through a shared SQLAlchemy session
    can outlive the ``after_begin`` GUC reset window (the same trap the
    Block 1 cross-tenant review caught in AuthorisationService).
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
            # Defensive — shouldn't reach the cap with no rows.
            raise FeedbackRateLimitExceededError(retry_after_seconds=int(window.total_seconds()))
        # Seconds until that oldest row falls out of the rolling window.
        retry_after = int((oldest + window - now).total_seconds())
        # Clamp to a non-negative integer.
        raise FeedbackRateLimitExceededError(retry_after_seconds=max(retry_after, 1))

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def validate_payload(self, payload: FeedbackCreatePayload) -> None:
        """Enforce type-specific required fields + persona rules."""
        required = TYPE_REQUIRED_FIELDS.get(payload.type, frozenset())
        for field in sorted(required):
            value = payload.type_fields.get(field)
            if value is None or value == "":
                raise FeedbackTypeRequiresFieldError(field, payload.type)

        if payload.type in TYPES_REQUIRING_PERSONA and not (payload.persona or "").strip():
            raise FeedbackTypeRequiresFieldError("persona", payload.type)

        if payload.type in TYPES_REQUIRING_LINKED_STORIES and not payload.linked_user_stories:
            raise FeedbackTypeRequiresFieldError("linked_user_stories", payload.type)

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
    ) -> Feedback:
        """Persist a feedback row + (optional) screenshot attachment.

        Caller MUST run ``check_rate_limit`` first if rate limiting applies.
        """
        self.validate_payload(payload)

        if (
            screenshot is not None
            and len(screenshot.content) > self.settings.MAX_SCREENSHOT_BYTES
        ):
            raise FeedbackError(
                f"Screenshot exceeds size cap ({self.settings.MAX_SCREENSHOT_BYTES} bytes)"
            )

        # Resolve parent_ticket_code → parent_feedback_id (tenant-scoped).
        parent_feedback_id: uuid.UUID | None = None
        if payload.parent_ticket_code:
            parent_feedback_id = self._resolve_parent_ticket(
                tenant_id=tenant_id, ticket_code=payload.parent_ticket_code
            )

        # ──── Server-side redaction (defence-in-depth) ────────────────
        # The widget redacts on the client before submit, but a malicious
        # or buggy client can ship secrets anyway. Run every free-text
        # field through the redactor — security review caught that we
        # only redacted ``metadata_bundle`` originally, leaking JWTs that
        # users paste into reproduction_steps or descriptions when filing
        # auth-related bugs (the most common case).
        redacted_metadata: dict[str, Any] = redact_bundle(payload.metadata_bundle)
        redacted_title = redact_string(payload.title.strip())
        redacted_description = redact_string(payload.description)
        redacted_persona = redact_string(payload.persona) if payload.persona else None
        redacted_type_fields = redact_bundle(payload.type_fields)
        redacted_linked_user_stories = [
            redact_bundle(lus.model_dump()) for lus in payload.linked_user_stories
        ]

        feedback = Feedback(
            tenant_id=tenant_id,
            user_id=user_id,
            type=payload.type,
            status=FeedbackStatus.NEW,
            title=redacted_title,
            description=redacted_description,
            url_captured=payload.url_captured,
            route_name=payload.route_name,
            element_selector=payload.element.selector if payload.element else None,
            element_xpath=payload.element.xpath if payload.element else None,
            element_bounding_box=(payload.element.bounding_box if payload.element else None),
            type_fields=redacted_type_fields,
            persona=redacted_persona,
            linked_user_stories=redacted_linked_user_stories,
            metadata_bundle=redacted_metadata,
            consent_metadata_capture=payload.consent_metadata_capture,
            app_version=payload.app_version,
            git_commit_sha=payload.git_commit_sha,
            user_agent=payload.user_agent,
            follow_up_email=(payload.follow_up_email or None),
            parent_feedback_id=parent_feedback_id,
        )
        # Generate the per-tenant ticket code with a bounded retry. Two
        # concurrent submitters in the same tenant can both observe the
        # same ``MAX(ticket_code)`` and try to insert the same value;
        # the partial UNIQUE index ``ix_feedback_tenant_ticket_code``
        # raises IntegrityError on the loser. Up to 3 retries with a
        # fresh code each time before surfacing the error.
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
            attachment = FeedbackAttachment(
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
            self.session.add(attachment)
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

    # ------------------------------------------------------------------
    # Ticketing workflow helpers
    # ------------------------------------------------------------------

    def _generate_ticket_code(self, *, tenant_id: uuid.UUID) -> str:
        """Compute the next ``FB-YYYY-NNNN`` for the given tenant.

        Race-safe: if two concurrent INSERTs see the same max, the
        UNIQUE index ``ix_feedback_tenant_ticket_code`` raises and the
        caller can retry. Service.create wraps in flush() so the
        IntegrityError surfaces immediately.
        """
        year = datetime.now(UTC).year
        prefix = f"FB-{year}-"
        # Largest existing sequence for this tenant in this year.
        stmt = (
            select(func.max(Feedback.ticket_code))
            .where(Feedback.tenant_id == tenant_id)
            .where(Feedback.ticket_code.like(f"{prefix}%"))  # type: ignore[union-attr]
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

    def _resolve_parent_ticket(self, *, tenant_id: uuid.UUID, ticket_code: str) -> uuid.UUID | None:
        """Look up a parent feedback by its ticket_code, scoped to tenant.

        Returns None if the ticket doesn't exist (we silently drop the
        link rather than failing the submission — the user might have
        typo'd; better to lose the linkage than the feedback).
        """
        stmt = select(Feedback.id).where(
            Feedback.tenant_id == tenant_id,
            Feedback.ticket_code == ticket_code,
        )
        run_query = self.session.exec
        return run_query(stmt).one_or_none()

    def get_by_acceptance_token(self, token: uuid.UUID) -> Feedback | None:
        """Look up a feedback by its single-use acceptance token.

        No tenant filter — the token is the auth, not the user. Caller
        is the public accept/reject endpoint.
        """
        stmt = select(Feedback).where(Feedback.acceptance_token == token)
        run_query = self.session.exec
        return run_query(stmt).one_or_none()

    def issue_acceptance_token(
        self, *, feedback_id: uuid.UUID, ttl_seconds: int = 30 * 24 * 3600
    ) -> uuid.UUID:
        """Generate + persist a fresh acceptance token on the row.

        Called when admin transitions a feedback to DONE. Default TTL
        is 30 days. Returns the token so the caller can build the email
        accept/reject URLs.
        """
        feedback = self.get(feedback_id)
        token = uuid.uuid4()
        feedback.acceptance_token = token
        feedback.acceptance_token_expires_at = datetime.now(UTC) + timedelta(seconds=ttl_seconds)
        self.session.add(feedback)
        self.session.flush()
        return token

    def consume_acceptance_token(self, *, token: uuid.UUID, action: str) -> Feedback:
        """Apply the user's accept/reject choice via the magic link.

        Validates: token exists, hasn't expired, action is one of
        accept/reject. On accept: status → ACCEPTED_BY_USER + cascade
        to parent (recursive). On reject: status → REJECTED_BY_USER.
        Either way, the token is cleared so the link is single-use.
        """
        if action not in ("accept", "reject"):
            raise FeedbackError(f"Unknown action: {action!r}")

        feedback = self.get_by_acceptance_token(token)
        if feedback is None:
            raise FeedbackNotFoundError("Invalid or expired token")

        # Expiry check — fail closed. A NULL ``acceptance_token_expires_at``
        # column would otherwise let the token be redeemed indefinitely,
        # which is exactly the failure mode the expiry was added to prevent.
        # ``issue_acceptance_token`` always sets the column today, but a
        # stray DB-direct UPDATE or future migration could create a row
        # with a token but no expiry — refuse those rather than honour them.
        now = datetime.now(UTC)
        if (
            feedback.acceptance_token_expires_at is None
            or feedback.acceptance_token_expires_at < now
        ):
            raise FeedbackNotFoundError("Token has expired")

        # Apply the transition.
        if action == "accept":
            feedback.status = FeedbackStatus.ACCEPTED_BY_USER
            self._cascade_accept_parent(feedback)
        else:
            feedback.status = FeedbackStatus.REJECTED_BY_USER

        # Single-use: scrub the token.
        feedback.acceptance_token = None
        feedback.acceptance_token_expires_at = None
        feedback.updated_at = now

        self.session.add(feedback)
        self.session.flush()
        return feedback

    def walk_parent_chain(self, parent_id: uuid.UUID) -> list[Feedback]:
        """Walk the ``parent_feedback_id`` chain starting at ``parent_id``.

        Returns the ancestors in deepest-first order (i.e. the first
        element is the immediate parent of the caller's feedback row).
        Tenant-scoped: rows whose ``tenant_id`` doesn't match
        ``self.tenant_id`` are skipped (defence-in-depth even though
        the FK constraint is single-tenant). Cycle-safe via a ``seen``
        set; bounded at 20 hops to keep a runaway chain from blocking
        the request thread.

        Used by the LLM-handoff bundle (block-12) so the export
        contains every ancestor's ticket_code + status. Read-only —
        no mutations.
        """
        chain: list[Feedback] = []
        seen: set[uuid.UUID] = set()
        current_id: uuid.UUID | None = parent_id
        # Defensive cap — the cascade in ``consume_acceptance_token``
        # is unbounded by design (it has to flip every ancestor), but
        # this read path is admin-facing and 20 ancestors is already
        # an extreme business case.
        hops_remaining = 20
        while current_id is not None and current_id not in seen and hops_remaining > 0:
            seen.add(current_id)
            row = self.session.get(Feedback, current_id)
            if row is None:
                break
            if self.tenant_id is not None and row.tenant_id != self.tenant_id:
                break
            chain.append(row)
            current_id = row.parent_feedback_id
            hops_remaining -= 1
        return chain

    def _cascade_accept_parent(self, child: Feedback) -> None:
        """When a child feedback is accepted, the parent auto-accepts.

        Walks up parent_feedback_id chain and marks each ancestor as
        ACCEPTED_BY_USER if they aren't already in a terminal state.
        Stops if the chain loops or hits the tenant boundary (defence
        in depth even though the FK enforces single-tenant).
        """
        if child.parent_feedback_id is None:
            return
        seen: set[uuid.UUID] = {child.id}
        current_parent_id: uuid.UUID | None = child.parent_feedback_id
        while current_parent_id is not None and current_parent_id not in seen:
            seen.add(current_parent_id)
            parent = self.session.get(Feedback, current_parent_id)
            if parent is None or parent.tenant_id != child.tenant_id:
                break
            if parent.status in (
                FeedbackStatus.ACCEPTED_BY_USER,
                FeedbackStatus.REJECTED_BY_USER,
                FeedbackStatus.WONT_FIX,
            ):
                # Already terminal — don't re-transition.
                break
            parent.status = FeedbackStatus.ACCEPTED_BY_USER
            parent.updated_at = datetime.now(UTC)
            # Single-use the parent's token if any was outstanding.
            parent.acceptance_token = None
            parent.acceptance_token_expires_at = None
            self.session.add(parent)
            current_parent_id = parent.parent_feedback_id

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    def get(self, feedback_id: uuid.UUID) -> Feedback:
        row = self.session.get(Feedback, feedback_id)
        if row is None:
            raise FeedbackNotFoundError(str(feedback_id))
        # Explicit tenant gate: a row from another tenant looks like 404
        # to this caller, mirroring the rest of the service layer.
        if self.tenant_id is not None and row.tenant_id != self.tenant_id:
            raise FeedbackNotFoundError(str(feedback_id))
        return row

    def list_attachments(self, feedback_id: uuid.UUID) -> list[FeedbackAttachment]:
        stmt = select(FeedbackAttachment).where(FeedbackAttachment.feedback_id == feedback_id)
        if self.tenant_id is not None:
            stmt = stmt.where(FeedbackAttachment.tenant_id == self.tenant_id)
        run_query = self.session.exec
        return list(run_query(stmt).all())

    # ------------------------------------------------------------------
    # Business mapping accumulators
    # ------------------------------------------------------------------
    #
    # The widget's second purpose: every submission progressively maps
    # the business by capturing the persona + user stories the
    # submitter is reasoning about. To stop every submitter from
    # re-typing the same persona, the form lets them pick from
    # previously-submitted personas (and stories) within their tenant.
    # These two helpers feed those pickers.

    def list_distinct_personas(self, *, limit: int = 50) -> list[str]:
        """Return the most-recent distinct persona blocks in the tenant.

        Empty/null personas are filtered out. Tenant scope is enforced
        explicitly even though RLS is in place — the service layer is
        the canonical place for tenant filters in this codebase.
        """
        stmt = (
            select(Feedback.persona, func.max(Feedback.created_at).label("most_recent"))
            .where(Feedback.persona.is_not(None))  # type: ignore[union-attr]
            .where(Feedback.persona != "")
            .group_by(Feedback.persona)
            .order_by(func.max(Feedback.created_at).desc())
            .limit(limit)
        )
        if self.tenant_id is not None:
            stmt = stmt.where(Feedback.tenant_id == self.tenant_id)
        run_query = self.session.exec
        rows = run_query(stmt).all()
        return [row[0] for row in rows if row[0]]

    def list_distinct_user_stories(self, *, limit: int = 100) -> list[dict[str, Any]]:
        """Return the most-recent distinct linked-user-stories rows.

        ``linked_user_stories`` is a JSONB array of {story,
        acceptance_criteria, priority} objects. We unnest the array,
        deduplicate by ``story`` (the natural-language ID), and return
        the most recent occurrence of each — its acceptance_criteria +
        priority come from the latest submission that mentioned the
        story.
        """
        # SQLAlchemy 2.x: use a table function to unnest JSONB.
        from sqlalchemy import literal_column, text

        # Tenant filter pushed into the inner SELECT so the unnest
        # only walks rows the caller can see.
        tenant_clause = ""
        params: dict[str, Any] = {"limit": limit}
        if self.tenant_id is not None:
            tenant_clause = "AND f.tenant_id = :tenant_id"
            params["tenant_id"] = str(self.tenant_id)

        sql = text(
            f"""
            SELECT s.story, s.acceptance_criteria, s.priority
            FROM (
                SELECT
                    elem->>'story'                AS story,
                    elem->>'acceptance_criteria'  AS acceptance_criteria,
                    elem->>'priority'             AS priority,
                    f.created_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY elem->>'story'
                        ORDER BY f.created_at DESC
                    ) AS rn
                FROM feedback f
                CROSS JOIN LATERAL jsonb_array_elements(f.linked_user_stories) AS elem
                WHERE elem->>'story' IS NOT NULL
                  AND elem->>'story' <> ''
                  {tenant_clause}
            ) s
            WHERE s.rn = 1
            ORDER BY s.created_at DESC
            LIMIT :limit
            """
        )
        # type: ignore[unused-variable]  # literal_column kept for SQLAlchemy importability
        _ = literal_column
        result = self.session.execute(sql, params)
        return [
            {
                "story": row[0],
                "acceptance_criteria": row[1],
                "priority": row[2],
            }
            for row in result
        ]

    def list_mine(
        self,
        *,
        user_id: uuid.UUID,
        limit: int = 25,
    ) -> list[Feedback]:
        """Recent feedback rows submitted by the given user, newest first.

        Used by the widget's "my tickets" view + the in-app notification
        badge — submitter sees their own ticket statuses without needing
        admin permissions.
        """
        stmt = (
            select(Feedback)
            .where(Feedback.user_id == user_id)
            .order_by(Feedback.updated_at.desc())  # type: ignore[attr-defined]
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
        """Tenant-scoped listing for the admin triage view.

        Tenant isolation is handled by RLS at the DB layer — the SELECT
        gets implicit ``WHERE tenant_id = current_setting(...)`` from the
        policy. No application filter needed.
        """
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
            base_stmt.order_by(Feedback.created_at.desc())  # type: ignore[attr-defined]
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

        When ``sign_urls`` is True, every screenshot attachment carries a
        presigned URL valid for ``FEEDBACK_PRESIGNED_TTL_SECONDS``.
        """
        attachment_rows = (
            attachments if attachments is not None else self.list_attachments(feedback.id)
        )
        ttl = self.settings.PRESIGNED_TTL_SECONDS
        attachment_dtos: list[FeedbackAttachmentRead] = []
        for a in attachment_rows:
            dto = FeedbackAttachmentRead.model_validate(a)
            if sign_urls and a.kind == FeedbackAttachmentKind.SCREENSHOT:
                dto.presigned_url = self.storage.presigned_url(
                    key=a.object_key,
                    expires=ttl,
                    bucket=a.bucket,
                )
            attachment_dtos.append(dto)
        read = FeedbackRead.model_validate(feedback)
        read.attachments = attachment_dtos
        # Resolve parent_ticket_code for the wire payload (parent lookup
        # is one query; cheap and always tenant-scoped via the FK).
        if feedback.parent_feedback_id is not None:
            parent = self.session.get(Feedback, feedback.parent_feedback_id)
            if parent is not None:
                read.parent_ticket_code = parent.ticket_code
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
        # First transition out of NEW marks the triager.
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
        # forever. Each failure is logged with full context so a sweep
        # job can later reconcile.
        from botocore.exceptions import BotoCoreError, ClientError

        for a in attachments:
            try:
                self.storage.delete(a.object_key, bucket=a.bucket)
            except (BotoCoreError, ClientError):
                logger.exception(
                    "feedback storage delete failed: bucket=%s key=%s — orphaned object",
                    a.bucket,
                    a.object_key,
                )
                continue

        # FK ON DELETE CASCADE removes the attachment rows.
        self.session.delete(feedback)
        self.session.flush()
