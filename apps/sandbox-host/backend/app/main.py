"""Sandbox host FastAPI app.

Mounts the feedback widget with the SandboxAuth adapter; CORS is
permissive for ``http://localhost:9001`` (the demo frontend).

Run via:
    uvicorn app.main:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from feedback_widget import (
    FeedbackSettings,
    register_feedback_router,
    run_migrations,
)
from sqlalchemy import create_engine

from app.auth import SandboxAuth

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _create_app() -> FastAPI:
    settings = FeedbackSettings()
    if not settings.DATABASE_URL:
        msg = "FEEDBACK_DATABASE_URL not set"
        raise RuntimeError(msg)

    # Apply the package's migrations on startup so a fresh sandbox
    # spins up green. Idempotent — re-runs are no-ops.
    try:
        run_migrations(database_url=settings.DATABASE_URL)
    except Exception:
        logger.exception("sandbox: run_migrations failed (continuing)")

    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    app = FastAPI(title="feedback-sandbox-host", version="0.0.0")

    cors_origin = os.environ.get("SANDBOX_CORS_ORIGIN", "http://localhost:9001")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[cors_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["sandbox"])
    def health() -> dict[str, str | bool]:
        return {"ok": True, "service": "feedback-sandbox-host"}

    register_feedback_router(
        app,
        auth=SandboxAuth(),
        engine=engine,
        settings=settings,
        prefix="/api/v1/feedback",
    )

    return app


app = _create_app()
