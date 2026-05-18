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
# Lookup uses ``startswith`` (see ``estimate_cost_usd`` below) so more
# specific prefixes MUST appear before broader ones — e.g. ``gpt-5-mini``
# before ``gpt-5`` so the cheaper tier is not mispriced as the base
# model. New variants must respect this ordering.
#
# Prices verified 2026-05-15 against pricepertoken.com (mirror of the
# official OpenAI pricing page). Update when models are added or when
# OpenAI publishes price cuts.


# GPT-5 family + o-series reasoners share a tightened API surface:
# they only accept the new ``max_completion_tokens`` key and they
# refuse non-default sampling parameters (temperature / top_p).
# Older chat models keep the legacy contract.
_NEW_API_PREFIXES = ("gpt-5", "o1", "o3")


def _is_new_api_model(model: str) -> bool:
    return any(model.startswith(p) for p in _NEW_API_PREFIXES)


def _max_tokens_kwarg(model: str, value: int) -> dict[str, int]:
    """Pick the right output-cap parameter for the active model.

    For the gpt-5 / o-series surface the cap INCLUDES the (invisible)
    reasoning tokens, so the caller's value — sized for the visible
    JSON response of a chat turn — has to be expanded or the model
    burns the whole budget on reasoning and returns an empty body.
    The 4× headroom is conservative: medium reasoning on nano
    typically eats 500-1500 tokens before emitting the JSON.
    """

    if _is_new_api_model(model):
        return {"max_completion_tokens": max(value * 4, 4000)}
    return {"max_tokens": value}


def _sampling_kwargs(model: str) -> dict[str, float]:
    """Sampling knobs the model accepts. Empty dict for the gpt-5 /
    o-series surface, which rejects anything other than defaults."""

    if _is_new_api_model(model):
        return {}
    return {"temperature": 0.2, "top_p": 0.95}


_OPENAI_PRICES_USD_PER_M: dict[str, tuple[float, float]] = {
    "gpt-5-nano": (0.05, 0.40),
    "gpt-5-mini": (0.25, 2.00),
    "gpt-5": (1.25, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "o3-mini": (1.10, 4.40),
    "o3": (2.00, 8.00),
    "o1-mini": (0.55, 2.20),
    "o1": (15.00, 60.00),
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
            "FEEDBACK_ITER_OPENAI_API_KEY is not set. Add it to your host's .env."
        )
    return secret.get_secret_value().strip()


# Models that accept the `reasoning_effort` knob. Includes the gpt-5
# family (gpt-5, gpt-5-mini, gpt-5-nano) and the o-series reasoners
# (o1, o1-mini, o3, o3-mini). Non-matching models receive None so the
# param is skipped — older models reject it with HTTP 400.
_REASONING_PREFIXES: tuple[str, ...] = ("gpt-5", "o1", "o3")


def _resolve_reasoning_effort(model: str, thinking_mode: str) -> str | None:
    """Map ``FEEDBACK_ITER_THINKING_MODE`` to OpenAI's ``reasoning_effort``.

    Returns ``None`` when reasoning is disabled or the model does not
    support the knob — the caller then omits the param entirely.
    """
    if thinking_mode == "off":
        return None
    if not any(model.startswith(p) for p in _REASONING_PREFIXES):
        return None
    # OpenAI accepts minimal | low | medium | high. We map our "off"
    # to None (handled above) and pass the rest through verbatim.
    return thinking_mode


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
        self._reasoning_effort = _resolve_reasoning_effort(self._model, settings.ITER_THINKING_MODE)
        # Cached usage from the most recent stream call. OpenAI emits
        # the totals in the final chunk when ``stream_options.include_usage``
        # is set; we stash them here so :meth:`last_stream_usage` can
        # surface real tokens to the service layer.
        self._last_stream_usage: LLMUsage | None = None

    @property
    def current_model(self) -> str:
        return self._model

    @property
    def context_window(self) -> int:
        from feedback_widget.llm.limits import resolve_context_limit

        return resolve_context_limit(self._model)

    def last_stream_usage(self) -> LLMUsage | None:
        value, self._last_stream_usage = self._last_stream_usage, None
        return value

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
        kwargs: dict[str, object] = {
            "model": self._model,
            "messages": _build_messages(system_prompt, user_prompt, attachments),
            **_max_tokens_kwarg(self._model, max_output_tokens),
            **_sampling_kwargs(self._model),
            "response_format": {"type": "json_object"},
        }
        if self._reasoning_effort is not None:
            kwargs["reasoning_effort"] = self._reasoning_effort
        try:
            response = await asyncio.wait_for(
                self._client.chat.completions.create(**kwargs),
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
        self._last_stream_usage = None
        kwargs: dict[str, object] = {
            "model": self._model,
            "messages": _build_messages(system_prompt, user_prompt, attachments),
            **_max_tokens_kwarg(self._model, max_output_tokens),
            **_sampling_kwargs(self._model),
            "response_format": {"type": "json_object"},
            "stream": True,
            # Required so the final chunk carries usage metadata; the
            # field is silently dropped by providers that don't support
            # it (it's an OpenAI-only key).
            "stream_options": {"include_usage": True},
        }
        if self._reasoning_effort is not None:
            kwargs["reasoning_effort"] = self._reasoning_effort
        try:
            stream = await self._client.chat.completions.create(**kwargs)
            async for chunk in stream:
                # ``chunk.usage`` is populated only on the final chunk
                # when ``include_usage`` is set. Cache it for the
                # service layer's audit row + denormalized totals.
                usage = getattr(chunk, "usage", None)
                if usage is not None:
                    self._last_stream_usage = LLMUsage(
                        input_tokens=int(getattr(usage, "prompt_tokens", 0) or 0),
                        output_tokens=int(getattr(usage, "completion_tokens", 0) or 0),
                    )
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
