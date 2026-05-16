"""OpenAI Whisper transcription helper (S4 — voice input via backend proxy).

The frontend records audio via the browser's ``MediaRecorder`` API and
POSTs the raw blob to ``POST /chat/sessions/{sid}/voice``. That endpoint
calls :func:`transcribe_audio` here, which delegates to the OpenAI SDK's
``audio.transcriptions.create`` (Whisper).

Audio bytes are NEVER persisted (D-013) — the endpoint reads the multipart
body, hands it to this helper, and discards it. Only the resulting
transcript lives in ``feedback_chat_session.messages[].text``.

The ``openai`` package is gated behind the ``[iter-openai]`` optional
extra (same as :mod:`feedback_widget.llm.openai`). When the extra is
not installed OR ``FEEDBACK_ITER_OPENAI_API_KEY`` is unset, the helper
raises a typed error and the endpoint returns 503 with a clear message.

The optional ``language_hint`` argument is forwarded to Whisper's
``language=`` parameter so the model can lock onto Spanish / English /
etc. when the host knows it up-front. The glossary string is passed as
``prompt=`` for biasing toward domain terminology (product names, code
identifiers — D-009).
"""

from __future__ import annotations

import asyncio
import io
import logging
import re
from dataclasses import dataclass

from .settings import FeedbackSettings

logger = logging.getLogger(__name__)


# Whisper-1 hallucinations on silence / sub-second audio. When the model
# can't find speech it often emits these canned strings (training-data
# artefacts from YouTube-style content). Filter aggressively — false
# positives mean the user has to type, false negatives mean Russian /
# Korean gibberish in a Spanish chat.
_HALLUCINATION_PATTERNS = (
    re.compile(r"^продолжение\s+следует", re.IGNORECASE),
    re.compile(r"^thanks?\s+for\s+watching", re.IGNORECASE),
    re.compile(r"^thank\s+you\s+for\s+watching", re.IGNORECASE),
    re.compile(r"subtitles?\s+by\s+(the\s+)?amara", re.IGNORECASE),
    re.compile(r"^please\s+subscribe", re.IGNORECASE),
    re.compile(r"请订阅"),
    re.compile(r"이\s*영상은"),
    re.compile(r"^bye[\s.!]*$", re.IGNORECASE),
    re.compile(r"^you[\s.!]*$", re.IGNORECASE),
    re.compile(r"^yeah[\s.!]*$", re.IGNORECASE),
    re.compile(r"^mm[-\s]?hmm[\s.!]*$", re.IGNORECASE),
    re.compile(r"^♪+\s*$"),
)

# Audio under ~3 KB at opus 32 kbps is < 0.75 s — Whisper hallucinates
# almost certainly. Reject before round-tripping to the API.
_MIN_AUDIO_BYTES = 3_000


def _is_hallucination(text: str) -> bool:
    """Return True when ``text`` matches a known Whisper silence-output."""
    t = text.strip()
    if not t:
        return True
    for pat in _HALLUCINATION_PATTERNS:
        if pat.search(t):
            return True
    return False


class WhisperConfigError(RuntimeError):
    """Raised when Whisper transcription is not configured.

    The router translates this into a 503 ``Service Unavailable`` so the
    frontend can keep the chat sheet usable in text-only mode.
    """


class WhisperTranscriptionError(RuntimeError):
    """Raised when the upstream Whisper call fails for a reason the
    router cannot map to a config-level 503 (network blip, malformed
    audio, etc.). The router translates this into a 502 ``Bad Gateway``.
    """


@dataclass(frozen=True, slots=True)
class WhisperTranscript:
    """Result of a Whisper transcription call.

    ``transcript`` is the raw text Whisper returned. ``lang`` is the
    BCP-47-ish language code Whisper detected (e.g. ``"es"``, ``"en"``).
    Whisper itself returns ISO-639-1 codes; we pass them through verbatim.
    """

    transcript: str
    lang: str


def _resolve_api_key(settings: FeedbackSettings) -> str:
    """Return the OpenAI API key or raise ``WhisperConfigError``."""
    secret = settings.ITER_OPENAI_API_KEY
    if secret is None:
        raise WhisperConfigError(
            "FEEDBACK_ITER_OPENAI_API_KEY is not set — voice transcription is unavailable."
        )
    key = secret.get_secret_value().strip()
    if not key:
        raise WhisperConfigError(
            "FEEDBACK_ITER_OPENAI_API_KEY is empty — voice transcription is unavailable."
        )
    return key


def _glossary_to_prompt(glossary: dict[str, str] | None) -> str | None:
    """Render the session glossary as a Whisper biasing ``prompt``.

    Whisper's ``prompt`` is at most 224 tokens of context that nudges the
    decoder toward specific vocabulary. We concatenate up to ~30 terms,
    space-separated — enough to bias product/brand names without bumping
    against the limit.
    """
    if not glossary:
        return None
    terms = [v.strip() for v in glossary.values() if isinstance(v, str) and v.strip()]
    if not terms:
        return None
    return " ".join(terms[:30])


# Whisper accepts only ISO-639-1 codes in the ``language`` param.
# ``verbose_json`` response returns the full English name (e.g.
# ``"english"``) which older FE versions reused as the next-turn
# hint, causing 400 invalid_language_format. Mapping covers the
# languages the CRM ships UI in; unknown names drop to None so
# Whisper auto-detects again. Extend when adding new locales.
_LANG_NAME_TO_ISO: dict[str, str] = {
    "english": "en",
    "spanish": "es",
    "portuguese": "pt",
    "french": "fr",
    "german": "de",
    "italian": "it",
    "catalan": "ca",
    "dutch": "nl",
    "japanese": "ja",
    "chinese": "zh",
    "korean": "ko",
    "arabic": "ar",
    "russian": "ru",
}


def _normalise_language_hint(raw: str | None) -> str | None:
    """Return a Whisper-compatible ISO-639-1 code or ``None``."""
    if not raw:
        return None
    candidate = raw.strip().lower()
    if not candidate:
        return None
    # Already ISO-639-1 (2-letter code).
    if len(candidate) == 2 and candidate.isalpha():
        return candidate
    # Full English name lookup.
    return _LANG_NAME_TO_ISO.get(candidate)


async def transcribe_audio(
    audio_bytes: bytes,
    *,
    content_type: str,  # noqa: ARG001 — accepted for API symmetry; SDK infers codec from filename
    filename: str = "audio.webm",
    language_hint: str | None = None,
    glossary: dict[str, str] | None = None,
    settings: FeedbackSettings,
) -> WhisperTranscript:
    """Transcribe ``audio_bytes`` via OpenAI Whisper.

    Parameters
    ----------
    audio_bytes:
        Raw audio file content (opus/webm or mp4). Read once from the
        multipart upload; never persisted.
    content_type:
        MIME type the browser declared. Forwarded to the SDK so it can
        attach the right file extension to the multipart body.
    filename:
        Display filename — Whisper uses the extension to infer codec
        when ``content_type`` is generic. Defaults to ``audio.webm``.
    language_hint:
        ISO-639-1 code (e.g. ``"es"``) to bias detection. ``None`` lets
        Whisper auto-detect.
    glossary:
        Per-session glossary captured at session start. Rendered as
        Whisper's ``prompt=`` argument so product/brand names round-trip.
    settings:
        Loaded :class:`FeedbackSettings` — reads
        ``FEEDBACK_ITER_OPENAI_API_KEY``.

    Returns
    -------
    WhisperTranscript
        Object holding ``transcript`` (text) + ``lang`` (detected
        language code; falls back to ``language_hint or ""`` when Whisper
        did not return one).
    """
    api_key = _resolve_api_key(settings)

    # Min-size guard: opus at 32 kbps yields ~4 KB/s. Anything under
    # _MIN_AUDIO_BYTES is effectively silence + hallucination bait.
    if len(audio_bytes) < _MIN_AUDIO_BYTES:
        logger.info(
            "whisper: rejecting %d-byte clip (< %d) as silence",
            len(audio_bytes),
            _MIN_AUDIO_BYTES,
        )
        return WhisperTranscript(transcript="", lang=language_hint or "")

    # Import lazily so hosts that did not install the [iter-openai] extra
    # still load the package — the helper only fails when actually called.
    try:
        from openai import AsyncOpenAI
    except ImportError as exc:  # pragma: no cover - dep-gated
        raise WhisperConfigError(
            "openai SDK not installed — install the [iter-openai] extra to enable voice."
        ) from exc

    client = AsyncOpenAI(api_key=api_key)
    buf = io.BytesIO(audio_bytes)
    buf.name = filename  # the SDK reads .name to infer extension

    prompt = _glossary_to_prompt(glossary)

    logger.info(
        "whisper: transcribing %d bytes (mime=%s, file=%s, lang_hint=%r)",
        len(audio_bytes),
        content_type,
        filename,
        language_hint,
    )

    # Whisper accepts language as ISO-639-1 (e.g. "en", "es") only.
    # Older clients used to round-trip the full-name response back
    # here ("english", "spanish"), which Whisper rejects with 400
    # invalid_language_format. Map known full names → ISO; pass
    # already-ISO values through untouched; drop everything else.
    iso_hint = _normalise_language_hint(language_hint)

    try:
        # response_format="verbose_json" so we get .language alongside
        # .text. temperature=0 makes the decoder deterministic, which
        # also reduces the hallucination rate on quiet audio.
        resp = await client.audio.transcriptions.create(
            model="whisper-1",
            file=buf,
            language=iso_hint or None,
            prompt=prompt,
            response_format="verbose_json",
            temperature=0,
        )
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        raise WhisperTranscriptionError(f"whisper call failed: {exc}") from exc

    transcript = str(getattr(resp, "text", "") or "").strip()
    # Normalise the response language back to ISO-639-1 too — the FE
    # sticks the last detected language onto subsequent clips, and we
    # only ever want to ship ISO codes outside this module.
    raw_lang = str(getattr(resp, "language", "") or "").strip()
    lang = _normalise_language_hint(raw_lang) or iso_hint or ""

    # Hallucination filter: when Whisper emits the canned silence-output
    # strings, return empty so the frontend stays in voice-idle and the
    # user can retry. Logged so we can tune the patterns if false-positive
    # rate creeps up.
    if _is_hallucination(transcript):
        logger.info(
            "whisper: discarding hallucinated transcript=%r (lang=%r, bytes=%d)",
            transcript,
            lang,
            len(audio_bytes),
        )
        return WhisperTranscript(transcript="", lang=lang)

    return WhisperTranscript(transcript=transcript, lang=lang)
