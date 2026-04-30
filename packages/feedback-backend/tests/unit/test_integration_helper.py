"""Tests for mount_feedback_widget_for_async_host + make_sync_engine."""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI

from feedback_widget import make_sync_engine, mount_feedback_widget_for_async_host
from feedback_widget.settings import get_settings


@pytest.fixture(autouse=True)
def _reset_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_make_sync_engine_returns_psycopg_engine() -> None:
    eng = make_sync_engine(
        "postgresql+psycopg://x:y@127.0.0.1:1/none",
        eager_connect_check=False,
    )
    assert eng is not None
    assert "psycopg" in str(eng.url.drivername)


def test_make_sync_engine_eager_check_raises_on_unreachable_db() -> None:
    """Misconfigured DB fails fast at startup, not at first request."""
    with pytest.raises(RuntimeError, match="cannot connect sync engine"):
        make_sync_engine(
            "postgresql+psycopg://x:y@127.0.0.1:1/none",
            eager_connect_check=True,
        )


def test_mount_helper_raises_if_database_url_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FEEDBACK_DATABASE_URL", "")
    app = FastAPI()
    with pytest.raises(RuntimeError, match="FEEDBACK_DATABASE_URL"):
        mount_feedback_widget_for_async_host(app, auth=MagicMock(), secret_key="k")


def test_mount_helper_raises_if_neither_auth_nor_secret_provided(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "FEEDBACK_DATABASE_URL", "postgresql+psycopg://x:y@127.0.0.1:1/none"
    )
    app = FastAPI()
    # Eager DB connect would fail anyway, but the auth check fires first.
    with pytest.raises(RuntimeError, match="auth=|secret_key="):
        mount_feedback_widget_for_async_host(app)


def test_double_mount_is_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    """Calling mount_feedback_widget_for_async_host twice on the same app
    must NOT build a second engine (the first would leak from app.state)."""
    monkeypatch.setenv("FEEDBACK_DATABASE_URL", "postgresql+psycopg://x:y@127.0.0.1:1/none")
    monkeypatch.setenv("FEEDBACK_S3_ENDPOINT_URL", "http://127.0.0.1:1")
    monkeypatch.setenv("FEEDBACK_S3_ACCESS_KEY", "x")
    monkeypatch.setenv("FEEDBACK_S3_SECRET_KEY", "y")
    monkeypatch.setenv("FEEDBACK_BUCKET", "test")
    monkeypatch.setenv("FEEDBACK_BUCKET_FAILSAFE", "1")

    fake_engine = MagicMock()
    fake_engine.url.drivername = "postgresql+psycopg"
    from feedback_widget import integration as integration_mod

    call_count = {"n": 0}

    def _factory(*_, **__):
        call_count["n"] += 1
        return fake_engine

    monkeypatch.setattr(integration_mod, "make_sync_engine", _factory)

    app = FastAPI()
    mount_feedback_widget_for_async_host(app, auth=MagicMock(), secret_key="k")
    assert call_count["n"] == 1
    # Second call: the guard should short-circuit.
    mount_feedback_widget_for_async_host(app, auth=MagicMock(), secret_key="k")
    assert call_count["n"] == 1, "second mount must not build a new engine"


def test_lifespan_composition_disposes_engine_on_shutdown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The composed lifespan MUST call engine.dispose() when the host
    enters/exits its own lifespan (the deprecated on_event was silently
    skipped when the host had a `lifespan=` ctx — this test pins the fix).
    """
    monkeypatch.setenv("FEEDBACK_DATABASE_URL", "postgresql+psycopg://x:y@127.0.0.1:1/none")
    monkeypatch.setenv("FEEDBACK_S3_ENDPOINT_URL", "http://127.0.0.1:1")
    monkeypatch.setenv("FEEDBACK_S3_ACCESS_KEY", "x")
    monkeypatch.setenv("FEEDBACK_S3_SECRET_KEY", "y")
    monkeypatch.setenv("FEEDBACK_BUCKET", "test")
    monkeypatch.setenv("FEEDBACK_BUCKET_FAILSAFE", "1")  # tolerate no live S3

    fake_engine = MagicMock()
    fake_engine.url.drivername = "postgresql+psycopg"

    from feedback_widget import integration as integration_mod

    monkeypatch.setattr(integration_mod, "make_sync_engine", lambda *_, **__: fake_engine)

    from fastapi.testclient import TestClient

    app = FastAPI()
    mount_feedback_widget_for_async_host(app, auth=MagicMock(), secret_key="k")
    # TestClient enters/exits the lifespan; this is the only way to
    # exercise the shutdown path without spinning up uvicorn.
    with TestClient(app):
        assert fake_engine.dispose.call_count == 0  # not yet disposed
    # On exit the lifespan composer MUST have called dispose.
    assert fake_engine.dispose.call_count == 1
