"""initial feedback schema

Adds the in-app feedback widget's two tables — host-agnostic, no FK
references to host tables (``users`` / ``tenants``). Hosts that want
referential integrity to their own user/tenant tables can apply a
follow-up migration of their own; the package keeps tenant_id +
user_id as plain UUIDs.

Multi-tenant hosts (e.g. CRM with Postgres RLS) apply their own
``CREATE POLICY`` migration on top of this; sapphira (single-tenant)
leaves them alone.

Revision ID: 0001_initial_feedback_schema
Revises: (none — first migration in the chain)
Create Date: 2026-04-29
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0001_initial_feedback_schema"
down_revision = None
branch_labels = None
depends_on = None


FEEDBACK_TYPE_VALUES = (
    "bug",
    "new_feature",
    "extend_feature",
    "new_user_story",
    "question",
    "ux_polish",
    "performance",
    "data_issue",
)
FEEDBACK_STATUS_VALUES = ("new", "triaged", "in_progress", "done", "wont_fix")
FEEDBACK_ATTACHMENT_KIND_VALUES = ("screenshot", "log_dump")


def upgrade() -> None:
    # ─── Postgres-native enums ────────────────────────────────────────
    feedback_type = postgresql.ENUM(*FEEDBACK_TYPE_VALUES, name="feedback_type", create_type=False)
    feedback_status = postgresql.ENUM(
        *FEEDBACK_STATUS_VALUES, name="feedback_status", create_type=False
    )
    feedback_attachment_kind = postgresql.ENUM(
        *FEEDBACK_ATTACHMENT_KIND_VALUES,
        name="feedback_attachment_kind",
        create_type=False,
    )
    feedback_type.create(op.get_bind(), checkfirst=True)
    feedback_status.create(op.get_bind(), checkfirst=True)
    feedback_attachment_kind.create(op.get_bind(), checkfirst=True)

    # ─── feedback ────────────────────────────────────────────────────
    op.create_table(
        "feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        # tenant_id is nullable so single-tenant hosts (sapphira) can leave
        # it NULL; multi-tenant hosts (CRM) will always populate it.
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", feedback_type, nullable=False),
        sa.Column(
            "status",
            feedback_status,
            nullable=False,
            server_default=sa.text("'new'::feedback_status"),
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("url_captured", sa.String(length=2048), nullable=False),
        sa.Column("route_name", sa.String(length=200), nullable=True),
        sa.Column("element_selector", sa.String(length=1024), nullable=True),
        sa.Column("element_xpath", sa.String(length=2048), nullable=True),
        sa.Column(
            "element_bounding_box",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "type_fields",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("persona", sa.Text(), nullable=True),
        sa.Column(
            "linked_user_stories",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "metadata_bundle",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "consent_metadata_capture",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("app_version", sa.String(length=64), nullable=True),
        sa.Column("git_commit_sha", sa.String(length=40), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
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
        sa.Column("triaged_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("triaged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("triage_note", sa.Text(), nullable=True),
    )
    op.create_index("ix_feedback_tenant_id", "feedback", ["tenant_id"])
    op.create_index("ix_feedback_user_id", "feedback", ["user_id"])
    op.create_index(
        "ix_feedback_tenant_status_created",
        "feedback",
        ["tenant_id", "status", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_feedback_tenant_type_created",
        "feedback",
        ["tenant_id", "type", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_feedback_user_created",
        "feedback",
        ["user_id", sa.text("created_at DESC")],
    )

    # ─── feedback_attachment ─────────────────────────────────────────
    op.create_table(
        "feedback_attachment",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "feedback_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("kind", feedback_attachment_kind, nullable=False),
        sa.Column("bucket", sa.String(length=200), nullable=False),
        sa.Column("object_key", sa.String(length=512), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_feedback_attachment_feedback_id",
        "feedback_attachment",
        ["feedback_id"],
    )
    op.create_index(
        "ix_feedback_attachment_tenant_id",
        "feedback_attachment",
        ["tenant_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_feedback_attachment_tenant_id", table_name="feedback_attachment")
    op.drop_index("ix_feedback_attachment_feedback_id", table_name="feedback_attachment")
    op.drop_table("feedback_attachment")

    op.drop_index("ix_feedback_user_created", table_name="feedback")
    op.drop_index("ix_feedback_tenant_type_created", table_name="feedback")
    op.drop_index("ix_feedback_tenant_status_created", table_name="feedback")
    op.drop_index("ix_feedback_user_id", table_name="feedback")
    op.drop_index("ix_feedback_tenant_id", table_name="feedback")
    op.drop_table("feedback")

    bind = op.get_bind()
    postgresql.ENUM(name="feedback_attachment_kind").drop(bind, checkfirst=True)
    postgresql.ENUM(name="feedback_status").drop(bind, checkfirst=True)
    postgresql.ENUM(name="feedback_type").drop(bind, checkfirst=True)
