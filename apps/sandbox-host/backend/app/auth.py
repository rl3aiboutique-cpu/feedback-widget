"""Sandbox FakeAuth — header-driven identity for the demo host.

Reads two headers and returns a :class:`CurrentUserSnapshot`:

* ``X-Sandbox-User-Id`` — UUID identifying the user. If absent, a fixed
  demo UUID is used.
* ``X-Sandbox-User-Role`` — ``admin`` (master admin) | ``staff`` |
  ``manager``. Defaults to ``staff``.

This is intentionally trivial: the sandbox is a demo, not a real
auth backend. The widget itself has zero coupling to this — sapphira
and CRM plug their own real auth in.
"""

from __future__ import annotations

import uuid

from fastapi import Request
from feedback_widget import CurrentUserSnapshot, FeedbackAuthAdapter

# A stable demo user UUID so seeded rows survive container restarts.
_DEMO_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")


class SandboxAuth(FeedbackAuthAdapter):
    """Header-driven adapter — DO NOT use in production."""

    def get_current_user(self, request: Request) -> CurrentUserSnapshot | None:
        raw_id = request.headers.get("X-Sandbox-User-Id")
        try:
            user_id = uuid.UUID(raw_id) if raw_id else _DEMO_USER_ID
        except ValueError:
            user_id = _DEMO_USER_ID
        role = request.headers.get("X-Sandbox-User-Role", "staff").lower()
        if role not in {"admin", "staff", "manager"}:
            role = "staff"
        return CurrentUserSnapshot(
            user_id=user_id,
            email=f"{role}@sandbox.local",
            tenant_id=None,
            role=role,
            full_name=role.title(),
        )

    def is_master_admin(self, user: CurrentUserSnapshot) -> bool:
        return user.role == "admin"
