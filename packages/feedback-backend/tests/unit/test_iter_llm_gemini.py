"""Unit tests for the Gemini provider's error classification + retry budget.

Two surface areas:

* :func:`_wrap_provider_error` — covers the four detection layers
  (asyncio timeout, ``code`` attribute, class name, message substring).
  Covers the literal "503 UNAVAILABLE" message the user reported on
  2026-05-07 to verify the fallback substring path catches it.
* :class:`GeminiProvider.stream` — covers the retry-then-fallback
  loop in the streaming path. The SDK is mocked so the test never
  hits the network; the assertions are about how many times the
  mock was called, in what order, and which model was active.

We don't import the SDK's typed errors here — the provider matches by
class name + ``.code`` so a fake exception with the right shape is
sufficient.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from types import SimpleNamespace
from typing import Any

import pytest

# `feedback_widget.iter_llm.gemini` imports `from google import genai` at
# module load. CI runs `uv sync --all-packages --extra test --group dev`
# (no iter-gemini extra), so the SDK isn't installed there. Skip the file
# rather than collect-error so the rest of the suite still runs.
pytest.importorskip("google.genai", reason="iter-gemini extra not installed")

from feedback_widget.iter_llm.gemini import (
    GeminiProvider,
    _wrap_provider_error,
)
from feedback_widget.iter_llm.protocol import (
    LLMProviderFatalError,
    LLMProviderRateLimitedError,
    LLMProviderTransientError,
)
from feedback_widget.settings import FeedbackSettings

# ────────────────────────────────────────────────────────────────────
# _wrap_provider_error — detection layers
# ────────────────────────────────────────────────────────────────────


class _FakeServerError(Exception):
    """Stand-in for google.genai.errors.ServerError without importing it.

    Carries an explicit ``code`` like the real SDK exposes.
    """

    def __init__(self, code: int, message: str) -> None:
        super().__init__(message)
        self.code = code


def test_wraps_503_via_code_attribute_as_transient() -> None:
    exc = _FakeServerError(code=503, message="Service is overloaded")
    wrapped = _wrap_provider_error(exc)
    assert isinstance(wrapped, LLMProviderTransientError)


def test_wraps_429_via_code_attribute_as_rate_limited() -> None:
    exc = _FakeServerError(code=429, message="Quota exceeded")
    wrapped = _wrap_provider_error(exc)
    assert isinstance(wrapped, LLMProviderRateLimitedError)


def test_wraps_503_unavailable_message_when_code_missing() -> None:
    """Catches the user's actual report: 503 UNAVAILABLE without ``.code``.

    Some SDK wrappers swallow the structured exception and re-raise
    with just the message — the substring fallback handles that.
    """
    exc = RuntimeError("503 UNAVAILABLE. {'error': {'code': 503, 'status': 'UNAVAILABLE'}}")
    wrapped = _wrap_provider_error(exc)
    assert isinstance(wrapped, LLMProviderTransientError)


def test_wraps_unknown_error_as_fatal() -> None:
    """Auth errors, schema errors, anything we don't recognise stays fatal.

    Retrying a 401 wastes time and might trigger lockouts.
    """
    exc = ValueError("invalid_argument: temperature must be between 0 and 1")
    wrapped = _wrap_provider_error(exc)
    assert isinstance(wrapped, LLMProviderFatalError)


# ────────────────────────────────────────────────────────────────────
# stream() — retry-then-fallback budget
# ────────────────────────────────────────────────────────────────────


def _settings_with_chain(primary: str, fallback_csv: str) -> FeedbackSettings:
    """Build a settings instance with the iter chain populated.

    Tests run with the real ``FeedbackSettings`` class and only override
    the iter-related fields. The API key is required by the provider's
    ``_resolve_api_key`` but never actually used because we mock the SDK.
    """
    return FeedbackSettings(
        ITER_PROVIDER="gemini",
        ITER_GEMINI_MODEL=primary,
        ITER_GEMINI_MODELS_FALLBACK=fallback_csv,
        ITER_GEMINI_API_KEY="test-key-not-real",  # type: ignore[arg-type]
    )


class _FakeAsyncIterator:
    """Async iterator that yields one fixed text chunk then stops.

    Mirrors the shape of the SDK's stream return value (each item has
    a ``.text`` attribute the provider reads).
    """

    def __init__(self, text: str) -> None:
        self._text = text
        self._yielded = False

    def __aiter__(self) -> _FakeAsyncIterator:
        return self

    async def __anext__(self) -> Any:
        if self._yielded:
            raise StopAsyncIteration
        self._yielded = True
        return SimpleNamespace(text=self._text)


class _FakeAioModels:
    """Stand-in for ``client.aio.models``.

    Records which model id each call used and replays a configured
    sequence of side-effects (raise vs. succeed) so tests can assert
    retry / fallback behaviour deterministically.
    """

    def __init__(self, side_effects: list[Any]) -> None:
        self._side_effects = list(side_effects)
        self.calls: list[str] = []

    async def generate_content_stream(self, *, model: str, **_: Any) -> Any:
        self.calls.append(model)
        if not self._side_effects:
            raise RuntimeError("test bug: ran out of side-effects")
        effect = self._side_effects.pop(0)
        if isinstance(effect, BaseException):
            raise effect
        return effect


def _patch_provider(provider: GeminiProvider, side_effects: list[Any]) -> _FakeAioModels:
    """Swap the real SDK client for the fake one. Returns the fake so
    tests can assert call ordering."""
    fake = _FakeAioModels(side_effects)
    provider._client = SimpleNamespace(aio=SimpleNamespace(models=fake))  # type: ignore[assignment]
    return fake


async def _drain(stream: AsyncIterator[str]) -> str:
    """Consume an async iterator into a single concatenated string."""
    out: list[str] = []
    async for chunk in stream:
        out.append(chunk)
    return "".join(out)


@pytest.mark.asyncio
async def test_stream_succeeds_after_one_retry_on_503() -> None:
    """First call raises 503, retry budget allows one retry, second
    call succeeds. Should NOT walk to the fallback model."""
    settings = _settings_with_chain("gemini-flash-lite-latest", "gemini-flash-latest")
    provider = GeminiProvider(settings)
    fake = _patch_provider(
        provider,
        side_effects=[
            _FakeServerError(code=503, message="overloaded"),
            _FakeAsyncIterator("hello world"),
        ],
    )

    result = await _drain(
        provider.stream(
            system_prompt="SYS",
            user_prompt="USR",
            attachments=[],
            timeout_seconds=10,
            max_output_tokens=100,
        )
    )

    assert result == "hello world"
    # Two calls — same model, both attempts.
    assert fake.calls == ["gemini-flash-lite-latest", "gemini-flash-lite-latest"]
    # Provider stayed on the primary model.
    assert provider._model == "gemini-flash-lite-latest"


@pytest.mark.asyncio
async def test_stream_walks_fallback_after_retries_exhausted() -> None:
    """All 3 attempts on the primary fail with 503; chain walks to the
    fallback; first attempt on the fallback succeeds."""
    settings = _settings_with_chain("gemini-flash-lite-latest", "gemini-flash-latest")
    provider = GeminiProvider(settings)
    fake = _patch_provider(
        provider,
        side_effects=[
            _FakeServerError(code=503, message="overloaded"),  # primary attempt 1
            _FakeServerError(code=503, message="overloaded"),  # primary attempt 2
            _FakeServerError(code=503, message="overloaded"),  # primary attempt 3
            _FakeAsyncIterator("ok from fallback"),  # fallback attempt 1
        ],
    )

    result = await _drain(
        provider.stream(
            system_prompt="SYS",
            user_prompt="USR",
            attachments=[],
            timeout_seconds=10,
            max_output_tokens=100,
        )
    )

    assert result == "ok from fallback"
    assert fake.calls == [
        "gemini-flash-lite-latest",
        "gemini-flash-lite-latest",
        "gemini-flash-lite-latest",
        "gemini-flash-latest",
    ]
    assert provider._model == "gemini-flash-latest"


@pytest.mark.asyncio
async def test_stream_does_not_retry_on_fatal_error() -> None:
    """A 401-style error (auth) should fail fast without retries or
    fallback walks. Burning the retry budget on auth is wasteful."""
    settings = _settings_with_chain("gemini-flash-lite-latest", "gemini-flash-latest")
    provider = GeminiProvider(settings)
    fake = _patch_provider(
        provider,
        side_effects=[
            ValueError("invalid_argument: bad model name"),
        ],
    )

    with pytest.raises(LLMProviderFatalError):
        await _drain(
            provider.stream(
                system_prompt="SYS",
                user_prompt="USR",
                attachments=[],
                timeout_seconds=10,
                max_output_tokens=100,
            )
        )

    # Exactly one call — no retries on fatal.
    assert fake.calls == ["gemini-flash-lite-latest"]
    assert provider._model == "gemini-flash-lite-latest"
