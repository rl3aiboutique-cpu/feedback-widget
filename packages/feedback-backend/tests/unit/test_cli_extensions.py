"""Unit tests for the verify / drop-tables / init subcommands of the CLI.

The pre-existing migrate / version / check-config commands are covered
elsewhere; these tests target only the new commands added in v0.1.1.
"""
from __future__ import annotations

import pytest
from typer.testing import CliRunner

from feedback_widget.cli import app
from feedback_widget.settings import get_settings

runner = CliRunner()


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> None:
    """Settings are lru_cached — clear between tests so monkeypatched env vars take effect."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_init_prints_backend_wiring_stub() -> None:
    result = runner.invoke(app, ["init"])
    assert result.exit_code == 0
    assert "register_feedback_router" in result.stdout
    assert "JWTBearerAuth" in result.stdout
    assert "FeedbackProvider" in result.stdout
    assert "FEEDBACK_DATABASE_URL" in result.stdout


def test_verify_without_db_url_exits_nonzero(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FEEDBACK_DATABASE_URL", "")
    monkeypatch.setenv("FEEDBACK_S3_ENDPOINT_URL", "http://localhost:0")
    monkeypatch.setenv("FEEDBACK_SMTP_HOST", "localhost")
    monkeypatch.setenv("FEEDBACK_SMTP_PORT", "1")
    result = runner.invoke(app, ["verify"])
    assert result.exit_code == 1
    assert "FAIL" in result.stdout or "fail" in result.stdout.lower()


def test_drop_tables_without_yes_or_confirmation_aborts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "FEEDBACK_DATABASE_URL", "postgresql+psycopg://x:y@127.0.0.1:1/none"
    )
    result = runner.invoke(app, ["drop-tables"], input="n\n")
    assert "abort" in result.stdout.lower() or result.exit_code != 0


def test_drop_tables_without_db_url_exits_nonzero(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FEEDBACK_DATABASE_URL", "")
    result = runner.invoke(app, ["drop-tables", "--yes"])
    assert result.exit_code == 1


def test_app_help_lists_all_commands() -> None:
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    for cmd in ("migrate", "version", "check-config", "verify", "drop-tables", "init"):
        assert cmd in result.stdout, f"missing command in help: {cmd}"
