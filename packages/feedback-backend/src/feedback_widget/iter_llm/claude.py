"""Anthropic Claude adapter using the ``anthropic`` SDK.

Gated behind the ``[iter-anthropic]`` optional extra. Uses the
async client with streaming when the service requests it.

The default model is configured via ``FEEDBACK_ITER_CLAUDE_MODEL``
in the host's ``.env``; the package never hardcodes a specific
model id so hosts can move forward independently.
"""

from __future__ import annotations

import asyncio
import base64
from collections.abc import AsyncIterator

from anthropic import AsyncAnthropic  # type: ignore[import-untyped]

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

# Per-million-token prices in USD.
_CLAUDE_PRICES_USD_PER_M: dict[str, tuple[float, float]] = {
    "claude-haiku": (0.80, 4.00),
    "claude-sonnet": (3.00, 15.00),
    "claude-opus": (15.00, 75.00),
}


def _resolve_model(settings: FeedbackSettings) -> str:
    model = settings.ITER_CLAUDE_MODEL.strip()
    if not model:
        raise LLMProviderError("FEEDBACK_ITER_CLAUDE_MODEL is empty. Set it in your .env.")
    return model


def _resolve_api_key(settings: FeedbackSettings) -> str:
    secret = settings.ITER_ANTHROPIC_API_KEY
    if secret is None:
        raise LLMProviderError(
            "FEEDBACK_ITER_ANTHROPIC_API_KEY is not set. Add it to " "your host's .env."
        )
    return secret.get_secret_value().strip()


def _build_user_content(
    user_prompt: str,
    attachments: list[LLMAttachment],
) -> list[dict[str, object]]:
    blocks: list[dict[str, object]] = [{"type": "text", "text": user_prompt}]
    for att in attachments:
        if att.kind == "image":
            blocks.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": att.mime_type,
                        "data": att.bytes_b64,
                    },
                }
            )
        elif att.kind == "pdf":
            blocks.append(
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": att.mime_type,
                        "data": att.bytes_b64,
                    },
                }
            )
        else:  # text — inline as a fenced block
            decoded = base64.b64decode(att.bytes_b64).decode("utf-8", "replace")
            blocks.append(
                {
                    "type": "text",
                    "text": f"\n\n--- {att.filename} ---\n{decoded}",
                }
            )
    return blocks


def _wrap_provider_error(exc: BaseException) -> LLMProviderError:
    msg = str(exc) or exc.__class__.__name__
    if isinstance(exc, asyncio.TimeoutError):
        return LLMProviderTimeoutError(msg)
    cls_name = type(exc).__name__
    if cls_name in {"RateLimitError", "OverloadedError"}:
        retry_after = getattr(exc, "retry_after", 0) or 0
        return LLMProviderRateLimitedError(msg, retry_after_seconds=int(retry_after))
    if cls_name in {
        "APIConnectionError",
        "APITimeoutError",
        "InternalServerError",
    }:
        return LLMProviderTransientError(msg)
    return LLMProviderFatalError(msg)


class ClaudeProvider:
    """:class:`LLMProvider` for Anthropic Claude."""

    name = "claude"

    def __init__(self, settings: FeedbackSettings) -> None:
        self._settings = settings
        self._model = _resolve_model(settings)
        self._client = AsyncAnthropic(api_key=_resolve_api_key(settings))

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
                self._client.messages.create(
                    model=self._model,
                    max_tokens=max_output_tokens,
                    temperature=0.2,
                    system=system_prompt,
                    messages=[
                        {
                            "role": "user",
                            "content": _build_user_content(user_prompt, attachments),
                        }
                    ],
                ),
                timeout=timeout_seconds,
            )
        except BaseException as exc:
            raise _wrap_provider_error(exc) from exc
        latency_ms = int((loop.time() - start) * 1000)

        raw_text = "".join(
            block.text
            for block in getattr(response, "content", [])
            if getattr(block, "type", "") == "text"
        )
        usage = getattr(response, "usage", None)
        return LLMResult(
            raw_text=raw_text,
            usage=LLMUsage(
                input_tokens=int(getattr(usage, "input_tokens", 0) or 0),
                output_tokens=int(getattr(usage, "output_tokens", 0) or 0),
                latency_ms=latency_ms,
            ),
            finish_reason=str(getattr(response, "stop_reason", "stop") or "stop"),
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
            async with self._client.messages.stream(
                model=self._model,
                max_tokens=max_output_tokens,
                temperature=0.2,
                system=system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": _build_user_content(user_prompt, attachments),
                    }
                ],
            ) as stream:
                async for text in stream.text_stream:
                    if text:
                        yield text
        except BaseException as exc:
            raise _wrap_provider_error(exc) from exc

    def estimate_cost_usd(self, usage: LLMUsage) -> float | None:
        for prefix, (price_in, price_out) in _CLAUDE_PRICES_USD_PER_M.items():
            if prefix in self._model:
                return (
                    usage.input_tokens * price_in + usage.output_tokens * price_out
                ) / 1_000_000.0
        return None
