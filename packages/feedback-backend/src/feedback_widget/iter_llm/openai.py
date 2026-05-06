"""OpenAI adapter using the ``openai`` SDK.

Gated behind the ``[iter-openai]`` optional extra. Uses the async
client with streaming when the service requests it.

The default model is configured via ``FEEDBACK_ITER_OPENAI_MODEL``
in the host's ``.env``; the package never hardcodes a specific
model id.
"""

from __future__ import annotations

import asyncio
import base64
from collections.abc import AsyncIterator

from openai import AsyncOpenAI  # type: ignore[import-untyped]

from ..settings import FeedbackSettings
from .protocol import (
    LLMAttachment,
    LLMProviderError,
    LLMProviderFatalError,
    LLMProviderRateLimitedError,
    LLMProviderTimeoutError,
    LLMProviderTransientError,
    LLMResult,
    LLMUsage,
)

# Per-million-token prices in USD. Conservative defaults; hosts can
# override by patching this table at runtime.
_OPENAI_PRICES_USD_PER_M: dict[str, tuple[float, float]] = {
    "gpt-5": (10.00, 40.00),
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "o1": (15.00, 60.00),
    "o1-mini": (3.00, 12.00),
}


def _resolve_model(settings: FeedbackSettings) -> str:
    model = settings.ITER_OPENAI_MODEL.strip()
    if not model:
        raise LLMProviderError("FEEDBACK_ITER_OPENAI_MODEL is empty. Set it in your .env.")
    return model


def _resolve_api_key(settings: FeedbackSettings) -> str:
    secret = settings.ITER_OPENAI_API_KEY
    if secret is None:
        raise LLMProviderError(
            "FEEDBACK_ITER_OPENAI_API_KEY is not set. Add it to " "your host's .env."
        )
    return secret.get_secret_value().strip()


def _build_messages(
    system_prompt: str,
    user_prompt: str,
    attachments: list[LLMAttachment],
) -> list[dict[str, object]]:
    user_blocks: list[dict[str, object]] = [
        {"type": "text", "text": user_prompt},
    ]
    for att in attachments:
        if att.kind == "image":
            user_blocks.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{att.mime_type};base64,{att.bytes_b64}",
                    },
                }
            )
            continue
        # PDFs and text inline as quoted text — OpenAI's chat-completion
        # API doesn't natively handle PDFs the way Anthropic does.
        decoded = base64.b64decode(att.bytes_b64).decode("utf-8", "replace")
        user_blocks.append(
            {
                "type": "text",
                "text": f"\n\n--- {att.filename} ({att.mime_type}) ---\n{decoded}",
            }
        )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_blocks},
    ]


def _wrap_provider_error(exc: BaseException) -> LLMProviderError:
    msg = str(exc) or exc.__class__.__name__
    if isinstance(exc, asyncio.TimeoutError):
        return LLMProviderTimeoutError(msg)
    cls_name = type(exc).__name__
    if cls_name == "RateLimitError":
        retry_after = getattr(exc, "retry_after", 0) or 0
        return LLMProviderRateLimitedError(msg, retry_after_seconds=int(retry_after))
    if cls_name in {"APIConnectionError", "APITimeoutError", "InternalServerError"}:
        return LLMProviderTransientError(msg)
    return LLMProviderFatalError(msg)


class OpenAIProvider:
    """:class:`LLMProvider` for OpenAI."""

    name = "openai"

    def __init__(self, settings: FeedbackSettings) -> None:
        self._settings = settings
        self._model = _resolve_model(settings)
        self._client = AsyncOpenAI(api_key=_resolve_api_key(settings))

    async def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        attachments: list[LLMAttachment],
        timeout_seconds: int,
        max_output_tokens: int,
    ) -> LLMResult:
        loop = asyncio.get_running_loop()
        start = loop.time()
        try:
            response = await asyncio.wait_for(
                self._client.chat.completions.create(
                    model=self._model,
                    messages=_build_messages(system_prompt, user_prompt, attachments),
                    max_tokens=max_output_tokens,
                    temperature=0.2,
                    top_p=0.95,
                    response_format={"type": "json_object"},
                ),
                timeout=timeout_seconds,
            )
        except BaseException as exc:
            raise _wrap_provider_error(exc) from exc
        latency_ms = int((loop.time() - start) * 1000)

        choice = response.choices[0]
        usage = getattr(response, "usage", None)
        return LLMResult(
            raw_text=choice.message.content or "",
            usage=LLMUsage(
                input_tokens=int(getattr(usage, "prompt_tokens", 0) or 0),
                output_tokens=int(getattr(usage, "completion_tokens", 0) or 0),
                latency_ms=latency_ms,
            ),
            finish_reason=str(getattr(choice, "finish_reason", "stop") or "stop"),
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
        del timeout_seconds  # SDK enforces its own
        try:
            stream = await self._client.chat.completions.create(
                model=self._model,
                messages=_build_messages(system_prompt, user_prompt, attachments),
                max_tokens=max_output_tokens,
                temperature=0.2,
                top_p=0.95,
                response_format={"type": "json_object"},
                stream=True,
            )
            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                text = getattr(delta, "content", None)
                if text:
                    yield text
        except BaseException as exc:
            raise _wrap_provider_error(exc) from exc

    def estimate_cost_usd(self, usage: LLMUsage) -> float | None:
        for prefix, (price_in, price_out) in _OPENAI_PRICES_USD_PER_M.items():
            if self._model.startswith(prefix):
                return (
                    usage.input_tokens * price_in + usage.output_tokens * price_out
                ) / 1_000_000.0
        return None
