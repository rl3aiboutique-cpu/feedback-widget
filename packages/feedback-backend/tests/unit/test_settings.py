"""Settings parsing + computed properties."""

from __future__ import annotations

import pytest
from feedback_widget.settings import FeedbackSettings, get_settings


def test_defaults_are_safe() -> None:
    settings = FeedbackSettings()
    assert settings.ENABLED is True
    assert settings.MULTI_TENANT_MODE is True  # default favours CRM-style hosts
    assert settings.CSRF_REQUIRED is True
    assert settings.MAX_SCREENSHOT_BYTES == 10_000_000
    assert settings.RATE_LIMIT_PER_HOUR == 20


def test_notify_emails_csv_parsing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FEEDBACK_NOTIFY_EMAILS", "a@x.com, b@x.com ,, c@x.com")
    s = FeedbackSettings()
    assert s.notify_emails_list == ["a@x.com", "b@x.com", "c@x.com"]


def test_emails_enabled_requires_both_smtp_and_from(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FEEDBACK_SMTP_HOST", "")
    monkeypatch.setenv("FEEDBACK_EMAILS_FROM_EMAIL", "from@example.com")
    assert FeedbackSettings().emails_enabled is False

    monkeypatch.setenv("FEEDBACK_SMTP_HOST", "mailhog")
    monkeypatch.setenv("FEEDBACK_EMAILS_FROM_EMAIL", "")
    assert FeedbackSettings().emails_enabled is False

    monkeypatch.setenv("FEEDBACK_SMTP_HOST", "mailhog")
    monkeypatch.setenv("FEEDBACK_EMAILS_FROM_EMAIL", "from@example.com")
    assert FeedbackSettings().emails_enabled is True


def test_s3_public_endpoint_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FEEDBACK_S3_ENDPOINT_URL", "http://internal:9000")
    monkeypatch.setenv("FEEDBACK_S3_PUBLIC_ENDPOINT_URL", "")
    assert FeedbackSettings().s3_public_endpoint == "http://internal:9000"

    monkeypatch.setenv("FEEDBACK_S3_PUBLIC_ENDPOINT_URL", "https://cdn.example.com")
    assert FeedbackSettings().s3_public_endpoint == "https://cdn.example.com"


def test_get_settings_is_cached() -> None:
    get_settings.cache_clear()
    a = get_settings()
    b = get_settings()
    assert a is b
