"""Unit tests for JWTBearerAuth — decode-only adapter implementing FeedbackAuthAdapter."""
from __future__ import annotations

import datetime as dt
import uuid

import pytest
from fastapi import Request
from jose import jwt

from feedback_widget.adapters import JWTBearerAuth
from feedback_widget.auth import FeedbackAuthAdapter

SECRET = "test-secret-please-rotate"
USER_UUID = uuid.UUID("11111111-1111-1111-1111-111111111111")
TENANT_UUID = uuid.UUID("22222222-2222-2222-2222-222222222222")


def _request(authorization: str | None = None) -> Request:
    headers: list[tuple[bytes, bytes]] = []
    if authorization is not None:
        headers.append((b"authorization", authorization.encode()))
    return Request({"type": "http", "headers": headers, "method": "GET", "path": "/"})


def _token(claims: dict, *, exp_offset_seconds: int = 3600, secret: str = SECRET) -> str:
    payload = {
        **claims,
        "exp": dt.datetime.now(dt.UTC) + dt.timedelta(seconds=exp_offset_seconds),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def test_valid_token_returns_snapshot() -> None:
    auth = JWTBearerAuth(secret_key=SECRET)
    token = _token(
        {
            "sub": str(USER_UUID),
            "email": "user@example.com",
            "role": "MANAGER",
            "tenant_id": str(TENANT_UUID),
            "full_name": "Jane Doe",
        }
    )
    snap = auth.get_current_user(_request(f"Bearer {token}"))
    assert snap is not None
    assert snap.user_id == USER_UUID
    assert snap.email == "user@example.com"
    assert snap.role == "MANAGER"
    assert snap.tenant_id == TENANT_UUID
    assert snap.full_name == "Jane Doe"


def test_minimum_claims_token_returns_snapshot() -> None:
    """Only sub + email are mandatory; the rest get sensible defaults."""
    auth = JWTBearerAuth(secret_key=SECRET)
    token = _token({"sub": str(USER_UUID), "email": "minimal@example.com"})
    snap = auth.get_current_user(_request(f"Bearer {token}"))
    assert snap is not None
    assert snap.user_id == USER_UUID
    assert snap.email == "minimal@example.com"
    assert snap.role == ""
    assert snap.tenant_id is None
    assert snap.full_name is None


def test_no_authorization_header_returns_none() -> None:
    auth = JWTBearerAuth(secret_key=SECRET)
    assert auth.get_current_user(_request(None)) is None


def test_non_bearer_scheme_returns_none() -> None:
    auth = JWTBearerAuth(secret_key=SECRET)
    assert auth.get_current_user(_request("Basic dXNlcjpwYXNz")) is None


def test_expired_token_returns_none() -> None:
    auth = JWTBearerAuth(secret_key=SECRET)
    token = _token(
        {"sub": str(USER_UUID), "email": "u@x.com"}, exp_offset_seconds=-10
    )
    assert auth.get_current_user(_request(f"Bearer {token}")) is None


def test_wrong_secret_returns_none() -> None:
    auth = JWTBearerAuth(secret_key=SECRET)
    token = _token({"sub": str(USER_UUID), "email": "u@x.com"}, secret="other-secret")
    assert auth.get_current_user(_request(f"Bearer {token}")) is None


def test_missing_email_returns_none() -> None:
    """Without email we cannot construct a CurrentUserSnapshot."""
    auth = JWTBearerAuth(secret_key=SECRET)
    token = _token({"sub": str(USER_UUID), "role": "MANAGER"})
    assert auth.get_current_user(_request(f"Bearer {token}")) is None


def test_missing_sub_returns_none() -> None:
    auth = JWTBearerAuth(secret_key=SECRET)
    token = _token({"email": "u@x.com", "role": "MANAGER"})
    assert auth.get_current_user(_request(f"Bearer {token}")) is None


def test_non_uuid_sub_returns_none() -> None:
    auth = JWTBearerAuth(secret_key=SECRET)
    token = _token({"sub": "not-a-uuid", "email": "u@x.com"})
    assert auth.get_current_user(_request(f"Bearer {token}")) is None


def test_is_master_admin_matches_role_case_insensitive() -> None:
    auth = JWTBearerAuth(secret_key=SECRET, master_role="MASTER_ADMIN")
    snap_admin = _make_snapshot(role="master_admin")
    snap_other = _make_snapshot(role="MANAGER")
    assert auth.is_master_admin(snap_admin) is True
    assert auth.is_master_admin(snap_other) is False


def test_implements_feedback_auth_adapter_protocol() -> None:
    """Structural-typing check — JWTBearerAuth should satisfy the Protocol."""
    auth: FeedbackAuthAdapter = JWTBearerAuth(secret_key=SECRET)
    assert callable(auth.get_current_user)
    assert callable(auth.is_master_admin)


def _make_snapshot(*, role: str) -> "object":
    from feedback_widget.auth import CurrentUserSnapshot

    return CurrentUserSnapshot(user_id=USER_UUID, email="u@x.com", role=role)
