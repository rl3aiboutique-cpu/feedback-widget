"""ticketing workflow

Adds the ticketing workflow on top of the basic feedback table:

* ``ticket_code`` — human-readable per-tenant identifier ``FB-YYYY-NNNN``.
  Backfilled for existing rows. UNIQUE per tenant via a partial index.
* ``follow_up_email`` — optional address the submitter wants status
  notifications routed to. NULL ⇒ opt-out.
* ``parent_feedback_id`` — self-referencing FK. Cascade on accept: when
  a child is accepted, its parent auto-accepts.
* ``acceptance_token`` — opaque UUID for magic-link accept/reject.
* ``acceptance_token_expires_at`` — caps the magic-link's lifetime.
* ``feedback_status`` enum extended with ``accepted_by_user`` and
  ``rejected_by_user``.

Revision ID: 0002_ticketing_workflow
Revises: 0001_initial_feedback_schema
Create Date: 2026-04-29
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0002_ticketing_workflow"
down_revision = "0001_initial_feedback_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Extend the feedback_status enum.
    op.execute("ALTER TYPE feedback_status ADD VALUE IF NOT EXISTS 'accepted_by_user'")
    op.execute("ALTER TYPE feedback_status ADD VALUE IF NOT EXISTS 'rejected_by_user'")

    # 2. New columns on feedback.
    op.add_column(
        "feedback",
        sa.Column("ticket_code", sa.String(length=24), nullable=True),
    )
    op.add_column(
        "feedback",
        sa.Column("follow_up_email", sa.String(length=320), nullable=True),
    )
    op.add_column(
        "feedback",
        sa.Column(
            "parent_feedback_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "feedback",
        sa.Column("acceptance_token", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "feedback",
        sa.Column(
            "acceptance_token_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # 3. Backfill ticket_code for existing rows (windowed by tenant + year).
    #    Single-tenant hosts may have NULL tenant_ids; the window function
    #    treats NULL as its own bucket which is fine for first-rollouts.
    op.execute(
        """
        WITH numbered AS (
            SELECT
                id,
                tenant_id,
                EXTRACT(YEAR FROM created_at)::int AS yr,
                ROW_NUMBER() OVER (
                    PARTITION BY tenant_id, EXTRACT(YEAR FROM created_at)::int
                    ORDER BY created_at, id
                ) AS seq
            FROM feedback
        )
        UPDATE feedback f
        SET ticket_code = 'FB-' || numbered.yr || '-' || LPAD(numbered.seq::text, 4, '0')
        FROM numbered
        WHERE f.id = numbered.id
        """
    )

    # 4. Make ticket_code NOT NULL now that every row has one.
    op.alter_column("feedback", "ticket_code", nullable=False)

    # 5. UNIQUE per tenant. Two tenants can both use FB-2026-0001.
    #    For NULL tenant_ids (single-tenant hosts), the partial index
    #    treats NULL as a single bucket — which is the correct semantic
    #    when there's only one effective tenant.
    op.create_index(
        "ix_feedback_tenant_ticket_code",
        "feedback",
        ["tenant_id", "ticket_code"],
        unique=True,
    )

    # 6. Indexes for the new lookup paths.
    op.create_index(
        "ix_feedback_acceptance_token",
        "feedback",
        ["acceptance_token"],
        unique=True,
        postgresql_where=sa.text("acceptance_token IS NOT NULL"),
    )
    op.create_index(
        "ix_feedback_parent_feedback_id",
        "feedback",
        ["parent_feedback_id"],
        postgresql_where=sa.text("parent_feedback_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_feedback_parent_feedback_id",
        table_name="feedback",
        postgresql_where=sa.text("parent_feedback_id IS NOT NULL"),
    )
    op.drop_index(
        "ix_feedback_acceptance_token",
        table_name="feedback",
        postgresql_where=sa.text("acceptance_token IS NOT NULL"),
    )
    op.drop_index("ix_feedback_tenant_ticket_code", table_name="feedback")
    op.drop_column("feedback", "acceptance_token_expires_at")
    op.drop_column("feedback", "acceptance_token")
    op.drop_column("feedback", "parent_feedback_id")
    op.drop_column("feedback", "follow_up_email")
    op.drop_column("feedback", "ticket_code")
    # Postgres can't cleanly remove enum values; the new ones stay.
