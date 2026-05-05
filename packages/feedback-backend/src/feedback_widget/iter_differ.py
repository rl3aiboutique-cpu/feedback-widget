"""Diff-side invariants and summary helpers.

The LLM produces its own ``diff`` array on every iteration; that is
the source of truth the frontend renders. This module:

* enforces the "no ``remove`` op without ``restructure_allowed``"
  invariant a second time at version-write time (the parser also
  checks; this is defence in depth for paths that build versions
  outside the parser);
* exposes a tiny :func:`summarize_diff` that returns counts by op
  kind so the activity timeline can render "Changes: +3 modify-2 remove-1"
  badges without parsing the diff again on the client.
"""

from __future__ import annotations

from .iter_schemas import (
    DiffOpAdd,
    DiffOperation,
    DiffOpMarkObsolete,
    DiffOpModify,
    DiffOpRemove,
)


class IterDiffViolationError(ValueError):
    """A ``remove`` op appeared on a version where the user did not
    enable the restructure checkbox."""


def enforce_no_destructive_removal(
    diff: list[DiffOperation],
    *,
    restructure_allowed: bool,
) -> None:
    """Raise :class:`IterDiffViolationError` on the first violating op.

    When ``restructure_allowed`` is true the check is a no-op.
    """
    if restructure_allowed:
        return
    for op in diff:
        if isinstance(op, DiffOpRemove):
            raise IterDiffViolationError(
                f"diff contains a 'remove' op on path {op.path!r} but "
                "restructure_allowed is false"
            )


def summarize_diff(diff: list[DiffOperation]) -> dict[str, int]:
    """Return ``{add, modify, remove, mark_obsolete}`` counts."""
    counts = {"add": 0, "modify": 0, "remove": 0, "mark_obsolete": 0}
    for op in diff:
        if isinstance(op, DiffOpAdd):
            counts["add"] += 1
        elif isinstance(op, DiffOpModify):
            counts["modify"] += 1
        elif isinstance(op, DiffOpRemove):
            counts["remove"] += 1
        elif isinstance(op, DiffOpMarkObsolete):
            counts["mark_obsolete"] += 1
    return counts
