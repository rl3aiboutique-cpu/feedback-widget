"""simplify to v0.2.0 — UX-first form + multi-file attachments

Destructive migration. v0.1.13 was beta with no production deployments
to protect, so this collapses the schema instead of carrying forward
backwards-compat shims:

* Drop columns from ``feedback``: ``type_fields``, ``persona``,
  ``linked_user_stories``, ``consent_metadata_capture``,
  ``follow_up_email``, ``parent_feedback_id``, ``acceptance_token``,
  ``acceptance_token_expires_at``.
* Add ``expected_outcome`` (text, nullable) — the new "How should it
  work?" field.
* Recreate ``feedback_type`` enum with only the six creatable values
  (``bug``, ``ui``, ``performance``, ``new_feature``,
  ``extend_feature``, ``other``). Rows with deprecated types are
  deleted.
* Recreate ``feedback_status`` enum without ``accepted_by_user`` and
  ``rejected_by_user`` (magic-link accept/reject removed). Rows in
  those states are deleted.
* Recreate ``feedback_attachment_kind`` enum with ``screenshot`` +
  ``user_attachment`` (replaces unused ``log_dump``).
* Add ``filename`` column to ``feedback_attachment`` for the
  user-uploaded files.

After this migration the schema is frozen — destructive changes from
here on require non-destructive migrations with a backwards-compat
window.

Revision ID: 0003_simplify_to_v0_2_0
Revises: 0002_ticketing_workflow
Create Date: 2026-04-30
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0003_simplify_to_v0_2_0"
down_revision = "0002_ticketing_workflow"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Delete rows whose enum values are about to disappear. Beta
    #    cleanup — no production data to preserve.
    op.execute(
        "DELETE FROM feedback WHERE type IN "
        "('new_user_story', 'question', 'ux_polish', 'data_issue')"
    )
    op.execute("DELETE FROM feedback WHERE status IN " "('accepted_by_user', 'rejected_by_user')")
    op.execute("DELETE FROM feedback_attachment WHERE kind = 'log_dump'")

    # 2. Drop columns from feedback. Postgres cascades dependent
    #    indexes/FKs (ix_feedback_acceptance_token,
    #    ix_feedback_parent_feedback_id) automatically.
    op.drop_column("feedback", "type_fields")
    op.drop_column("feedback", "persona")
    op.drop_column("feedback", "linked_user_stories")
    op.drop_column("feedback", "consent_metadata_capture")
    op.drop_column("feedback", "follow_up_email")
    op.drop_column("feedback", "parent_feedback_id")
    op.drop_column("feedback", "acceptance_token")
    op.drop_column("feedback", "acceptance_token_expires_at")

    # 3. New columns.
    op.add_column(
        "feedback",
        sa.Column("expected_outcome", sa.Text(), nullable=True),
    )
    op.add_column(
        "feedback_attachment",
        sa.Column("filename", sa.String(length=255), nullable=True),
    )

    # 4. Recreate feedback_type enum with six values.
    op.execute("ALTER TYPE feedback_type RENAME TO feedback_type_old")
    op.execute(
        "CREATE TYPE feedback_type AS ENUM "
        "('bug', 'ui', 'performance', 'new_feature', 'extend_feature', 'other')"
    )
    op.execute(
        "ALTER TABLE feedback "
        "ALTER COLUMN type TYPE feedback_type "
        "USING type::text::feedback_type"
    )
    op.execute("DROP TYPE feedback_type_old")

    # 5. Recreate feedback_status enum without accept/reject states.
    #    The status column has a server_default that references the
    #    enum type — drop it first, alter the column, then re-set it.
    op.execute("ALTER TABLE feedback ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TYPE feedback_status RENAME TO feedback_status_old")
    op.execute(
        "CREATE TYPE feedback_status AS ENUM "
        "('new', 'triaged', 'in_progress', 'done', 'wont_fix')"
    )
    op.execute(
        "ALTER TABLE feedback "
        "ALTER COLUMN status TYPE feedback_status "
        "USING status::text::feedback_status"
    )
    op.execute("ALTER TABLE feedback " "ALTER COLUMN status SET DEFAULT 'new'::feedback_status")
    op.execute("DROP TYPE feedback_status_old")

    # 6. Recreate feedback_attachment_kind enum.
    op.execute("ALTER TYPE feedback_attachment_kind " "RENAME TO feedback_attachment_kind_old")
    op.execute("CREATE TYPE feedback_attachment_kind AS ENUM " "('screenshot', 'user_attachment')")
    op.execute(
        "ALTER TABLE feedback_attachment "
        "ALTER COLUMN kind TYPE feedback_attachment_kind "
        "USING kind::text::feedback_attachment_kind"
    )
    op.execute("DROP TYPE feedback_attachment_kind_old")


def downgrade() -> None:
    # v0.2.0 is a clean break — downgrade not supported. Hosts that
    # need to roll back must restore from a backup taken before
    # ``feedback-widget migrate`` was run.
    raise NotImplementedError(
        "Downgrade from 0003_simplify_to_v0_2_0 is not supported. "
        "v0.2.0 dropped columns and recreated enums; restore from a "
        "pre-migration backup if you need the old schema back."
    )
