"""High-level helpers for hosts.

The two functions exported here are the entire backend surface a host
needs when running an async-native FastAPI app (sapphira, capellai-ai-crm,
etc.). They eliminate ~50 lines of host-side boilerplate (sync engine
construction, eager connectivity check, lifespan-aware engine disposal,
register_router call) and replace it with a single function call.

Hosts that need finer control still use ``register_feedback_router``
directly — this module is a convenience wrapper, not a replacement.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

from feedback_widget.adapters.jwt_bearer import JWTBearerAuth
from feedback_widget.auth import FeedbackAuthAdapter
from feedback_widget.settings import FeedbackSettings, get_settings

logger = logging.getLogger(__name__)


def make_sync_engine(
    database_url: str,
    *,
    pool_size: int = 2,
    max_overflow: int = 2,
    pool_pre_ping: bool = True,
    eager_connect_check: bool = True,
) -> Engine:
    """Build a sync SQLAlchemy Engine for the widget.

    Async-native hosts (asyncpg, async SQLModel) need a parallel sync
    engine for the widget's CRUD. This helper validates connectivity
    eagerly so misconfigured DB URLs surface at startup instead of at
    the first feedback request.
    """
    eng = create_engine(
        database_url,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_pre_ping=pool_pre_ping,
    )
    if eager_connect_check:
        try:
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
        except OperationalError as exc:
            raise RuntimeError(
                f"feedback_widget: cannot connect sync engine to "
                f"{database_url!r}: {exc}"
            ) from exc
    return eng


def mount_feedback_widget_for_async_host(
    app: FastAPI,
    *,
    auth: FeedbackAuthAdapter | None = None,
    secret_key: str | None = None,
    algorithm: str = "HS256",
    prefix: str = "/api/v1/feedback",
    settings: FeedbackSettings | None = None,
) -> None:
    """One-call install for async-native FastAPI hosts.

    Either pass ``auth=`` (your own FeedbackAuthAdapter implementation)
    OR pass ``secret_key=`` to use the bundled ``JWTBearerAuth``
    (decode-only, picks up FEEDBACK_TRIAGE_ROLES env for is_master_admin).

    What this does:
    1. Validates FEEDBACK_DATABASE_URL is set.
    2. Builds a sync engine + runs SELECT 1 (fail-fast at startup).
    3. Calls ``register_feedback_router(app, auth, engine, prefix)``.
    4. Stores the engine on ``app.state.feedback_widget_engine``.
    5. Registers a shutdown hook that disposes the engine — no
       connection leaks across hot reloads or SIGTERM.

    Hosts that want a different setup (custom storage backend, custom
    auth adapter with DB lookup, multiple mounts) call
    ``register_feedback_router`` directly.
    """
    # Local import to avoid a circular dep at module-load time.
    from feedback_widget import register_feedback_router

    cfg = settings or get_settings()
    if not cfg.DATABASE_URL:
        raise RuntimeError(
            "feedback_widget: FEEDBACK_DATABASE_URL must be set "
            "before calling mount_feedback_widget_for_async_host"
        )
    if auth is None:
        if not secret_key:
            raise RuntimeError(
                "feedback_widget: pass auth=... OR secret_key=... to "
                "mount_feedback_widget_for_async_host"
            )
        auth = JWTBearerAuth(secret_key=secret_key, algorithm=algorithm)

    engine = make_sync_engine(cfg.DATABASE_URL)
    register_feedback_router(app, auth=auth, engine=engine, settings=cfg, prefix=prefix)
    app.state.feedback_widget_engine = engine
    logger.info(
        "feedback_widget: mounted at %s with auto-managed sync engine", prefix
    )

    @app.on_event("shutdown")
    def _dispose_feedback_engine() -> None:
        engine.dispose()
        logger.info("feedback_widget: sync engine disposed on shutdown")
