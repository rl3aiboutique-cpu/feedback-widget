"""chat-first redesign — feedback_chat_session table + feedback columns.

Adds the v1.0.0 chat-first capture flow source of truth. The feedback row
is created only at chat confirm; the chat_session is the durable artifact
during the conversation. Audio is NOT persisted (D-013).

Revision ID: 0007_chat_first_schema
Revises: 0006_iter_scrub_completion
Create Date: 2026-05-13
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007_chat_first_schema"
down_revision = "0006_iter_scrub_completion"
branch_labels = None
depends_on = None


_CHAT_MODE = ("capture", "refine")
_CHAT_STATUS = (
    "open",
    "in_progress",
    "synthesizing",
    "awaiting_confirm",
    "confirmed",
    "abandoned",
)
_SEVERITY = ("blocker", "major", "minor", "idea")


def upgrade() -> None:
    op.execute(
        "CREATE TYPE chat_session_mode AS ENUM "
        + "("
        + ", ".join(f"'{v}'" for v in _CHAT_MODE)
        + ")"
    )
    op.execute(
        "CREATE TYPE chat_session_status AS ENUM "
        + "("
        + ", ".join(f"'{v}'" for v in _CHAT_STATUS)
        + ")"
    )
    op.execute(
        "CREATE TYPE feedback_severity AS ENUM "
        + "("
        + ", ".join(f"'{v}'" for v in _SEVERITY)
        + ")"
    )

    op.create_table(
        "feedback_chat_session",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        # tenant_id nullable=True mirrors migration 0001 convention:
        # single-tenant hosts (sapphira) leave NULL; multi-tenant hosts add
        # CHECK constraint via their own migration.
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            "mode",
            postgresql.ENUM(*_CHAT_MODE, name="chat_session_mode", create_type=False),
            nullable=False,
            server_default="capture",
        ),
        sa.Column(
            "status",
            postgresql.ENUM(*_CHAT_STATUS, name="chat_session_status", create_type=False),
            nullable=False,
            server_default="open",
        ),
        sa.Column(
            "messages",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("synthesis_json", postgresql.JSONB, nullable=True),
        sa.Column("auto_context", postgresql.JSONB, nullable=False),
        sa.Column(
            "feedback_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("glossary_snapshot", postgresql.JSONB, nullable=True),
        sa.Column("detected_language", sa.String(length=8), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("abandoned_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index(
        "ix_feedback_chat_session_user_status",
        "feedback_chat_session",
        ["tenant_id", "user_id", "status"],
    )
    op.create_index(
        "ix_feedback_chat_session_feedback",
        "feedback_chat_session",
        ["feedback_id"],
        postgresql_where=sa.text("feedback_id IS NOT NULL"),
    )

    op.add_column(
        "feedback",
        sa.Column(
            "chat_session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback_chat_session.id"),
            nullable=True,
        ),
    )
    op.add_column("feedback", sa.Column("synthesis_json", postgresql.JSONB, nullable=True))
    op.add_column(
        "feedback",
        sa.Column(
            "severity",
            postgresql.ENUM(*_SEVERITY, name="feedback_severity", create_type=False),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("feedback", "severity")
    op.drop_column("feedback", "synthesis_json")
    op.drop_column("feedback", "chat_session_id")
    op.drop_index("ix_feedback_chat_session_feedback", table_name="feedback_chat_session")
    op.drop_index("ix_feedback_chat_session_user_status", table_name="feedback_chat_session")
    op.drop_table("feedback_chat_session")
    op.execute("DROP TYPE feedback_severity")
    op.execute("DROP TYPE chat_session_status")
    op.execute("DROP TYPE chat_session_mode")
