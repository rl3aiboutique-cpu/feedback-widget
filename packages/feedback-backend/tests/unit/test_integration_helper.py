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
