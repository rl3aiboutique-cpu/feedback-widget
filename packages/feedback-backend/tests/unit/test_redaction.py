"""Server-side redaction defence-in-depth — must strip Authorization-like
patterns from any string in the metadata bundle, even when the
client-side redactor missed them.
"""

from __future__ import annotations

import pytest
from feedback_widget.redaction import redact_bundle, redact_string


@pytest.mark.parametrize(
    "raw,expected_substr",
    [
        ("Authorization: Bearer abc.def.ghi", "[REDACTED]"),
        ("authorization: bearer xyz", "[REDACTED]"),
        ("Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig", "[REDACTED]"),
        ('"Authorization":"Bearer foo"', "[REDACTED]"),
    ],
)
def test_redact_string_strips_authorization(raw: str, expected_substr: str) -> None:
    out = redact_string(raw)
    assert expected_substr in out
    assert "Bearer abc" not in out
    assert "eyJhbGc" not in out


def test_redact_bundle_recurses() -> None:
    bundle = {
        "headers": {"Authorization": "Bearer secret123"},
        "body": "ok",
        "deep": [{"k": "Authorization: Bearer hidden"}],
    }
    out = redact_bundle(bundle)
    assert "secret123" not in str(out)
    assert "hidden" not in str(out)
    assert out["body"] == "ok"


def test_redact_string_passes_through_safe_content() -> None:
    assert redact_string("hello world") == "hello world"
    assert redact_string("") == ""
