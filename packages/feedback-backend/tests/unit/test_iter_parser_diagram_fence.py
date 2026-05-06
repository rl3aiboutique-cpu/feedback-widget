"""Tests for the unfenced-diagram normaliser. Real Gemma output
routinely drops Mermaid bodies as bare text under a Diagram
heading; we wrap them in fences before persisting so the
markdown renderer doesn't show garbled arrow soup."""

from __future__ import annotations

import json

from feedback_widget.iter_parser import parse_iteration_output


def _baseline_with_md(markdown: str) -> dict[str, object]:
    return {
        "schema_version": "1",
        "language": "en",
        "personas": [
            {
                "id": "p_a",
                "name": "Alice",
                "role": "admin",
                "goals": [],
                "pain_points": [],
                "context": "test",
            }
        ],
        "user_stories": [
            {
                "id": "us_1",
                "persona_id": "p_a",
                "title": "T",
                "story": {"as_a": "a", "i_want": "b", "so_that": "c"},
                "acceptance_criteria": [
                    {"scenario": "s", "given": ["g"], "when": ["w"], "then": ["t"]}
                ],
            }
        ],
        "spec": {"title": "T", "summary": "S", "sections": []},
        "diagram": {"format": "mermaid", "source": "graph LR\n A --> B", "caption": "c"},
        "assumptions": [],
        "unresolved_questions": [],
        "diff": [],
        "changes_summary": "",
        "archived": [],
        "markdown_rendered": markdown,
    }


def test_unfenced_mermaid_diagram_is_wrapped_in_fence() -> None:
    md = (
        "# Personas\n\n## A\nbody\n\n# Diagram\n\n"
        "graph LR\n  A[User] --> B[/reviews/]\n  B --> C{Board}\n"
    )
    payload = _baseline_with_md(md)
    out = parse_iteration_output(json.dumps(payload), restructure_allowed=False)
    rendered = out.markdown_rendered
    assert "```mermaid" in rendered
    assert "graph LR" in rendered
    # The mermaid block ends before any next heading (none here, so EOF).
    assert rendered.rstrip().endswith("```")


def test_unfenced_ascii_diagram_is_wrapped_in_text_fence() -> None:
    md = (
        "# Diagram\n\n"
        "[Inbox] --(approve)--> [Detail] --(notify)--> [Supplier]\n"
        "   |                              ^\n"
        "   '-----(skip-detail)----------'\n\n"
        "# Spec\n\nsummary\n"
    )
    payload = _baseline_with_md(md)
    out = parse_iteration_output(json.dumps(payload), restructure_allowed=False)
    rendered = out.markdown_rendered
    assert "```text" in rendered
    assert "[Inbox]" in rendered
    # Next section's heading should be preserved.
    assert "# Spec" in rendered


def test_already_fenced_diagram_is_left_alone() -> None:
    md = (
        "# Diagram\n\n"
        "```mermaid\n"
        "graph LR\n  A --> B\n"
        "```\n\n"
        "# Spec\nsummary\n"
    )
    payload = _baseline_with_md(md)
    out = parse_iteration_output(json.dumps(payload), restructure_allowed=False)
    # The wrapper must not double-wrap.
    assert out.markdown_rendered.count("```mermaid") == 1
    assert out.markdown_rendered.count("```\n") >= 1


def test_no_diagram_section_is_a_noop() -> None:
    md = "# Personas\n\n## Alice\nbody\n\n# Spec\nsummary\n"
    payload = _baseline_with_md(md)
    out = parse_iteration_output(json.dumps(payload), restructure_allowed=False)
    assert out.markdown_rendered == md


def test_h2_diagram_heading_also_normalised() -> None:
    md = "## Diagram\n\nflowchart TD\n A --> B\n"
    payload = _baseline_with_md(md)
    out = parse_iteration_output(json.dumps(payload), restructure_allowed=False)
    assert "```mermaid" in out.markdown_rendered
    assert "flowchart TD" in out.markdown_rendered
