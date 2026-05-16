"""Versioned prompt material for the chat-first redesign (v1.0.0).

Public surface:

* :data:`CAPTURE_SYSTEM_PROMPT` — D-015 capture-mode system prompt
  template. Contains ``{BRAND}`` / ``{GLOSSARY}`` literal placeholders
  that :func:`build_user_message` injects via ``str.format(...)``.
* :func:`build_user_message` — assembles the OpenAI-style messages
  array from prior chat history + auto-context for the current turn.

Refine-mode prompt lives in S6 (out of scope for S2 Batch A).
"""

from .capture_prompt import CAPTURE_SYSTEM_PROMPT
from .user_builder import build_user_message, format_capture_system_prompt

__all__ = [
    "CAPTURE_SYSTEM_PROMPT",
    "build_user_message",
    "format_capture_system_prompt",
]
