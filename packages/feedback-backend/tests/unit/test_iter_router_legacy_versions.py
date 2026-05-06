"""Legacy versions stored before the diagram fence normaliser
landed have ``output_markdown`` with bare-text diagrams. The
read-side DTO mapper applies the normaliser so users see fenced
content even on sessions started before the fix."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from feedback_widget.iter_models import (
    FeedbackIterSession,
    FeedbackIterSessionStatus,
    FeedbackIterVersion,
)
from feedback_widget.iter_router import _to_session_read, _to_version_read


def _legacy_version() -> FeedbackIterVersion:
    return FeedbackIterVersion(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        tenant_id=None,
        version_number=1,
        parent_version_id=None,
        user_message="",
        restructure_allowed=False,
        output_json={"markdown_rendered": "# Diagram\n\ngraph LR\n  A --> B\n"},
        output_markdown="# Diagram\n\ngraph LR\n  A --> B\n",
        diff_json=[],
        created_at=datetime.now(UTC),
    )


def test_legacy_unfenced_diagram_is_fenced_on_read() -> None:
    v = _legacy_version()
    out = _to_version_read(v)
    assert "```mermaid" in out.output_markdown
    assert "graph LR" in out.output_markdown


def test_already_fenced_version_passes_through_on_read() -> None:
    v = _legacy_version()
    v.output_markdown = "# Diagram\n\n```mermaid\ngraph LR\n  A --> B\n```\n"
    out = _to_version_read(v)
    assert out.output_markdown.count("```mermaid") == 1


def test_session_read_carries_last_call_model_id() -> None:
    row = FeedbackIterSession(
        id=uuid.uuid4(),
        feedback_id=uuid.uuid4(),
        tenant_id=None,
        created_by_user_id=uuid.uuid4(),
        status=FeedbackIterSessionStatus.ITERATING,
        model_id="gemma-4-26b-a4b-it",
        model_provider="gemini",
        language="en",
        current_iteration_id=None,
        final_package_id=None,
    )
    out = _to_session_read(row, last_call_model_id="gemini-3.1-flash-lite-preview")
    assert out.model_id == "gemma-4-26b-a4b-it"
    assert out.last_call_model_id == "gemini-3.1-flash-lite-preview"


def test_session_read_last_call_model_id_defaults_none() -> None:
    row = FeedbackIterSession(
        id=uuid.uuid4(),
        feedback_id=uuid.uuid4(),
        tenant_id=None,
        created_by_user_id=uuid.uuid4(),
        status=FeedbackIterSessionStatus.DRAFT,
        model_id="gemini-3.1-flash-lite-preview",
        model_provider="gemini",
        language="en",
        current_iteration_id=None,
        final_package_id=None,
    )
    out = _to_session_read(row)
    assert out.last_call_model_id is None
