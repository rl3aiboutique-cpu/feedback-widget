"""Gemini / Gemma adapter using the ``google-genai`` SDK.

Gated behind the ``[iter-gemini]`` optional extra. Talks to the
``generativelanguage.googleapis.com`` endpoint with an API key
header. The same code path serves both Gemini and Gemma 3 models —
they live behind the same SDK and the same endpoint, the only
difference is the model id.

The default model is configured via ``FEEDBACK_ITER_GEMINI_MODEL``
in the host's ``.env``; the package never hardcodes a specific
model id. If the env var is empty the adapter raises a clear
configuration error rather than silently falling back.
"""

from __future__ import annotations

import asyncio
import base64
from collections.abc import AsyncIterator

from google import genai  # type: ignore[import-untyped]
from google.genai import types as gtypes  # type: ignore[import-untyped]

from ..settings import FeedbackSettings
from .protocol import (
    LLMAttachment,
    LLMProviderError,
    LLMProviderFatalError,
    LLMProviderTimeoutError,
    LLMProviderTransientError,
    LLMResult,
    LLMUsage,
)

# Per-million-token prices in USD. Used by ``estimate_cost_usd``.
# Gemma open models are free at the time of writing on the AI Studio
# API tier; we still record token counts but report cost as 0.
_GEMINI_PRICES_USD_PER_M: dict[str, tuple[float, float]] = {
    # model_id_prefix: (input_per_m, output_per_m)
    "gemini-2.5-flash": (0.075, 0.30),
    "gemini-2.5-pro": (1.25, 5.00),
    "gemini-flash-latest": (0.075, 0.30),
    # Gemma is free on AI Studio's developer tier.
    "gemma-3-1b-it": (0.0, 0.0),
    "gemma-3-4b-it": (0.0, 0.0),
    "gemma-3-12b-it": (0.0, 0.0),
    "gemma-3-27b-it": (0.0, 0.0),
}


def _resolve_model(settings: FeedbackSettings) -> str:
    model = settings.ITER_GEMINI_MODEL.strip()
    if not model:
        raise LLMProviderError(
            "FEEDBACK_ITER_GEMINI_MODEL is empty. Set it in your .env "
            "(default: gemma-3-27b-it)."
        )
    return model


def _resolve_api_key(settings: FeedbackSettings) -> str:
    secret = settings.ITER_GEMINI_API_KEY
    if secret is None:
        raise LLMProviderError(
            "FEEDBACK_ITER_GEMINI_API_KEY is not set. Add it to your "
            "host's .env (never commit it; the host's gitleaks hook "
            "will block it anyway)."
        )
    value = secret.get_secret_value().strip()
    if not value:
        raise LLMProviderError(
            "FEEDBACK_ITER_GEMINI_API_KEY is set but empty."
        )
    return value


def _combine_prompts(system_prompt: str, user_prompt: str) -> str:
    """Gemma 3 instruction-tuned models don't expose a system role;
    Gemini 2.5 does, but combining is safe for both. The system
    prompt is prepended verbatim so it remains the first thing the
    model reads."""
    return f"{system_prompt.strip()}\n\n{user_prompt.strip()}\n"


def _build_parts(
    combined_prompt: str,
    attachments: list[LLMAttachment],
) -> list[gtypes.Part]:
    parts: list[gtypes.Part] = [gtypes.Part.from_text(text=combined_prompt)]
    for att in attachments:
        if att.kind == "text":
            parts.append(
                gtypes.Part.from_text(
                    text=f"\n\n--- {att.filename} ---\n"
                    + base64.b64decode(att.bytes_b64).decode("utf-8", "replace"),
                )
            )
            continue
        parts.append(
            gtypes.Part.from_bytes(
                data=base64.b64decode(att.bytes_b64),
                mime_type=att.mime_type,
            )
        )
    return parts


def _build_config(
    settings: FeedbackSettings,
    max_output_tokens: int,
) -> gtypes.GenerateContentConfig:
    # Gemma 3/4 instruction-tuned models do NOT honour
    # ``response_mime_type="application/json"`` — they fall through to
    # free-form text (often with chain-of-thought tokens) which then
    # 500s when combined with the larger system prompt. Detect by
    # model id and only pass the JSON-mode hint for true Gemini
    # models. The parser already strips code fences and validates
    # JSON regardless, so the hint is best-effort.
    is_gemma = settings.ITER_GEMINI_MODEL.lower().startswith("gemma")
    cfg_kwargs: dict[str, object] = {
        "temperature": 0.2,
        "top_p": 0.95,
        "max_output_tokens": max_output_tokens,
    }
    if not is_gemma:
        cfg_kwargs["response_mime_type"] = "application/json"
    return gtypes.GenerateContentConfig(**cfg_kwargs)  # type: ignore[arg-type]


def _wrap_provider_error(exc: BaseException) -> LLMProviderError:
    msg = str(exc) or exc.__class__.__name__
    if isinstance(exc, asyncio.TimeoutError):
        return LLMProviderTimeoutError(msg)
    # The SDK raises google.genai.errors.* — we don't import them
    # at top level to keep the optional-extra surface tight, so we
    # match by class name rather than isinstance.
    cls_name = type(exc).__name__
    if cls_name in {"ServerError", "ServiceUnavailableError", "InternalServerError"}:
        return LLMProviderTransientError(msg)
    return LLMProviderFatalError(msg)


class GeminiProvider:
    """:class:`LLMProvider` for Gemini / Gemma 3 via google-genai."""

    name = "gemini"

    def __init__(self, settings: FeedbackSettings) -> None:
        self._settings = settings
        self._model = _resolve_model(settings)
        self._client = genai.Client(api_key=_resolve_api_key(settings))

    async def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        attachments: list[LLMAttachment],
        timeout_seconds: int,
        max_output_tokens: int,
    ) -> LLMResult:
        combined = _combine_prompts(system_prompt, user_prompt)
        parts = _build_parts(combined, attachments)
        cfg = _build_config(self._settings, max_output_tokens)

        loop = asyncio.get_running_loop()
        start = loop.time()
        try:
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=self._model,
                    contents=[gtypes.Content(role="user", parts=parts)],
                    config=cfg,
                ),
                timeout=timeout_seconds,
            )
        except BaseException as exc:
            raise _wrap_provider_error(exc) from exc
        latency_ms = int((loop.time() - start) * 1000)

        raw_text = response.text or ""
        usage_meta = getattr(response, "usage_metadata", None)
        return LLMResult(
            raw_text=raw_text,
            usage=LLMUsage(
                input_tokens=int(getattr(usage_meta, "prompt_token_count", 0) or 0),
                output_tokens=int(
                    getattr(usage_meta, "candidates_token_count", 0) or 0
                ),
                latency_ms=latency_ms,
            ),
            finish_reason=str(
                getattr(
                    getattr(response, "candidates", [None])[0],
                    "finish_reason",
                    "stop",
                )
            ),
            model_id=self._model,
            model_provider=self.name,
        )

    async def stream(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        attachments: list[LLMAttachment],
        timeout_seconds: int,
        max_output_tokens: int,
    ) -> AsyncIterator[str]:
        # Gemma 3/4 instruction-tuned models on the v1beta endpoint
        # routinely block the streaming endpoint for the full
        # generation latency without ever yielding a chunk (the
        # model emits internal reasoning tokens that ``chunk.text``
        # filters out, then returns the whole answer at the end).
        # Detect by model id and fall back to a non-streaming
        # ``generate()`` chunked into N equal slices so the SSE
        # pipeline still feels alive on the client. Real Gemini
        # models keep native streaming.
        if self._model.lower().startswith("gemma"):
            async for piece in self._fake_stream_via_generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                attachments=attachments,
                timeout_seconds=timeout_seconds,
                max_output_tokens=max_output_tokens,
            ):
                yield piece
            return

        del timeout_seconds  # real Gemini SDK enforces its own
        combined = _combine_prompts(system_prompt, user_prompt)
        parts = _build_parts(combined, attachments)
        cfg = _build_config(self._settings, max_output_tokens)

        try:
            stream = await self._client.aio.models.generate_content_stream(
                model=self._model,
                contents=[gtypes.Content(role="user", parts=parts)],
                config=cfg,
            )
            async for chunk in stream:
                text = chunk.text
                if text:
                    yield text
        except BaseException as exc:
            raise _wrap_provider_error(exc) from exc

    async def _fake_stream_via_generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        attachments: list[LLMAttachment],
        timeout_seconds: int,
        max_output_tokens: int,
    ) -> AsyncIterator[str]:
        """Non-streaming generate() chunked into 256-char slices —
        used for Gemma where native streaming is unreliable."""
        result = await self.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            attachments=attachments,
            timeout_seconds=timeout_seconds,
            max_output_tokens=max_output_tokens,
        )
        text = result.raw_text
        slice_size = 256
        for i in range(0, len(text), slice_size):
            yield text[i : i + slice_size]

    def estimate_cost_usd(self, usage: LLMUsage) -> float | None:
        for prefix, (price_in, price_out) in _GEMINI_PRICES_USD_PER_M.items():
            if self._model.startswith(prefix):
                return (
                    usage.input_tokens * price_in
                    + usage.output_tokens * price_out
                ) / 1_000_000.0
        return None
