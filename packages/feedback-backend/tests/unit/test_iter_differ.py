"""Unit tests for the diff invariant + summary helper."""

from __future__ import annotations

import pytest

from feedback_widget.iter_differ import (
    IterDiffViolationError,
    enforce_no_destructive_removal,
    summarize_diff,
)
from feedback_widget.iter_schemas import (
    DiffOpAdd,
    DiffOpMarkObsolete,
    DiffOpModify,
    DiffOpRemove,
)


def test_remove_blocked_without_restructure() -> None:
    diff = [DiffOpRemove(op="remove", path="/personas/0", before={"id": "p_a"}, note="x")]
    with pytest.raises(IterDiffViolationError):
        enforce_no_destructive_removal(diff, restructure_allowed=False)


def test_remove_allowed_with_restructure() -> None:
    diff = [DiffOpRemove(op="remove", path="/personas/0", before={"id": "p_a"}, note="x")]
    enforce_no_destructive_removal(diff, restructure_allowed=True)  # no raise


def test_summary_counts() -> None:
    diff = [
        DiffOpAdd(op="add", path="/a", value=1),
        DiffOpAdd(op="add", path="/b", value=2),
        DiffOpModify(op="modify", path="/c", before=1, after=2),
        DiffOpMarkObsolete(op="mark_obsolete", path="/d", reason="x"),
    ]
    counts = summarize_diff(diff)
    assert counts == {"add": 2, "modify": 1, "remove": 0, "mark_obsolete": 1}
