"""iterate-with-AI module — 5 tables for sessions, versions, LLM calls,
assumptions, and finalized packages.

The Iterate-with-AI module sits on top of the existing ``feedback`` row.
After a user submits a feedback section in the existing flow they may
press an "Iterate with AI" button which opens an LLM-driven iteration
workspace. This migration adds the persistence layer for that workspace:

* ``feedback_iter_session`` — one per workspace open, attached to a
  feedback row. Partial unique index ensures at most one non-terminal
  session per feedback.
* ``feedback_iter_version`` — append-only working-document snapshots
  produced by each iteration call. ``version_number`` is 1-based and
  monotonically increasing per session.
* ``feedback_iter_call`` — one row per LLM call (success or failure)
  for audit, cost tracking, and rate-limit aggregation. ``idempotency_key``
  short-circuits double-clicks on the "Run iteration" button.
* ``feedback_iter_assumption`` — one row per assumption per version.
  Carries the user's resolution (confirm / correct / irrelevant) by
  ``slot_key`` so the resolution survives across iterations even when
  the LLM rewords the assumption.
* ``feedback_iter_package`` — one row per finalized package. Immutable
  after creation; new sessions produce new packages.

Multi-tenant hosts (e.g. CRM with Postgres RLS) apply their own
``CREATE POLICY`` migration on top of these tables; the package itself
keeps ``tenant_id`` plain-nullable to remain host-agnostic, mirroring
the v0.1.0 ``feedback`` table convention.

Revision ID: 0005_iter_module
Revises: 0004_feedback_comments
Create Date: 2026-05-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0005_iter_module"
down_revision = "0004_feedback_comments"
branch_labels = None
depends_on = None


_SESSION_STATUS_VALUES = ("draft", "iterating", "finalized", "abandoned")
_CALL_STATUS_VALUES = (
    "success",
    "json_invalid",
    "timeout",
    "provider_error",
    "cancelled",
)
_ASSUMPTION_KIND_VALUES = ("technical", "business", "ux", "scope")
_ASSUMPTION_STATUS_VALUES = ("open", "confirmed", "corrected", "irrelevant")


def upgrade() -> None:
    bind = op.get_bind()

    # ─── Postgres-native enums ────────────────────────────────────────
    session_status = postgresql.ENUM(
        *_SESSION_STATUS_VALUES,
        name="feedback_iter_session_status",
        create_type=False,
    )
    call_status = postgresql.ENUM(
        *_CALL_STATUS_VALUES,
        name="feedback_iter_call_status",
        create_type=False,
    )
    assumption_kind = postgresql.ENUM(
        *_ASSUMPTION_KIND_VALUES,
        name="feedback_iter_assumption_kind",
        create_type=False,
    )
    assumption_status = postgresql.ENUM(
        *_ASSUMPTION_STATUS_VALUES,
        name="feedback_iter_assumption_status",
        create_type=False,
    )
    session_status.create(bind, checkfirst=True)
    call_status.create(bind, checkfirst=True)
    assumption_kind.create(bind, checkfirst=True)
    assumption_status.create(bind, checkfirst=True)

    # ─── feedback_iter_session ───────────────────────────────────────
    # ``current_iteration_id`` and ``final_package_id`` are intentionally
    # plain UUIDs (no FK) to side-step the circular table dependency
    # (sessions ↔ versions ↔ packages) without ALTER-TABLE acrobatics.
    # Code-side invariants enforce referential integrity at write time.
    op.create_table(
        "feedback_iter_session",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "feedback_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            session_status,
            nullable=False,
            server_default=sa.text("'draft'::feedback_iter_session_status"),
        ),
        sa.Column("model_id", sa.String(length=200), nullable=False),
        sa.Column("model_provider", sa.String(length=50), nullable=False),
        sa.Column(
            "language",
            sa.String(length=10),
            nullable=False,
            server_default=sa.text("'en'"),
        ),
        sa.Column("current_iteration_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("final_package_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_feedback_iter_session_feedback_id",
        "feedback_iter_session",
        ["feedback_id"],
    )
    op.create_index(
        "ix_feedback_iter_session_tenant_id",
        "feedback_iter_session",
        ["tenant_id"],
    )
    op.create_index(
        "ix_feedback_iter_session_user_id",
        "feedback_iter_session",
        ["created_by_user_id"],
    )
    # At most one non-terminal session per feedback row. The widget UI
    # surfaces the existing in-flight session rather than letting users
    # spawn parallel iterations on the same ticket.
    op.create_index(
        "ix_feedback_iter_session_active_per_feedback",
        "feedback_iter_session",
        ["feedback_id"],
        unique=True,
        postgresql_where=sa.text("status NOT IN ('finalized', 'abandoned')"),
    )

    # ─── feedback_iter_version ───────────────────────────────────────
    op.create_table(
        "feedback_iter_version",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback_iter_session.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column(
            "parent_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback_iter_version.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "user_message",
            sa.Text(),
            nullable=False,
            server_default=sa.text("''"),
        ),
        sa.Column(
            "restructure_allowed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "output_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("output_markdown", sa.Text(), nullable=False),
        sa.Column(
            "diff_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint(
            "session_id",
            "version_number",
            name="uq_feedback_iter_version_session_number",
        ),
    )
    op.create_index(
        "ix_feedback_iter_version_session_id",
        "feedback_iter_version",
        ["session_id"],
    )
    op.create_index(
        "ix_feedback_iter_version_tenant_id",
        "feedback_iter_version",
        ["tenant_id"],
    )

    # ─── feedback_iter_call ──────────────────────────────────────────
    op.create_table(
        "feedback_iter_call",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback_iter_session.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback_iter_version.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("model_id", sa.String(length=200), nullable=False),
        sa.Column("model_provider", sa.String(length=50), nullable=False),
        sa.Column(
            "input_tokens",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "output_tokens",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("cost_usd", sa.Numeric(precision=12, scale=6), nullable=True),
        sa.Column(
            "latency_ms",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("status", call_status, nullable=False),
        sa.Column(
            "attempt_number",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("1"),
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("prompt_sha256", sa.String(length=64), nullable=False),
        # User-supplied Idempotency-Key header value. Per-session unique
        # via partial index below; same key from the same session
        # short-circuits to replay the existing call's persisted events.
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_feedback_iter_call_session_id",
        "feedback_iter_call",
        ["session_id"],
    )
    op.create_index(
        "ix_feedback_iter_call_tenant_id",
        "feedback_iter_call",
        ["tenant_id"],
    )
    op.create_index(
        "ix_feedback_iter_call_session_created",
        "feedback_iter_call",
        ["session_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_feedback_iter_call_idempotency",
        "feedback_iter_call",
        ["session_id", "idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
    )

    # ─── feedback_iter_assumption ───────────────────────────────────
    op.create_table(
        "feedback_iter_assumption",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback_iter_version.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Stable across versions for the same conceptual assumption.
        # The LLM is instructed (system prompt v1) to reuse keys; the
        # service upserts on (version_id, slot_key) to carry forward
        # the user's resolution.
        sa.Column("slot_key", sa.String(length=200), nullable=False),
        sa.Column("kind", assumption_kind, nullable=False),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Numeric(precision=3, scale=2), nullable=False),
        sa.Column(
            "status",
            assumption_status,
            nullable=False,
            server_default=sa.text("'open'::feedback_iter_assumption_status"),
        ),
        sa.Column("user_response", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint(
            "version_id",
            "slot_key",
            name="uq_feedback_iter_assumption_version_slot",
        ),
    )
    op.create_index(
        "ix_feedback_iter_assumption_version_id",
        "feedback_iter_assumption",
        ["version_id"],
    )
    op.create_index(
        "ix_feedback_iter_assumption_tenant_id",
        "feedback_iter_assumption",
        ["tenant_id"],
    )

    # ─── feedback_iter_package ──────────────────────────────────────
    op.create_table(
        "feedback_iter_package",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback_iter_session.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "final_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback_iter_version.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("minio_zip_key", sa.String(length=1024), nullable=False),
        sa.Column("minio_folder_prefix", sa.String(length=1024), nullable=False),
        sa.Column("byte_size_zip", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_feedback_iter_package_tenant_id",
        "feedback_iter_package",
        ["tenant_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_feedback_iter_package_tenant_id",
        table_name="feedback_iter_package",
    )
    op.drop_table("feedback_iter_package")

    op.drop_index(
        "ix_feedback_iter_assumption_tenant_id",
        table_name="feedback_iter_assumption",
    )
    op.drop_index(
        "ix_feedback_iter_assumption_version_id",
        table_name="feedback_iter_assumption",
    )
    op.drop_table("feedback_iter_assumption")

    op.drop_index(
        "ix_feedback_iter_call_idempotency",
        table_name="feedback_iter_call",
    )
    op.drop_index(
        "ix_feedback_iter_call_session_created",
        table_name="feedback_iter_call",
    )
    op.drop_index(
        "ix_feedback_iter_call_tenant_id",
        table_name="feedback_iter_call",
    )
    op.drop_index(
        "ix_feedback_iter_call_session_id",
        table_name="feedback_iter_call",
    )
    op.drop_table("feedback_iter_call")

    op.drop_index(
        "ix_feedback_iter_version_tenant_id",
        table_name="feedback_iter_version",
    )
    op.drop_index(
        "ix_feedback_iter_version_session_id",
        table_name="feedback_iter_version",
    )
    op.drop_table("feedback_iter_version")

    op.drop_index(
        "ix_feedback_iter_session_active_per_feedback",
        table_name="feedback_iter_session",
    )
    op.drop_index(
        "ix_feedback_iter_session_user_id",
        table_name="feedback_iter_session",
    )
    op.drop_index(
        "ix_feedback_iter_session_tenant_id",
        table_name="feedback_iter_session",
    )
    op.drop_index(
        "ix_feedback_iter_session_feedback_id",
        table_name="feedback_iter_session",
    )
    op.drop_table("feedback_iter_session")

    bind = op.get_bind()
    postgresql.ENUM(name="feedback_iter_assumption_status").drop(bind, checkfirst=True)
    postgresql.ENUM(name="feedback_iter_assumption_kind").drop(bind, checkfirst=True)
    postgresql.ENUM(name="feedback_iter_call_status").drop(bind, checkfirst=True)
    postgresql.ENUM(name="feedback_iter_session_status").drop(bind, checkfirst=True)
