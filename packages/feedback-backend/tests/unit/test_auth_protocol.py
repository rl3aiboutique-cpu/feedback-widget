"""Verify the FeedbackAuthAdapter Protocol is structural, not nominal.

Any class with the right methods passes — no inheritance required.
"""

from __future__ import annotations

import uuid

from fastapi import Request

from feedback_widget.auth import CurrentUserSnapshot, FeedbackAuthAdapter


class DuckTypedAdapter:
    """Implements the Protocol shape without inheriting from it."""

    def get_current_user(self, request: Request) -> CurrentUserSnapshot | None:  # noqa: ARG002
        return CurrentUserSnapshot(
            user_id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
            email="duck@test.local",
            tenant_id=None,
            role="admin",
            full_name="Duck",
        )

    def is_master_admin(self, user: CurrentUserSnapshot) -> bool:
        return user.role == "admin"


def _accepts_protocol(adapter: FeedbackAuthAdapter) -> bool:
    """Function whose parameter constrains the runtime caller."""
    user = adapter.get_current_user(Request({"type": "http", "headers": []}))
    if user is None:
        return False
    return adapter.is_master_admin(user)


def test_duck_typed_adapter_satisfies_protocol() -> None:
    adapter: FeedbackAuthAdapter = DuckTypedAdapter()
    assert _accepts_protocol(adapter) is True


def test_snapshot_dataclass_is_frozen_and_typed() -> None:
    snap = CurrentUserSnapshot(
        user_id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        email="x@y.com",
    )
    assert snap.tenant_id is None
    assert snap.role == ""
    # Mutation should fail (dataclass(frozen=True)).
    try:
        snap.email = "other@y.com"  # type: ignore[misc]
    except Exception as exc:
        assert "frozen" in str(exc).lower() or "FrozenInstanceError" in type(exc).__name__
    else:
        raise AssertionError("CurrentUserSnapshot should be frozen")
