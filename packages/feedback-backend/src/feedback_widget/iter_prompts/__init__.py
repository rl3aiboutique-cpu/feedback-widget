"""Versioned prompt material for the Iterate-with-AI module.

Public surface:

* :data:`SYSTEM_PROMPT_V1` — the immutable system prompt every call uses.
* :data:`SYSTEM_PROMPT_VERSION` — a short tag persisted on each
  ``feedback_iter_call`` row so admins can correlate behaviour with
  prompt revisions.
* :func:`build_user_prompt` — assembles the tagged-block user prompt
  per spec §5.2 in strict order.
* :func:`build_repair_hint` — builds the addendum sent on the second
  attempt when the model returned malformed JSON the first time.
"""

from .system_v1 import SYSTEM_PROMPT_V1, SYSTEM_PROMPT_VERSION
from .user_builder import build_repair_hint, build_user_prompt

__all__ = [
    "SYSTEM_PROMPT_V1",
    "SYSTEM_PROMPT_VERSION",
    "build_repair_hint",
    "build_user_prompt",
]
