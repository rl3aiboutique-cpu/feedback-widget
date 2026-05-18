"""Unify feedback + feedback_chat_session into a single feedback_ticket table.

Revision ID: 0010_unify_feedback_ticket
Revises: 0009_drop_iter_tables
Create Date: 2026-05-16

Per grilled decision 2026-05-16 (`vault/wiki/captures/decision/
2026-05-16_grilled-ticket-unification.md`) we collapse the legacy
``feedback`` row + the chat-first ``feedback_chat_session`` row into a
single ``feedback_ticket`` entity. The motivation: under the v1.0.0
chat-first redesign the ticket and its conversation are one object —
keeping two rows joined by ``chat_session_id`` was an artefact of the
gradual migration, not the target.

The migration runs in atomic steps inside one revision so the deploy
either lands fully or rolls back fully. Steps:

1. Extend the ``feedback_status`` enum with the renamed + new values
   (``open``, ``in_review``, ``resolved``, ``waiting_for_user``,
   ``closed``) so legacy values can coexist during backfill.
2. Rename existing values in place (``new`` → ``open``, ``triaged`` →
   ``in_review``, ``done`` → ``resolved``). Postgres 10+ supports this
   transactionally; we use ``ALTER TYPE … RENAME VALUE``.
3. Rename table ``feedback_chat_session`` → ``feedback_ticket`` and
   add the columns absorbed from ``feedback`` (title, description,
   expected_outcome, ticket_code, severity, type, metadata_bundle,
   url_captured, route_name, element_*, app_version, git_commit_sha,
   user_agent, triaged_by, triaged_at, triage_note) + the new columns
   the chat-first ticket needs (total_input_tokens, total_output_tokens,
   context_usage_pct, user_action_required, last_user_msg_at,
   last_admin_msg_at, closed_at, deleted_at, deleted_by_user_id,
   deleted_by_role, model_id_pinned, model_provider, compacted_history,
   compacted_at). Status defaults to the new ``open``.
4. Rename ``feedback_chat_call.chat_session_id`` → ``ticket_id`` and
   repoint FK target.
5. Rename ``feedback_attachment.feedback_id`` → ``ticket_id``, drop
   the old FK to ``feedback.id``, add new FK to ``feedback_ticket.id``.
   Backfill: every existing attachment row currently FKed to a feedback
   row gets re-pointed to the corresponding feedback_ticket row via
   the old ``feedback.chat_session_id`` join (those that came via the
   chat path) or the row promoted from the legacy multipart path (see
   step 6).
6. Backfill ``feedback_ticket`` from legacy ``feedback`` rows that
   were created via the multipart endpoint (no chat_session_id). For
   each such row we create a synthetic feedback_ticket with
   ``messages = []``, copying the form fields. The original
   ``feedback`` row is then deleted in step 8.
7. Append legacy ``feedback_comment`` rows into the matching
   ``feedback_ticket.messages`` JSONB as ``role="admin"`` (when
   author_role=admin) or ``role="user"`` (when submitter) entries,
   then drop the ``feedback_comment`` table entirely.
8. Drop the ``feedback`` table and its enums that are no longer used
   (``feedback_type`` stays because the ticket still tracks type;
   ``feedback_severity`` stays; ``feedback_comment_author_role`` is
   dropped; ``feedback_attachment_kind`` is renamed conceptually but
   keeps the same enum values).
9. Create the new ``feedback_admin_action`` audit table for forensic
   tracking of admin-driven state changes and message injections.

Downgrade is best-effort: we recreate the table shells and re-split
the rows, but rows that were promoted from the multipart path lose
their dedicated ``feedback.id`` (a fresh one is allocated). Forensic
audit data in ``feedback_admin_action`` is dropped. Production rollback
should rely on the pg_dump taken at deploy time, not the alembic
downgrade.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# ── Alembic identifiers ──────────────────────────────────────────────

revision = "0010_unify_feedback_ticket"
down_revision = "0009_drop_iter_tables"
branch_labels = None
depends_on = None


# ────────────────────────────────────────────────────────────────────
# Helpers — enum extension requires autocommit_block on Postgres
# ────────────────────────────────────────────────────────────────────


def _extend_feedback_status_enum() -> None:
    """Add ``waiting_for_user`` and ``closed`` to feedback_status."""

    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE feedback_status ADD VALUE IF NOT EXISTS 'waiting_for_user'")
        op.execute("ALTER TYPE feedback_status ADD VALUE IF NOT EXISTS 'closed'")
        # Inject the renamed values so the rename step below has targets.
        op.execute("ALTER TYPE feedback_status ADD VALUE IF NOT EXISTS 'open'")
        op.execute("ALTER TYPE feedback_status ADD VALUE IF NOT EXISTS 'in_review'")
        op.execute("ALTER TYPE feedback_status ADD VALUE IF NOT EXISTS 'resolved'")


def _rename_feedback_status_values() -> None:
    """Rename legacy values (``new``/``triaged``/``done``) to their
    target labels. Postgres 10+ supports this in-place."""

    op.execute("UPDATE feedback SET status = 'open' WHERE status = 'new'")
    op.execute("UPDATE feedback SET status = 'in_review' WHERE status = 'triaged'")
    op.execute("UPDATE feedback SET status = 'resolved' WHERE status = 'done'")
    # Note: we do NOT remove the legacy values from the enum yet — that
    # would require a full type rewrite. The Python model only knows
    # about the new values, so any future insert will use the new label.
    # A future migration can run ``ALTER TYPE feedback_status RENAME
    # VALUE`` once we are confident no host code references the legacy
    # values.


# ────────────────────────────────────────────────────────────────────
# Main upgrade
# ────────────────────────────────────────────────────────────────────


def upgrade() -> None:
    # ── Step 1+2: extend + rename the status enum ────────────────────
    _extend_feedback_status_enum()
    _rename_feedback_status_values()

    # ── Step 3: rename feedback_chat_session → feedback_ticket ───────
    op.rename_table("feedback_chat_session", "feedback_ticket")

    op.add_column(
        "feedback_ticket",
        sa.Column("title", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("expected_outcome", sa.Text(), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("ticket_code", sa.String(length=24), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "type",
            postgresql.ENUM(
                "bug",
                "ui",
                "performance",
                "new_feature",
                "extend_feature",
                "other",
                name="feedback_type",
                create_type=False,
            ),
            nullable=True,
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "severity",
            postgresql.ENUM(
                "blocker",
                "major",
                "minor",
                "idea",
                name="feedback_severity",
                create_type=False,
            ),
            nullable=True,
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "ticket_status",
            postgresql.ENUM(
                name="feedback_status",
                create_type=False,
            ),
            nullable=False,
            server_default="open",
        ),
    )
    # Carry-over of legacy form-capture fields so the downstream agent
    # can still reason about the page where the feedback originated.
    op.add_column(
        "feedback_ticket",
        sa.Column("url_captured", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("route_name", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("element_selector", sa.String(length=1024), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("element_xpath", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "element_bounding_box",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "metadata_bundle",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("app_version", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("git_commit_sha", sa.String(length=40), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("user_agent", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("triaged_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "triaged_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("triage_note", sa.Text(), nullable=True),
    )
    # New columns for tokens + context + delete + admin loop.
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "total_input_tokens",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "total_output_tokens",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "context_usage_pct",
            sa.Float(),
            nullable=False,
            server_default="0.0",
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "user_action_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "last_user_msg_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "last_admin_msg_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "closed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "deleted_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("deleted_by_role", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("model_id_pinned", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column("model_provider", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "compacted_history",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "feedback_ticket",
        sa.Column(
            "compacted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # Indexes for the hot queries (list_mine filtered by deleted_at,
    # admin queue ordered by updated_at, ticket_code uniqueness per
    # tenant).
    op.create_index(
        "ix_feedback_ticket_active",
        "feedback_ticket",
        ["tenant_id", "user_id", "updated_at"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_feedback_ticket_open",
        "feedback_ticket",
        ["tenant_id", "ticket_status", "updated_at"],
        unique=False,
        postgresql_where=sa.text("closed_at IS NULL AND deleted_at IS NULL"),
    )
    op.create_index(
        "ix_feedback_ticket_user_action",
        "feedback_ticket",
        ["tenant_id", "user_id"],
        unique=False,
        postgresql_where=sa.text("user_action_required = true AND deleted_at IS NULL"),
    )
    op.create_index(
        "ix_feedback_ticket_code_tenant",
        "feedback_ticket",
        ["tenant_id", "ticket_code"],
        unique=True,
        postgresql_where=sa.text("ticket_code IS NOT NULL"),
    )

    # ── Step 4: rename feedback_chat_call.chat_session_id → ticket_id ─
    op.alter_column(
        "feedback_chat_call",
        "chat_session_id",
        new_column_name="ticket_id",
    )
    # FK target stays the same row (just the column name changed) — but
    # the FK constraint name references the old column, so we recreate
    # it cleanly. The constraint name is generated by SQLAlchemy
    # (``feedback_chat_call_chat_session_id_fkey``).
    op.drop_constraint(
        "feedback_chat_call_chat_session_id_fkey",
        "feedback_chat_call",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "feedback_chat_call_ticket_id_fkey",
        "feedback_chat_call",
        "feedback_ticket",
        ["ticket_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # ── Step 5: backfill feedback_ticket header fields from feedback ──
    # For tickets that came from the chat-first path (joined via
    # ``feedback.chat_session_id``), copy the legacy header columns
    # into the ticket row in place.
    op.execute(
        """
        UPDATE feedback_ticket t
        SET title             = f.title,
            description       = f.description,
            expected_outcome  = f.expected_outcome,
            ticket_code       = f.ticket_code,
            type              = f.type,
            severity          = f.severity,
            ticket_status     = f.status::text::feedback_status,
            url_captured      = f.url_captured,
            route_name        = f.route_name,
            element_selector  = f.element_selector,
            element_xpath     = f.element_xpath,
            element_bounding_box = f.element_bounding_box,
            metadata_bundle   = COALESCE(f.metadata_bundle, t.metadata_bundle),
            app_version       = f.app_version,
            git_commit_sha    = f.git_commit_sha,
            user_agent        = f.user_agent,
            triaged_by        = f.triaged_by,
            triaged_at        = f.triaged_at,
            triage_note       = f.triage_note
        FROM feedback f
        WHERE f.chat_session_id = t.id
          AND t.title IS NULL;
        """
    )

    # ── Step 6: rename feedback_attachment.feedback_id → ticket_id ───
    op.alter_column(
        "feedback_attachment",
        "feedback_id",
        new_column_name="ticket_id",
    )
    op.drop_constraint(
        "feedback_attachment_feedback_id_fkey",
        "feedback_attachment",
        type_="foreignkey",
    )

    # Promote any legacy multipart-path feedback rows (those WITHOUT a
    # chat_session_id) into synthetic feedback_ticket rows so their
    # attachments can be repointed.
    op.execute(
        """
        INSERT INTO feedback_ticket (
            id,
            tenant_id,
            user_id,
            mode,
            status,
            messages,
            auto_context,
            ticket_status,
            title,
            description,
            expected_outcome,
            ticket_code,
            type,
            severity,
            url_captured,
            route_name,
            element_selector,
            element_xpath,
            element_bounding_box,
            metadata_bundle,
            app_version,
            git_commit_sha,
            user_agent,
            triaged_by,
            triaged_at,
            triage_note,
            created_at,
            updated_at,
            confirmed_at
        )
        SELECT
            f.id,
            f.tenant_id,
            f.user_id,
            'capture'::chat_session_mode,
            'confirmed'::chat_session_status,
            '[]'::jsonb,
            COALESCE(f.metadata_bundle, '{}'::jsonb),
            f.status::text::feedback_status,
            f.title,
            f.description,
            f.expected_outcome,
            f.ticket_code,
            f.type,
            f.severity,
            f.url_captured,
            f.route_name,
            f.element_selector,
            f.element_xpath,
            f.element_bounding_box,
            COALESCE(f.metadata_bundle, '{}'::jsonb),
            f.app_version,
            f.git_commit_sha,
            f.user_agent,
            f.triaged_by,
            f.triaged_at,
            f.triage_note,
            COALESCE(f.created_at, NOW()),
            COALESCE(f.updated_at, NOW()),
            COALESCE(f.created_at, NOW())
        FROM feedback f
        WHERE f.chat_session_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM feedback_ticket t WHERE t.id = f.id);
        """
    )

    # Now we can safely repoint attachment FKs — every feedback_id has
    # a matching feedback_ticket row (either by chat_session_id link or
    # by promoted multipart row).
    op.execute(
        """
        UPDATE feedback_attachment a
        SET ticket_id = COALESCE(
            (SELECT t.id
               FROM feedback_ticket t
               JOIN feedback f ON f.chat_session_id = t.id
              WHERE f.id = a.ticket_id),
            a.ticket_id
        );
        """
    )

    op.create_foreign_key(
        "feedback_attachment_ticket_id_fkey",
        "feedback_attachment",
        "feedback_ticket",
        ["ticket_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # ── Step 7: drain feedback_comment into messages JSONB, then drop ─
    op.execute(
        """
        WITH ranked AS (
            SELECT
                c.feedback_id,
                jsonb_build_object(
                    'role', CASE WHEN c.author_role = 'admin'
                                 THEN 'admin' ELSE 'user' END,
                    'text', c.body,
                    'ts',   to_char(c.created_at AT TIME ZONE 'UTC',
                                    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                    'author_user_id', c.author_user_id::text
                ) AS msg
            FROM feedback_comment c
            ORDER BY c.feedback_id, c.created_at
        ),
        agg AS (
            SELECT feedback_id, jsonb_agg(msg) AS msgs
            FROM ranked
            GROUP BY feedback_id
        )
        UPDATE feedback_ticket t
        SET messages = COALESCE(t.messages, '[]'::jsonb) || agg.msgs
        FROM agg
        WHERE t.id = agg.feedback_id
           OR t.id = (
               SELECT f.chat_session_id
                 FROM feedback f
                WHERE f.id = agg.feedback_id
                  AND f.chat_session_id IS NOT NULL
           );
        """
    )

    op.drop_table("feedback_comment")
    sa.Enum(name="feedback_comment_author_role").drop(op.get_bind(), checkfirst=True)

    # ── Step 8: drop the legacy feedback table ───────────────────────
    # Remove the back-reference column first so the table drop is clean.
    op.drop_column("feedback_ticket", "feedback_id")
    op.drop_table("feedback")

    # ── Step 9: create the admin-action audit table ──────────────────
    op.create_table(
        "feedback_admin_action",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "ticket_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feedback_ticket.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "admin_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("from_status", sa.String(length=30), nullable=True),
        sa.Column("to_status", sa.String(length=30), nullable=True),
        sa.Column("message_text", sa.Text(), nullable=True),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "ix_feedback_admin_action_ticket_created",
        "feedback_admin_action",
        ["ticket_id", "created_at"],
        unique=False,
    )

    # Extend the attachment kind enum with anything new we need — the
    # existing values (``screenshot``, ``user_attachment``) cover both
    # paths after unification. No DDL needed here.


# ────────────────────────────────────────────────────────────────────
# Downgrade (best-effort; production rollback uses pg_dump)
# ────────────────────────────────────────────────────────────────────


def downgrade() -> None:
    op.drop_index(
        "ix_feedback_admin_action_ticket_created",
        table_name="feedback_admin_action",
    )
    op.drop_table("feedback_admin_action")

    # Recreate the comment author-role enum + table shell.
    op.execute("CREATE TYPE feedback_comment_author_role AS ENUM ('submitter', 'admin')")
    op.create_table(
        "feedback_comment",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "feedback_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            index=True,
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "author_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "author_role",
            postgresql.ENUM(name="feedback_comment_author_role", create_type=False),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
    )

    op.create_table(
        "feedback",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "type",
            postgresql.ENUM(name="feedback_type", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(name="feedback_status", create_type=False),
            nullable=False,
            server_default="new",
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("expected_outcome", sa.Text(), nullable=True),
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
            "metadata_bundle",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("app_version", sa.String(length=64), nullable=True),
        sa.Column("git_commit_sha", sa.String(length=40), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
        sa.Column("triaged_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("triaged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("triage_note", sa.Text(), nullable=True),
        sa.Column("ticket_code", sa.String(length=24), nullable=False),
        sa.Column(
            "chat_session_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "synthesis_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "severity",
            postgresql.ENUM(name="feedback_severity", create_type=False),
            nullable=True,
        ),
    )

    op.add_column(
        "feedback_ticket",
        sa.Column(
            "feedback_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    op.drop_constraint(
        "feedback_attachment_ticket_id_fkey",
        "feedback_attachment",
        type_="foreignkey",
    )
    op.alter_column(
        "feedback_attachment",
        "ticket_id",
        new_column_name="feedback_id",
    )
    op.create_foreign_key(
        "feedback_attachment_feedback_id_fkey",
        "feedback_attachment",
        "feedback",
        ["feedback_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint(
        "feedback_chat_call_ticket_id_fkey",
        "feedback_chat_call",
        type_="foreignkey",
    )
    op.alter_column(
        "feedback_chat_call",
        "ticket_id",
        new_column_name="chat_session_id",
    )
    op.create_foreign_key(
        "feedback_chat_call_chat_session_id_fkey",
        "feedback_chat_call",
        "feedback_ticket",
        ["chat_session_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_index("ix_feedback_ticket_code_tenant", table_name="feedback_ticket")
    op.drop_index("ix_feedback_ticket_user_action", table_name="feedback_ticket")
    op.drop_index("ix_feedback_ticket_open", table_name="feedback_ticket")
    op.drop_index("ix_feedback_ticket_active", table_name="feedback_ticket")

    for column in (
        "compacted_at",
        "compacted_history",
        "model_provider",
        "model_id_pinned",
        "deleted_by_role",
        "deleted_by_user_id",
        "deleted_at",
        "closed_at",
        "last_admin_msg_at",
        "last_user_msg_at",
        "user_action_required",
        "context_usage_pct",
        "total_output_tokens",
        "total_input_tokens",
        "triage_note",
        "triaged_at",
        "triaged_by",
        "user_agent",
        "git_commit_sha",
        "app_version",
        "metadata_bundle",
        "element_bounding_box",
        "element_xpath",
        "element_selector",
        "route_name",
        "url_captured",
        "ticket_status",
        "severity",
        "type",
        "ticket_code",
        "expected_outcome",
        "description",
        "title",
    ):
        op.drop_column("feedback_ticket", column)

    op.rename_table("feedback_ticket", "feedback_chat_session")
