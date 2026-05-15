"""Build the OpenAI-style messages array for one chat turn.

Distinct from ``iter_prompts/user_builder.py`` (which assembles a
single tagged-block user prompt for the one-shot iter call).

Chat uses an actual conversation array — system + user/assistant
pairs across multiple turns — because the LLM needs to see prior
candidate replies in order to walk the grill-me discovery tree
without re-asking already-covered branches.

The screenshot (D-015 multimodal context) is injected ONLY on the
turn 1 user message; subsequent turns are text-only so we don't
blow the context window on repeated image bytes.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any

from feedback_widget.chat_prompts.capture_prompt import CAPTURE_SYSTEM_PROMPT
from feedback_widget.llm.protocol import LLMAttachment

# Default placeholder rendered into the prompt when the host supplies
# no glossary. Mirrors the iter convention so the model knows there is
# no domain vocabulary to honour, instead of seeing a dangling "{...}".
_NO_GLOSSARY_TOKEN = "(no glossary supplied)"


def format_capture_system_prompt(
    *,
    brand: str,
    glossary: dict[str, str] | None,
    language: str | None = None,
) -> str:
    """Inject ``{BRAND}``, ``{GLOSSARY}`` and ``{LANGUAGE}`` into the
    capture prompt (Sprint B v3).

    Other ``{...}`` blocks in the prompt body are pre-escaped as
    ``{{...}}`` so :meth:`str.format` leaves them intact.

    ``language`` is the natural-language name the model should use for
    the user-facing ``reply`` (e.g. "Spanish", "English"). When the
    chat session has not yet detected a language (turn 1, before any
    user utterance), pass ``None`` and the prompt falls back to
    "the user's language" so the model auto-mirrors the first user
    turn.
    """
    rendered_glossary = _format_glossary(glossary)
    rendered_language = (language or "").strip() or "the user's language"
    return CAPTURE_SYSTEM_PROMPT.format(
        BRAND=brand,
        GLOSSARY=rendered_glossary,
        LANGUAGE=rendered_language,
    )


def _format_glossary(glossary: dict[str, str] | None) -> str:
    """Render the host glossary as compact key→value lines.

    Empty / None ⇒ a stable placeholder so the system prompt body
    keeps a constant shape (the persisted hash stays stable for
    hosts without a glossary).
    """
    if not glossary:
        return _NO_GLOSSARY_TOKEN
    rows = [f'"{k}": {v}' for k, v in glossary.items() if k and v]
    return "; ".join(rows) if rows else _NO_GLOSSARY_TOKEN


def _format_auto_context_block(auto_context: dict[str, Any] | None) -> str:
    """Compact JSON of the technical context we want the model to see.

    Sprint B / capture_v3 expands the field list to match the legacy
    iter-module's "technical_metadata" block: url, route, viewport,
    app_version, git_commit_sha, user_role, framework,
    console_errors_tail (kept as console_tail for backwards compat),
    network_errors_tail, element_selector, element_xpath,
    element_outer_html (truncated client-side). Anything else in
    ``auto_context`` is intentionally dropped — the prompt is a
    contract, not a dumping ground.
    """
    ac = auto_context or {}
    picked: dict[str, Any] = {
        "url": ac.get("url"),
        "route": ac.get("route"),
        "viewport": ac.get("viewport"),
        "app_version": ac.get("app_version"),
        "git_commit_sha": ac.get("git_commit_sha"),
        "user_role": ac.get("user_role"),
        "framework": ac.get("framework"),
        # Legacy field name preserved for backwards compat with v2 prompt;
        # frontend Sprint B writes the extended capture under the same key.
        "console_tail": ac.get("console_tail") or [],
        "network_errors_tail": ac.get("network_errors_tail") or [],
        "element_selector": ac.get("element_selector"),
        "element_xpath": ac.get("element_xpath"),
        "element_outer_html": ac.get("element_outer_html"),
    }
    return json.dumps(picked, ensure_ascii=False)


def build_user_message(
    *,
    messages: Sequence[dict[str, Any]],
    auto_context: dict[str, Any] | None,
    glossary: dict[str, str] | None,
    brand: str,
    language: str | None = None,
    screenshot: LLMAttachment | None = None,
    force_synthesize: bool = False,
) -> list[dict[str, Any]]:
    """Build the OpenAI-style messages array for one LLM call.

    Parameters
    ----------
    messages
        Persisted conversation history from ``FeedbackChatSession.messages``.
        Items look like ``{"role": "user" | "assistant", "text": "..."}``;
        the most recent item MUST be the just-appended user turn.
    auto_context
        Cherry-picked technical context (url, route, viewport, etc.)
        rendered as a JSON block on the very first user message.
    glossary
        Host product vocabulary substituted into the system prompt.
    brand
        Host product name substituted into ``{BRAND}``.
    screenshot
        Optional multimodal attachment injected on turn 1 ONLY.
        Subsequent turns are text-only to keep token cost bounded.
    force_synthesize
        D-003 backstop. When the service has already counted ≥ 5
        prior user turns OR ``covered_total >= 0.7``, the caller
        flips this to true and we append a hard instruction telling
        the model to emit ``mode="synthesize"`` on this turn.
    """
    system_content = format_capture_system_prompt(
        brand=brand, glossary=glossary, language=language
    )
    if force_synthesize:
        system_content += (
            "\n\nFORCED INSTRUCTION FOR THIS TURN: the turn cap or the "
            "minimum coverage threshold has been reached. Emit "
            'mode="synthesize" with the best possible "synthesis" you '
            "can build from the context available. Do not ask any more "
            "questions."
        )
    out: list[dict[str, Any]] = [{"role": "system", "content": system_content}]

    if not messages:
        return out

    user_turn_index = 0
    for msg in messages:
        role = msg.get("role")
        text = msg.get("text", "")
        if role not in ("user", "assistant"):
            # Defensive: JSONB allows any shape; we skip unknown roles
            # rather than corrupt the LLM input. The session is the
            # source of truth so loss is observable in the DB row.
            continue
        if role == "user":
            user_turn_index += 1
            # Sprint B / capture_v3: the auto_context block is heavy
            # (URLs, console/network errors, element outerHTML); we
            # render it ONLY on turn 1 to keep cost bounded. The
            # screenshot, however, attaches to every user turn so the
            # model can reason visually about follow-up grilling turns.
            include_context = user_turn_index == 1
            out.append(
                _build_user_message(
                    text=text,
                    auto_context=auto_context if include_context else None,
                    screenshot=screenshot,
                )
            )
        else:
            out.append({"role": "assistant", "content": text})

    return out


def _build_user_message(
    *,
    text: str,
    auto_context: dict[str, Any] | None,
    screenshot: LLMAttachment | None,
) -> dict[str, Any]:
    """Compose a user message: optional auto_context tag block + text +
    optional multimodal screenshot.

    The screenshot is rendered as an ``image_url`` data URL part using
    OpenAI-style multimodal content. Providers that don't honour
    multimodal fall back to ignoring the image part — the parser is
    robust to that path.
    """
    context_block = _format_auto_context_block(auto_context) if auto_context else ""
    text_block = (
        f"<auto_context>\n{context_block}\n</auto_context>\n\n{text}"
        if context_block
        else text
    )
    if screenshot is None:
        return {"role": "user", "content": text_block}
    return {
        "role": "user",
        "content": [
            {"type": "text", "text": text_block},
            {
                "type": "image_url",
                "image_url": {
                    "url": (
                        f"data:{screenshot.mime_type};base64,{screenshot.bytes_b64}"
                    ),
                },
            },
        ],
    }
