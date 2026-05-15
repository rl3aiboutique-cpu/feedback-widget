"""Compatibility shim for the unified ticket entity (2026-05-16).

Historically this module owned the ``Feedback`` SQLModel + the
``FeedbackComment`` + ``FeedbackAttachment`` tables. The 2026-05-16
unification collapsed ``feedback`` + ``feedback_chat_session`` into a
single ``feedback_ticket`` entity (see ``vault/wiki/captures/decision/
2026-05-16_grilled-ticket-unification.md``) and dropped the standalone
``feedback_comment`` table — admin messages now live in
``feedback_ticket.messages`` JSONB as ``role="admin"`` entries.

Rather than mass-rewriting every ``from feedback_widget.models import
...`` across the codebase, this shim re-exports the unified enums and
table classes under their historical names. Net effect: callers still
write ``FeedbackStatus``, ``Feedback`` (the legacy alias now points at
the unified ``FeedbackTicket``), ``FeedbackAttachment``, etc., without
having to learn a new module path.

The shim is intentionally thin — it should never grow new logic.
Anything new belongs in ``chat_models``.
"""

from __future__ import annotations

# Re-export everything the rest of the codebase pulls from this module.
from feedback_widget.chat_models import (
    AdminActionKind,
    ChatCallStatus,
    ChatSessionMode,
    ChatSessionStatus,
    DeletedByRole,
    FeedbackAdminAction,
    FeedbackAttachment,
    FeedbackAttachmentKind,
    FeedbackChatCall,
    FeedbackSeverity,
    FeedbackStatus,
    FeedbackTicket,
    FeedbackType,
)

# ── Backwards-compatible aliases ────────────────────────────────────
# The legacy ``Feedback`` SQLModel and the chat-first
# ``FeedbackChatSession`` SQLModel were merged into ``FeedbackTicket``.
# Code that still imports ``Feedback`` or ``FeedbackChatSession`` from
# this module keeps working unchanged — both are now aliases for the
# unified ticket entity.
Feedback = FeedbackTicket
FeedbackChatSession = FeedbackTicket

# The legacy comment table was dropped — admin messages now live in
# ``feedback_ticket.messages`` JSONB. We deliberately do NOT alias
# ``FeedbackComment`` to anything else — callers that still import it
# will fail loudly, which is the right outcome (they need to migrate
# to reading the messages array instead).

__all__ = [
    "AdminActionKind",
    "ChatCallStatus",
    "ChatSessionMode",
    "ChatSessionStatus",
    "DeletedByRole",
    "Feedback",
    "FeedbackAdminAction",
    "FeedbackAttachment",
    "FeedbackAttachmentKind",
    "FeedbackChatCall",
    "FeedbackChatSession",
    "FeedbackSeverity",
    "FeedbackStatus",
    "FeedbackTicket",
    "FeedbackType",
]
