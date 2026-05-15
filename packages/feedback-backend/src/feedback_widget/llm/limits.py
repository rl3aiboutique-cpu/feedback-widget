"""Per-model context-window limits.

Single source of truth used by:

* :class:`LLMProvider.context_window` — each adapter resolves its
  currently-active model id against this table.
* :class:`ChatService.run_turn` — computes
  ``feedback_ticket.context_usage_pct`` after each turn so the UI bar
  reflects real saturation.

Verified 2026-05-16 against the provider docs. Update when new models
ship. Lookup uses ``startswith`` so more-specific prefixes MUST come
first (e.g. ``gpt-5-nano`` before ``gpt-5``).
"""

from __future__ import annotations

# Tokens-per-call context window. Ordered most-specific → least-specific
# so ``startswith`` resolution never falls through to a broader entry.
MODEL_CONTEXT_LIMITS: dict[str, int] = {
    # OpenAI ─────────────────────────────────────────────────────────
    "gpt-5-nano": 400_000,
    "gpt-5-mini": 400_000,
    "gpt-5": 400_000,
    "gpt-4o-mini": 128_000,
    "gpt-4o": 128_000,
    "o3-mini": 200_000,
    "o3": 200_000,
    "o1-mini": 128_000,
    "o1": 200_000,
    # Anthropic ──────────────────────────────────────────────────────
    "claude-haiku": 200_000,
    "claude-sonnet": 200_000,
    "claude-opus": 200_000,
    # Google ─────────────────────────────────────────────────────────
    "gemini-2.5-flash-lite": 1_000_000,
    "gemini-2.5-flash": 1_000_000,
    "gemini-2.5-pro": 2_000_000,
    "gemini-flash-lite-latest": 1_000_000,
    "gemini-flash-latest": 1_000_000,
    "gemini-3-flash-preview": 1_000_000,
    "gemini-3.1-flash-lite-preview": 1_000_000,
    # Fake provider used in tests ────────────────────────────────────
    "fake": 1_000_000,
}

#: Fallback when no prefix in :data:`MODEL_CONTEXT_LIMITS` matches.
#: Conservative — better to over-protect than to drift past a real cap.
_DEFAULT_CONTEXT_LIMIT = 128_000


def resolve_context_limit(model_id: str) -> int:
    """Return the published context-window for ``model_id``.

    Falls back to :data:`_DEFAULT_CONTEXT_LIMIT` if no prefix matches.
    """

    for prefix, limit in MODEL_CONTEXT_LIMITS.items():
        if model_id.startswith(prefix):
            return limit
    return _DEFAULT_CONTEXT_LIMIT


def compute_usage_pct(input_tokens: int, output_tokens: int, model_id: str) -> float:
    """Percentage of the model's context window currently occupied.

    Both input and output tokens count toward the cap — the same
    window holds the prompt AND the generated reply. Clamped to
    ``[0.0, 100.0]`` so a corrupted total never produces a UI bar
    that overflows its container.
    """

    limit = resolve_context_limit(model_id)
    if limit <= 0:
        return 0.0
    total = max(0, input_tokens) + max(0, output_tokens)
    pct = (total / limit) * 100.0
    return max(0.0, min(100.0, pct))
