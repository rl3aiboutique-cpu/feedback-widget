"""iter v0.4.0 — convergence + scrubber + multiple-choice columns.

Adds three column groups so the iter module can converge instead of
looping indefinitely and so the user never sees jargon the prompt
already forbids:

* ``feedback_iter_version.is_complete`` (bool, default false) — model
  signals the spec is ready; the UI swaps "Run iteration" for
  "Mark ready".
* ``feedback_iter_version.completion_reason`` (text, nullable) — short
  user-facing sentence explaining why the model thinks it's done.
* ``feedback_iter_assumption.options`` (jsonb array, nullable) — when
  present, the UI renders the assumption as a multiple-choice card
  with these strings as radio options.
* ``feedback_iter_call.scrub_log`` (jsonb array, nullable) — audit
  trail of forbidden-word rewrites and drop-and-retry decisions.
  Each entry: ``{"slot_key": str, "original": str, "rewritten": str |
  None, "matched_words": [str], "action": "rewrite" | "drop"}``.

All changes are additive and nullable / defaulted — the downgrade
drops the columns cleanly. No enum changes (the existing
``FeedbackIterAssumptionStatus`` 4-value enum stays as-is; the new
"Skip" UI action reuses ``irrelevant`` with a marker on
``user_response``, per the refined plan).

Revision ID: 0006_iter_scrub_completion
Revises: 0005_iter_module
Create Date: 2026-05-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0006_iter_scrub_completion"
down_revision = "0005_iter_module"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "feedback_iter_version",
        sa.Column(
            "is_complete",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "feedback_iter_version",
        sa.Column(
            "completion_reason",
            sa.Text(),
            nullable=True,
        ),
    )
    op.add_column(
        "feedback_iter_assumption",
        sa.Column(
            "options",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "feedback_iter_call",
        sa.Column(
            "scrub_log",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("feedback_iter_call", "scrub_log")
    op.drop_column("feedback_iter_assumption", "options")
    op.drop_column("feedback_iter_version", "completion_reason")
    op.drop_column("feedback_iter_version", "is_complete")
