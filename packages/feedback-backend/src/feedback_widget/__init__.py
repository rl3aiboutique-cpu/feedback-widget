"""rl3-feedback-widget — public API.

Two functions and three classes are the entire surface a host needs:

>>> from feedback_widget import (
...     FeedbackSettings,
...     FeedbackAuthAdapter,
...     CurrentUserSnapshot,
...     register_feedback_router,
...     run_migrations,
... )

See :func:`register_feedback_router` for the integration entry-point.
"""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

from feedback_widget.auth import CurrentUserSnapshot, FeedbackAuthAdapter
from feedback_widget.deps import WidgetDependencies, build_dependencies
from feedback_widget.integration import (
    make_sync_engine,
    mount_feedback_widget_for_async_host,
)
from feedback_widget.exceptions import (
    FeedbackError,
    FeedbackNotFoundError,
    FeedbackRateLimitExceededError,
    FeedbackTypeRequiresFieldError,
)
from feedback_widget.models import (
    Feedback,
    FeedbackAttachment,
    FeedbackAttachmentKind,
    FeedbackStatus,
    FeedbackType,
)
from feedback_widget.router import build_router
from feedback_widget.settings import FeedbackSettings, get_settings
from feedback_widget.storage import StorageBackend, get_storage_backend

if TYPE_CHECKING:
    from fastapi import FastAPI
    from sqlalchemy.engine import Engine

__version__ = "0.1.13"

logger = logging.getLogger(__name__)

__all__ = [
    "CurrentUserSnapshot",
    "Feedback",
    "FeedbackAttachment",
    "FeedbackAttachmentKind",
    "FeedbackAuthAdapter",
    "FeedbackError",
    "FeedbackNotFoundError",
    "FeedbackRateLimitExceededError",
    "FeedbackSettings",
    "FeedbackStatus",
    "FeedbackType",
    "FeedbackTypeRequiresFieldError",
    "StorageBackend",
    "WidgetDependencies",
    "__version__",
    "build_dependencies",
    "build_router",
    "get_settings",
    "get_storage_backend",
    "make_sync_engine",
    "mount_feedback_widget_for_async_host",
    "register_feedback_router",
    "run_migrations",
]


def register_feedback_router(
    app: "FastAPI",
    *,
    auth: FeedbackAuthAdapter,
    engine: "Engine",
    settings: FeedbackSettings | None = None,
    prefix: str = "/feedback",
    storage: StorageBackend | None = None,
) -> None:
    """Mount the feedback router on a FastAPI app.

    This is the entire backend integration: one call from your host.

    Parameters
    ----------
    app:
        The FastAPI application (or any APIRouter) to mount onto.
    auth:
        Host implementation of :class:`FeedbackAuthAdapter`.
    engine:
        SQLAlchemy ``Engine`` (sync) the widget uses for its sessions.
        For async-native hosts (sapphira), instantiate a dedicated sync
        engine alongside your async one — see ADR-006.
    settings:
        Optional :class:`FeedbackSettings`; defaults to env-driven instantiation.
    prefix:
        Path prefix to mount the router under. Defaults to ``/feedback``.
        Hosts typically pass ``/api/v1/feedback`` to match their existing pattern.
    storage:
        Optional pre-built :class:`StorageBackend`. When ``None``, one is
        constructed from ``settings``. Use this to inject a fake during tests.

    Side effects
    ------------
    The configured storage bucket is created if missing (``ensure_bucket``).
    """
    cfg = settings or get_settings()
    if not cfg.ENABLED:
        logger.info("feedback_widget: ENABLED=false — router NOT registered")
        return

    s3 = storage or get_storage_backend(cfg)
    failsafe = os.environ.get("FEEDBACK_BUCKET_FAILSAFE", "").lower() in (
        "1",
        "true",
        "yes",
    )
    try:
        s3.ensure_bucket()
    except Exception as exc:  # noqa: BLE001 — surface to host operator
        if failsafe:
            logger.warning(
                "feedback_widget: ensure_bucket failed (FAILSAFE on, "
                "router will mount but uploads will 500): %s",
                exc,
                exc_info=True,
            )
        else:
            raise RuntimeError(
                f"feedback_widget: cannot start — ensure_bucket failed for "
                f"endpoint={cfg.S3_ENDPOINT_URL!r} bucket={cfg.BUCKET!r}: {exc}. "
                f"Set FEEDBACK_BUCKET_FAILSAFE=1 to bypass during local tests."
            ) from exc

    deps = build_dependencies(auth=auth, engine=engine, settings=cfg)
    router = build_router(deps=deps, settings=cfg, storage=s3)
    app.include_router(router, prefix=prefix)
    logger.info(
        "feedback_widget: router mounted at %s (multi_tenant=%s, csrf=%s)",
        prefix,
        cfg.MULTI_TENANT_MODE,
        cfg.CSRF_REQUIRED,
    )


def run_migrations(database_url: str | None = None) -> None:
    """Apply the widget's Alembic migrations to the configured database.

    Equivalent to running ``python -m feedback_widget migrate``.

    Parameters
    ----------
    database_url:
        Optional override for the database URL. When ``None``, reads
        ``FEEDBACK_DATABASE_URL`` from the environment.
    """
    from feedback_widget.cli import run_migrations as _impl

    _impl(database_url=database_url)
