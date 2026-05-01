"""feedback comments — chat-style replies on tickets

Adds the ``feedback_comment`` table that powers the conversation thread
between the submitter and the admin triagers. Append-only in v0.2.2 —
edit / delete follow in a later minor version.

Revision ID: 0004_feedback_comments
Revises: 0003_simplify_to_v0_2_0
Create Date: 2026-04-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0004_feedback_comments"
down_revision = "0003_simplify_to_v0_2_0"
branch_labels = None
depends_on = None


_AUTHOR_ROLES = ("submitter", "admin")


def upgrade() -> None:
    # Postgres-native enum for the author role.
    author_role_enum = postgresql.ENUM(
        *_AUTHOR_ROLES,
        name="feedback_comment_author_role",
        create_type=False,
    )
    author_role_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "feedback_comment",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "feedback_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Single-tenant hosts may leave this NULL; multi-tenant hosts
        # always populate it (mirrored from the parent feedback row).
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("author_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "author_role",
            author_role_enum,
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_feedback_comment_feedback_id",
        "feedback_comment",
        ["feedback_id"],
    )
    op.create_index(
        "ix_feedback_comment_tenant_id",
        "feedback_comment",
        ["tenant_id"],
    )
    op.create_index(
        "ix_feedback_comment_author_user_id",
        "feedback_comment",
        ["author_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_feedback_comment_author_user_id", table_name="feedback_comment")
    op.drop_index("ix_feedback_comment_tenant_id", table_name="feedback_comment")
    op.drop_index("ix_feedback_comment_feedback_id", table_name="feedback_comment")
    op.drop_table("feedback_comment")
    op.execute("DROP TYPE IF EXISTS feedback_comment_author_role")
