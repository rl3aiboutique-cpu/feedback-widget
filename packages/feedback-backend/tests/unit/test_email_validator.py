"""Tests for FeedbackCreatePayload.follow_up_email shape validation.

The validator replaces strict EmailStr (which rejects .local TLDs) with
a loose-shape check that still defends against header injection and
obvious malformations.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from feedback_widget.schemas import FeedbackCreatePayload


def _payload(email: str | None = None) -> dict:
    return {
        "type": "bug",
        "title": "x",
        "description": "y",
        "url_captured": "http://example.com/",
        **({"follow_up_email": email} if email is not None else {}),
    }


def test_accepts_dot_local_tld() -> None:
    """Regression: pydantic EmailStr rejected .local — we must accept it."""
    p = FeedbackCreatePayload.model_validate(_payload("manager@sapphira.local"))
    assert p.follow_up_email == "manager@sapphira.local"


def test_accepts_dot_test_tld() -> None:
    p = FeedbackCreatePayload.model_validate(_payload("user@example.test"))
    assert p.follow_up_email == "user@example.test"


def test_accepts_normal_email() -> None:
    p = FeedbackCreatePayload.model_validate(_payload("a@b.com"))
    assert p.follow_up_email == "a@b.com"


def test_empty_string_coerces_to_none() -> None:
    """The frontend sends "" when the user clears the field — opt-out."""
    p = FeedbackCreatePayload.model_validate(_payload(""))
    assert p.follow_up_email is None


def test_rejects_newline_injection() -> None:
    """Header injection: \\r\\n + Bcc: would route the magic-link to an attacker."""
    with pytest.raises(ValidationError):
        FeedbackCreatePayload.model_validate(
            _payload("victim@example.com\r\nBcc: attacker@evil.com")
        )


def test_rejects_lone_lf() -> None:
    with pytest.raises(ValidationError):
        FeedbackCreatePayload.model_validate(_payload("a\nb@c.com"))


def test_rejects_lone_cr() -> None:
    with pytest.raises(ValidationError):
        FeedbackCreatePayload.model_validate(_payload("a\rb@c.com"))


def test_rejects_tab() -> None:
    with pytest.raises(ValidationError):
        FeedbackCreatePayload.model_validate(_payload("a\tb@c.com"))


def test_rejects_internal_whitespace() -> None:
    with pytest.raises(ValidationError):
        FeedbackCreatePayload.model_validate(_payload("a b@c.com"))


def test_rejects_multiple_at_signs() -> None:
    with pytest.raises(ValidationError):
        FeedbackCreatePayload.model_validate(_payload("a@b@c.com"))


def test_rejects_empty_local_part() -> None:
    with pytest.raises(ValidationError):
        FeedbackCreatePayload.model_validate(_payload("@b.com"))


def test_rejects_empty_domain() -> None:
    with pytest.raises(ValidationError):
        FeedbackCreatePayload.model_validate(_payload("a@"))


def test_rejects_dot_at_domain_edge() -> None:
    """domain='b.' splits to ['b', ''] — last label empty, must reject."""
    with pytest.raises(ValidationError):
        FeedbackCreatePayload.model_validate(_payload("a@b."))


def test_rejects_leading_dot_in_domain() -> None:
    """domain='.b' splits to ['', 'b'] — first label empty, must reject."""
    with pytest.raises(ValidationError):
        FeedbackCreatePayload.model_validate(_payload("a@.b"))


def test_rejects_no_dot_in_domain() -> None:
    with pytest.raises(ValidationError):
        FeedbackCreatePayload.model_validate(_payload("a@localhost"))
