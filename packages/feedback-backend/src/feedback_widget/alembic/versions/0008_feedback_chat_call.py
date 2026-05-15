"""chat-first call audit — feedback_chat_call table.

Sprint C — paridad observability con ``feedback_iter_call``. One row per
LLM stream attempted from ``ChatService.run_turn``, capturing model id /
provider / token counts / latency / status / sha256 of the prompt so the
admin tooling can replay or correlate behaviour with prompt revisions.

Revision ID: 0008_feedback_chat_call
Revises: 0007_chat_first_schema
Create Date: 2026-05-15
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0008_feedback_chat_call"
down_revision = "0007_chat_first_schema"
branch_labels = None
depends_on = None


_CHAT_CALL_STATUS = (
    "success",
    "json_invalid",
    "timeout",
    "provider_error",
    "cancelled",
)


def upgrade() -> None:
    op.execute(
        "CREATE TYPE feedback_chat_call_status AS ENUM "
        + "("
        + ", ".join(f"'{v}'" for v in _CHAT_CALL_STATUS)
        + ")"
    )

    op.create_table(
        "feedback_chat_call",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "chat_session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback_chat_session.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("turn_index", sa.Integer(), nullable=False),
        sa.Column("model_id", sa.String(200), nullable=False),
        sa.Column("model_provider", sa.String(50), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Numeric(12, 6), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "status",
            postgresql.ENUM(
                *_CHAT_CALL_STATUS,
                name="feedback_chat_call_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("attempt_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("prompt_sha256", sa.String(64), nullable=False),
        sa.Column("prompt_version", sa.String(32), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_feedback_chat_call_session_created",
        "feedback_chat_call",
        ["chat_session_id", "created_at"],
    )
    op.create_index(
        "ix_feedback_chat_call_tenant_created",
        "feedback_chat_call",
        ["tenant_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_feedback_chat_call_tenant_created",
        table_name="feedback_chat_call",
    )
    op.drop_index(
        "ix_feedback_chat_call_session_created",
        table_name="feedback_chat_call",
    )
    op.drop_table("feedback_chat_call")
    op.execute("DROP TYPE IF EXISTS feedback_chat_call_status")
