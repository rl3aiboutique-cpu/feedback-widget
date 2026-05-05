"""Feature-scoped Pydantic settings for the feedback widget.

All env vars use the ``FEEDBACK_`` prefix. The host application provides a
fully-populated :class:`FeedbackSettings` instance to
:func:`register_feedback_router` (or relies on env-driven instantiation).

Hosts running multi-tenant Postgres-RLS deployments set
``FEEDBACK_MULTI_TENANT_MODE=true``; single-tenant hosts (e.g. sapphira)
leave it false and the widget skips the ``WHERE tenant_id = …`` defence
layer.

The ``ITER_*`` block configures the optional Iterate-with-AI module
(``register_feedback_iter_router``). Disabled by default; the module is
fully gated behind ``FEEDBACK_ITER_ENABLED=true``.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class FeedbackSettings(BaseSettings):
    """Configuration for the feedback widget — all sourced from ``FEEDBACK_*`` env vars."""

    model_config = SettingsConfigDict(
        env_prefix="FEEDBACK_",
        env_file=None,  # the host owns its .env discovery
        case_sensitive=True,
        extra="ignore",
    )

    # ────────────────────────────────────────────────────────────────
    # Master switch
    # ────────────────────────────────────────────────────────────────

    ENABLED: bool = True

    # ────────────────────────────────────────────────────────────────
    # Database
    # ────────────────────────────────────────────────────────────────

    # Sync URL (psycopg / postgresql://...). See ADR-006.
    DATABASE_URL: str = ""

    # ────────────────────────────────────────────────────────────────
    # Object storage (S3-compatible — MinIO in dev)
    # ────────────────────────────────────────────────────────────────

    BUCKET: str = "feedback"
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_PUBLIC_ENDPOINT_URL: str = ""  # falls back to S3_ENDPOINT_URL for presigned URLs
    S3_ACCESS_KEY: str = "feedback"
    S3_SECRET_KEY: str = "feedback-dev-key"
    S3_REGION: str = "us-east-1"
    PRESIGNED_TTL_SECONDS: int = 604_800  # 7 days

    # ────────────────────────────────────────────────────────────────
    # Email (SMTP relay; MailHog in dev)
    # ────────────────────────────────────────────────────────────────

    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = False
    SMTP_SSL: bool = False
    EMAILS_FROM_EMAIL: str = "feedback@example.com"
    EMAILS_FROM_NAME: str = "Feedback Widget"

    # CSV: who gets the "new feedback" email.
    NOTIFY_EMAILS: str = ""

    # ────────────────────────────────────────────────────────────────
    # Limits & branding
    # ────────────────────────────────────────────────────────────────

    RATE_LIMIT_PER_HOUR: int = 20
    MAX_SCREENSHOT_BYTES: int = 10_000_000
    BRAND_NAME: str = "Feedback"
    ADMIN_DEEP_LINK_BASE: str = ""
    # URL of the host's source-code repo, surfaced in the LLM-handoff ZIP
    # README so a coding LLM knows where to apply patches. Empty ⇒ omitted.
    REPO_URL: str = ""

    # ────────────────────────────────────────────────────────────────
    # Security toggles (per ADR-006 + sapphira hallazgos)
    # ────────────────────────────────────────────────────────────────

    # When false, the router does not enforce CSRF double-submit on
    # mutating endpoints. Use false for Bearer-token-only hosts (sapphira).
    CSRF_REQUIRED: bool = True

    # When true, every service query also adds a `WHERE tenant_id = :tid`
    # filter on top of RLS. Required for multi-tenant hosts; off for
    # single-tenant hosts where `tenant_id` is always NULL.
    MULTI_TENANT_MODE: bool = True

    # ────────────────────────────────────────────────────────────────
    # Iterate-with-AI module (optional; off by default)
    # ────────────────────────────────────────────────────────────────

    ITER_ENABLED: bool = False
    ITER_PROVIDER: Literal["gemini", "claude", "openai", "fake"] = "gemini"

    # Model identifiers — empty strings force the host to set them
    # explicitly via env, so we never silently fall back to a stale
    # default that quietly drifts from what the host expected.
    ITER_GEMINI_MODEL: str = ""
    ITER_CLAUDE_MODEL: str = ""
    ITER_OPENAI_MODEL: str = ""

    # API keys — SecretStr so they don't leak into __repr__ / logs.
    ITER_GEMINI_API_KEY: SecretStr | None = None
    ITER_ANTHROPIC_API_KEY: SecretStr | None = None
    ITER_OPENAI_API_KEY: SecretStr | None = None

    # Reasoning budget for providers that expose one (Gemini "thinking",
    # Anthropic "extended thinking", OpenAI reasoning effort).
    ITER_THINKING_MODE: Literal["off", "low", "medium", "high"] = "medium"

    # Per-call generation knobs. Bumped from 120 to 240 because real
    # Gemma calls with a non-trivial prompt (system + worked example +
    # prior versions) can take 130-200s on the free tier; the
    # retry-on-invalid path doubles that since it issues a second
    # generate. Hosts can lower this for production-grade providers.
    ITER_REQUEST_TIMEOUT_SECONDS: int = 240
    ITER_STREAM_HEARTBEAT_SECONDS: int = 15
    ITER_MAX_OUTPUT_TOKENS: int = 16_000

    # Rate limits (spec §7).
    ITER_MAX_CALLS_PER_SESSION: int = 20
    ITER_MAX_CALLS_PER_USER_WEEK: int = 100

    # Diagram rendering. Off by default — Mermaid is not in the widget
    # bundle and would blow the 300KB size budget.
    ITER_RENDER_MERMAID: bool = False

    # Email an admin/notify list when a session is finalized. Reuses
    # the existing FEEDBACK_NOTIFY_EMAILS list.
    ITER_NOTIFY_ON_FINALIZE: bool = True

    # Model id of the downstream consumer that the finalized package's
    # ``_AI_INSTRUCTIONS.md`` primes. Hosts pin this to whatever Claude
    # Code model they actually run; never hardcoded as a Python
    # constant so it can be updated independently of the package.
    ITER_DOWNSTREAM_CONSUMER_MODEL: str = ""

    # ────────────────────────────────────────────────────────────────
    # Derived / computed
    # ────────────────────────────────────────────────────────────────

    @computed_field  # type: ignore[prop-decorator]
    @property
    def notify_emails_list(self) -> list[str]:
        """Parse ``NOTIFY_EMAILS`` (CSV) into a list of stripped addresses."""
        return [e.strip() for e in self.NOTIFY_EMAILS.split(",") if e.strip()]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def s3_public_endpoint(self) -> str:
        """Endpoint used when generating presigned URLs (browser-reachable)."""
        return self.S3_PUBLIC_ENDPOINT_URL or self.S3_ENDPOINT_URL

    @computed_field  # type: ignore[prop-decorator]
    @property
    def emails_enabled(self) -> bool:
        """True only if SMTP_HOST and EMAILS_FROM_EMAIL are set.

        When False, :func:`feedback_widget.email.send_email` no-ops and logs
        a warning instead of raising. This keeps tests + local dev green
        without an SMTP relay.
        """
        return bool(self.SMTP_HOST) and bool(self.EMAILS_FROM_EMAIL)


@lru_cache(maxsize=1)
def get_settings() -> FeedbackSettings:
    """Cached factory.

    Tests that need a fresh instance call ``get_settings.cache_clear()``.
    """
    return FeedbackSettings()
