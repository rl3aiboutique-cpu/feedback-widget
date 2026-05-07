"""Provider-agnostic LLM types and Protocol.

Adapters implement :class:`LLMProvider`. The service layer
(``iter_service.py``) only ever talks to this Protocol so swapping
providers is one env-var flip plus an optional-extras install.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Literal, Protocol, runtime_checkable

from pydantic import BaseModel, Field


class LLMUsage(BaseModel):
    """Token + latency metering for a single call."""

    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0


class LLMAttachment(BaseModel):
    """One PDF / image / text blob that the LLM must consume.

    ``bytes_b64`` is already base64-encoded so the adapter can pass
    it straight to the provider's multimodal content blocks without
    re-reading from disk or MinIO.
    """

    kind: Literal["pdf", "image", "text"]
    filename: str
    mime_type: str
    bytes_b64: str


class LLMResult(BaseModel):
    """Outcome of a non-streaming :meth:`LLMProvider.generate` call.

    ``raw_text`` is exactly what the model returned (after stripping
    optional code fences); the parser layer is responsible for
    validating + retrying on malformed JSON.
    """

    raw_text: str
    usage: LLMUsage = Field(default_factory=LLMUsage)
    finish_reason: str = "stop"
    model_id: str
    model_provider: str


class RawTrace(BaseModel):
    """Audit-trail snapshot of a single call.

    Stored alongside ``feedback_iter_call`` rows so the admin panel
    can render the exact prompt that produced a given version. The
    bodies are gzipped before being uploaded to MinIO; this struct
    only carries hashes + sizes.
    """

    prompt_sha256: str
    prompt_byte_size: int
    response_byte_size: int
    finish_reason: str = "stop"


@runtime_checkable
class LLMProvider(Protocol):
    """Adapter contract every concrete provider implements."""

    name: str
    """Short slug used in logs / DB rows: ``"gemini"``, ``"claude"``,
    ``"openai"``, ``"fake"``."""

    @property
    def current_model(self) -> str:
        """The model id currently serving traffic.

        Providers that maintain a fallback chain (gemini) flip this
        property when they walk to the next model after a transient
        error. The service layer reads it between streamed chunks so
        it can emit a ``provider_fallback`` SSE event for the UI when
        the value changes.
        """

    async def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        attachments: list[LLMAttachment],
        timeout_seconds: int,
        max_output_tokens: int,
    ) -> LLMResult:
        """One-shot, non-streaming completion. Returns the full
        response text or raises a typed exception (timeout, provider
        error, etc.)."""

    def stream(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        attachments: list[LLMAttachment],
        timeout_seconds: int,
        max_output_tokens: int,
    ) -> AsyncIterator[str]:
        """Streaming completion. Yields raw text chunks as the
        provider produces them. The caller accumulates and parses;
        the adapter does no JSON validation of its own."""

    def estimate_cost_usd(self, usage: LLMUsage) -> float | None:
        """Best-effort price estimate from a per-model price table.

        Returns ``None`` when the model is not in the table; the
        ``feedback_iter_call.cost_usd`` column accepts NULL for
        exactly this reason.
        """


class LLMProviderError(RuntimeError):
    """Base for typed provider failures."""


class LLMProviderTimeoutError(LLMProviderError):
    """Provider exceeded the configured request timeout."""


class LLMProviderTransientError(LLMProviderError):
    """5xx, network blip, or transient auth failure — retry-eligible."""


class LLMProviderFatalError(LLMProviderError):
    """4xx (other than 429), schema mismatch, or other terminal failure."""


class LLMProviderRateLimitedError(LLMProviderError):
    """The provider itself rate-limited us. Surface to the user with
    a Retry button — do NOT count against our per-session limit."""

    retry_after_seconds: int

    def __init__(self, message: str, *, retry_after_seconds: int = 0) -> None:
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds
