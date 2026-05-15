"""drop legacy iter-module tables (Sprint C deprecation).

The iter-module (``register_feedback_iter_router``, ``IterService``,
``IterationOutput`` spec output, etc.) is removed in Sprint C in
favour of the chat-first capture flow. The 5 tables it owned are
dropped here so the schema reflects code reality.

Revision ID: 0009_drop_iter_tables
Revises: 0008_feedback_chat_call
Create Date: 2026-05-15

Downgrade is intentionally a no-op — recovering the iter schema means
restoring the deleted Python modules + migration 0005/0006 anyway, so a
local revert via ``alembic downgrade`` would land in an unbuildable
state. Use ``git revert`` instead if a rollback is ever needed.
"""

from __future__ import annotations

from alembic import op

revision = "0009_drop_iter_tables"
down_revision = "0008_feedback_chat_call"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop in FK-safe order: dependents first.
    op.execute("DROP TABLE IF EXISTS feedback_iter_package CASCADE")
    op.execute("DROP TABLE IF EXISTS feedback_iter_assumption CASCADE")
    op.execute("DROP TABLE IF EXISTS feedback_iter_call CASCADE")
    op.execute("DROP TABLE IF EXISTS feedback_iter_version CASCADE")
    op.execute("DROP TABLE IF EXISTS feedback_iter_session CASCADE")

    # Drop enums (CASCADE on the tables above released them, but
    # DROP TYPE IF EXISTS is idempotent so the migration is safe to
    # re-run against partially-cleaned databases).
    op.execute("DROP TYPE IF EXISTS feedback_iter_session_status")
    op.execute("DROP TYPE IF EXISTS feedback_iter_call_status")
    op.execute("DROP TYPE IF EXISTS feedback_iter_assumption_kind")
    op.execute("DROP TYPE IF EXISTS feedback_iter_assumption_status")


def downgrade() -> None:
    # Intentional no-op — see module docstring.
    pass
