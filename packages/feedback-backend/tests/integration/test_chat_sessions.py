"""Integration tests for POST /chat/sessions + GET /chat/sessions/in-progress.

Uses existing conftest fixtures:
- ``client``: TestClient bound to the app fixture (prefix='/feedback', see conftest:190)
- ``TestAuth``: returns None unless request has X-Test-Role header (conftest:113)
  → no header == unauthenticated; header 'staff' or 'admin' == authenticated user.
"""

from __future__ import annotations

import uuid

AUTH_STAFF = {"X-Test-Role": "staff"}
AUTH_ADMIN = {"X-Test-Role": "admin"}


def test_post_chat_session_capture_returns_session_id(client) -> None:
    payload = {
        "mode": "capture",
        "auto_context": {"url": "https://example.com", "route": "/home"},
    }
    resp = client.post("/feedback/chat/sessions", json=payload, headers=AUTH_STAFF)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "session_id" in body
    uuid.UUID(body["session_id"])  # validates UUID format
    assert body["greeting"] == "Cuéntame qué tienes en mente."
    assert body["resume_available"] is False


def test_post_chat_session_refine_requires_feedback_id(client) -> None:
    payload = {
        "mode": "refine",
        "auto_context": {"url": "https://example.com"},
    }
    resp = client.post("/feedback/chat/sessions", json=payload, headers=AUTH_STAFF)

    assert resp.status_code == 422, resp.text
    # FastAPI default 422 payload shape — assert the message mentions feedback_id
    body = resp.json()
    assert any(
        "feedback_id" in str(item).lower()
        for item in body.get("detail", [])
    ), body


def test_get_in_progress_empty(client) -> None:
    resp = client.get("/feedback/chat/sessions/in-progress", headers=AUTH_STAFF)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"sessions": []}


def test_post_chat_session_requires_auth(client) -> None:
    """No X-Test-Role header → TestAuth returns None → 401/403."""
    payload = {
        "mode": "capture",
        "auto_context": {"url": "https://example.com"},
    }
    resp = client.post("/feedback/chat/sessions", json=payload)
    assert resp.status_code in (401, 403), resp.text


# ── GET /chat/sessions/{session_id} — S3C resume support ─────────────


def _create_session(client, *, headers: dict[str, str]) -> str:
    """Helper — create a session as the supplied role, return session_id."""
    resp = client.post(
        "/feedback/chat/sessions",
        json={
            "mode": "capture",
            "auto_context": {"url": "https://example.com", "route": "/home"},
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return str(resp.json()["session_id"])


def test_get_session_returns_owned_session(client) -> None:
    """The owner can fetch full session detail (messages + auto_context)."""
    sid = _create_session(client, headers=AUTH_STAFF)

    resp = client.get(f"/feedback/chat/sessions/{sid}", headers=AUTH_STAFF)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["session_id"] == sid
    assert body["mode"] == "capture"
    # Brand-new session: status=open, no messages yet, empty synthesis.
    assert body["status"] == "open"
    assert body["messages"] == []
    assert body["synthesis_json"] is None
    assert body["auto_context"]["url"] == "https://example.com"
    assert body["auto_context"]["route"] == "/home"
    # updated_at must be ISO-formatted; just sanity-check it's present.
    assert isinstance(body["updated_at"], str) and len(body["updated_at"]) > 0


def test_get_session_404_for_other_user(client) -> None:
    """Admin creates a session → staff (different user_id) gets 404.

    Important — 404 (not 403) to avoid leaking existence across users.
    """
    sid = _create_session(client, headers=AUTH_ADMIN)

    resp = client.get(f"/feedback/chat/sessions/{sid}", headers=AUTH_STAFF)
    assert resp.status_code == 404, resp.text


def test_get_session_404_for_unknown_id(client) -> None:
    """Random UUID that does not exist → 404."""
    unknown = str(uuid.uuid4())
    resp = client.get(f"/feedback/chat/sessions/{unknown}", headers=AUTH_STAFF)
    assert resp.status_code == 404, resp.text
