"""Host auth/tenant adapter — the ONE seam the host implements.

The widget never imports a host-specific ``User`` class. Instead the
host implements :class:`FeedbackAuthAdapter` and the service consumes the
adapter through a :class:`CurrentUserSnapshot` dataclass.

Why a Protocol (not an ABC):

* hosts can use whatever class hierarchy they already have — no
  inheritance constraint, just structural typing.
* mypy --strict still catches missing methods.

Design notes:

* :meth:`get_current_user` returns the authenticated user *plus* their
  active tenant (or None for single-tenant hosts) — folded into one
  call so the host can resolve both atomically from its own JWT/cookie
  in a single step.
* :meth:`is_master_admin` is the gate for triage endpoints (list /
  detail / status update / delete). Anything below MASTER_ADMIN only
  gets the create + "my tickets" + autocomplete endpoints.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Protocol

from fastapi import Request


@dataclass(frozen=True, slots=True)
class CurrentUserSnapshot:
    """Flat view of the currently authenticated host user.

    The host adapter builds this from its own User model. ``tenant_id``
    is None for single-tenant hosts (no RLS, no per-tenant filtering).
    """

    user_id: uuid.UUID
    email: str
    tenant_id: uuid.UUID | None = None
    role: str = ""
    full_name: str | None = None


class FeedbackAuthAdapter(Protocol):
    """Protocol the host implements to wire its auth into the widget.

    Both methods receive the FastAPI :class:`Request` so the host can
    read its own cookie / header conventions. Returning ``None`` from
    :meth:`get_current_user` triggers a 401 from the router.
    """

    def get_current_user(self, request: Request) -> CurrentUserSnapshot | None:
        """Return the authenticated user as a snapshot, or None if absent."""
        ...

    def is_master_admin(self, user: CurrentUserSnapshot) -> bool:
        """Return True if the user can triage feedback (list / patch / delete)."""
        ...
