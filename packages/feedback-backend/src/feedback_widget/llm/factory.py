"""Selects a concrete :class:`LLMProvider` at session start.

The factory is the only place that decides which adapter to load
based on :class:`FeedbackSettings.ITER_PROVIDER`. Adapters that
require an optional install (``[iter-gemini]``, ``[iter-anthropic]``,
``[iter-openai]``) raise :class:`MissingProviderExtraError` here
rather than at call time, so misconfiguration surfaces during
session creation rather than mid-stream.
"""

from __future__ import annotations

from typing import cast

from ..settings import FeedbackSettings
from .fake import FakeLLMProvider
from .protocol import LLMProvider


class MissingProviderExtraError(RuntimeError):
    """The selected provider's optional extra is not installed.

    The host needs to install ``rl3-feedback-widget[iter-gemini]``
    (or ``[iter-anthropic]``, ``[iter-openai]``) and restart.
    """


def build_provider(settings: FeedbackSettings) -> LLMProvider:
    """Return a fresh :class:`LLMProvider` matching settings.

    Each call returns a new adapter instance; the service layer
    holds onto it for the lifetime of one iteration request.
    Adapters are stateless across requests so this is safe.
    """
    # Concrete providers satisfy the Protocol structurally; mypy --strict
    # still flags the implicit conversion, so we cast() at the return
    # boundary to make the intent explicit without inheritance noise.
    provider_name = settings.ITER_PROVIDER
    if provider_name == "fake":
        return cast(LLMProvider, FakeLLMProvider())

    if provider_name == "gemini":
        try:
            from .gemini import GeminiProvider
        except ImportError as exc:  # pragma: no cover — install-time concern
            raise MissingProviderExtraError(
                "FEEDBACK_ITER_PROVIDER=gemini but the 'google-genai' SDK is not "
                "installed. Add the extra: "
                "pip install 'rl3-feedback-widget[iter-gemini]'"
            ) from exc
        return cast(LLMProvider, GeminiProvider(settings))

    if provider_name == "claude":
        try:
            from .claude import ClaudeProvider
        except ImportError as exc:  # pragma: no cover
            raise MissingProviderExtraError(
                "FEEDBACK_ITER_PROVIDER=claude but the 'anthropic' SDK is not "
                "installed. Add the extra: "
                "pip install 'rl3-feedback-widget[iter-anthropic]'"
            ) from exc
        return cast(LLMProvider, ClaudeProvider(settings))

    if provider_name == "openai":
        try:
            from .openai import OpenAIProvider
        except ImportError as exc:  # pragma: no cover
            raise MissingProviderExtraError(
                "FEEDBACK_ITER_PROVIDER=openai but the 'openai' SDK is not "
                "installed. Add the extra: "
                "pip install 'rl3-feedback-widget[iter-openai]'"
            ) from exc
        return cast(LLMProvider, OpenAIProvider(settings))

    # Settings already type-narrows to the four valid options, but a
    # belt-and-braces guard keeps mypy happy and makes future adds explicit.
    raise ValueError(f"Unknown FEEDBACK_ITER_PROVIDER: {provider_name!r}")
