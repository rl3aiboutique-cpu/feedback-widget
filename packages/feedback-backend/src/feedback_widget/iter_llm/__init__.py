"""LLM provider abstraction for the Iterate-with-AI module.

Public API:

* :class:`LLMProvider` — Protocol every adapter implements.
* :class:`LLMResult`, :class:`LLMUsage`, :class:`LLMAttachment`,
  :class:`RawTrace` — wire-shape value types.
* :func:`build_provider` — factory that selects an adapter by
  ``FEEDBACK_ITER_PROVIDER`` and raises a clear error if the
  required optional extra (``rl3-feedback-widget[iter-gemini]``,
  ``[iter-anthropic]``, ``[iter-openai]``) is not installed.
* :class:`FakeLLMProvider` — deterministic canned-JSON provider
  used by tests and host CI; zero conditional imports so the
  package's base install stays slim.
"""

from .factory import build_provider
from .fake import FakeLLMProvider
from .protocol import (
    LLMAttachment,
    LLMProvider,
    LLMResult,
    LLMUsage,
    RawTrace,
)

__all__ = [
    "FakeLLMProvider",
    "LLMAttachment",
    "LLMProvider",
    "LLMResult",
    "LLMUsage",
    "RawTrace",
    "build_provider",
]
