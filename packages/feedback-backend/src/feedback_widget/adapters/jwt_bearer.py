"""Decode-only JWT bearer adapter implementing :class:`FeedbackAuthAdapter`.

The host already issues JWTs for its own users. We decode them with the
host's signing key (HS256 by default) and produce a
:class:`CurrentUserSnapshot` directly from the claims — no DB lookup,
no async/sync bridge.

The token MUST carry ``sub`` (UUID string) and ``email``. ``role``,
``tenant_id``, ``full_name`` are optional and fall back to defaults.
Tokens missing the mandatory claims, signed with a different key,
expired, or whose ``sub`` is not a valid UUID resolve to ``None`` —
the router translates ``None`` into a 401 response.

Hosts that need DB-backed user resolution should write their own
adapter; this class is intentionally minimal.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import Request
from jose import JWTError, jwt

from feedback_widget.auth import CurrentUserSnapshot


class JWTBearerAuth:
    """Decode JWTs minted by the host and produce a snapshot.

    Parameters
    ----------
    secret_key:
        The HMAC key the host uses to sign its JWTs.
    algorithm:
        JWT algorithm — defaults to ``HS256`` to match the FastAPI
        fullstack template.
    master_role:
        The role string that grants triage/admin privileges. Compared
        case-insensitively against the ``role`` claim.
    sub_claim, email_claim, role_claim, tenant_claim, full_name_claim:
        Names of the JWT claims to read. Override only when the host
        uses non-standard claim names.
    """

    def __init__(
        self,
        *,
        secret_key: str,
        algorithm: str = "HS256",
        master_role: str = "MASTER_ADMIN",
        sub_claim: str = "sub",
        email_claim: str = "email",
        role_claim: str = "role",
        tenant_claim: str = "tenant_id",
        full_name_claim: str = "full_name",
    ) -> None:
        self._secret_key = secret_key
        self._algorithm = algorithm
        self._master_role = master_role
        self._sub_claim = sub_claim
        self._email_claim = email_claim
        self._role_claim = role_claim
        self._tenant_claim = tenant_claim
        self._full_name_claim = full_name_claim

    def get_current_user(self, request: Request) -> CurrentUserSnapshot | None:
        """Extract the bearer token, decode it, and build a snapshot."""
        token = self._extract_bearer(request)
        if token is None:
            return None
        payload = self._decode(token)
        if payload is None:
            return None
        return self._snapshot_from_payload(payload)

    def is_master_admin(self, user: CurrentUserSnapshot) -> bool:
        """Return True iff the user's role matches the configured master role."""
        return user.role.upper() == self._master_role.upper()

    @staticmethod
    def _extract_bearer(request: Request) -> str | None:
        header = request.headers.get("authorization", "")
        scheme, _, token = header.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None
        return token

    def _decode(self, token: str) -> dict[str, Any] | None:
        try:
            return jwt.decode(token, self._secret_key, algorithms=[self._algorithm])
        except JWTError:
            return None

    def _snapshot_from_payload(self, payload: dict[str, Any]) -> CurrentUserSnapshot | None:
        sub = payload.get(self._sub_claim)
        # email is OPTIONAL — hosts whose tokens don't carry the claim
        # still get a working snapshot (the widget falls back to the
        # submitter's follow_up_email field for transition emails).
        if not sub:
            return None

        try:
            user_id = uuid.UUID(str(sub))
        except (ValueError, TypeError):
            return None

        tenant_raw = payload.get(self._tenant_claim)
        tenant_id: uuid.UUID | None = None
        if tenant_raw:
            try:
                tenant_id = uuid.UUID(str(tenant_raw))
            except (ValueError, TypeError):
                tenant_id = None

        email_raw = payload.get(self._email_claim)
        full_name_raw = payload.get(self._full_name_claim)
        return CurrentUserSnapshot(
            user_id=user_id,
            email=str(email_raw) if email_raw else None,
            tenant_id=tenant_id,
            role=str(payload.get(self._role_claim, "")),
            full_name=str(full_name_raw) if full_name_raw else None,
        )
