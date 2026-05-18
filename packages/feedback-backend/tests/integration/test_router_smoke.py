"""End-to-end smoke through the actual router + service + Postgres.

Skipped if Postgres isn't reachable (see integration/conftest.py).

Under the unified schema (2026-05-16) the legacy ``POST /feedback`` direct-
create endpoint was removed — tickets are now created via the chat flow
(``POST /feedback/chat/sessions`` → confirm). The smoke tests below seed
rows directly through the engine and exercise the remaining endpoints
(GET, PATCH /status, DELETE).
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi.testclient import TestClient
from feedback_widget.models import Feedback, FeedbackStatus, FeedbackType
from sqlalchemy.engine import Engine
from sqlmodel import Session

_TEST_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
_TEST_ADMIN_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")


def _seed(engine: Engine, **overrides: Any) -> uuid.UUID:
    base: dict[str, Any] = {
        "tenant_id": None,
        "user_id": _TEST_USER_ID,
        "type": FeedbackType.BUG,
        "status": FeedbackStatus.OPEN,
        "title": "Smoke test",
        "description": "Open app, click button, observe.",
        "expected_outcome": "Button should not crash the page.",
        "url_captured": "http://localhost/sandbox",
        "metadata_bundle": {"viewport": "1280x720"},
        "auto_context": {"url": "http://localhost/sandbox", "route": "/"},
        "ticket_code": f"FB-2026-{uuid.uuid4().int % 10000:04d}",
    }
    base.update(overrides)
    with Session(engine) as s:
        row = Feedback(**base)
        s.add(row)
        s.commit()
        s.refresh(row)
        return row.id


def test_health_endpoint(client: TestClient) -> None:
    resp = client.get("/feedback/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert "version" in body


def test_unauthenticated_list_returns_401(client: TestClient) -> None:
    resp = client.get("/feedback")
    assert resp.status_code == 401


def test_list_requires_admin(client: TestClient) -> None:
    # staff -> 403
    r = client.get("/feedback", headers={"X-Test-Role": "staff"})
    assert r.status_code == 403
    # admin -> 200 with empty list (truncated each test)
    r2 = client.get("/feedback", headers={"X-Test-Role": "admin"})
    assert r2.status_code == 200
    assert r2.json()["count"] == 0


def test_list_mine_returns_only_caller_rows(client: TestClient, engine: Engine) -> None:
    _seed(engine, user_id=_TEST_USER_ID, title="mine-1")
    _seed(engine, user_id=_TEST_ADMIN_ID, title="admin-1")

    mine_staff = client.get("/feedback/mine", headers={"X-Test-Role": "staff"})
    assert mine_staff.status_code == 200
    titles = [r["title"] for r in mine_staff.json()]
    assert titles == ["mine-1"]

    mine_admin = client.get("/feedback/mine", headers={"X-Test-Role": "admin"})
    assert mine_admin.status_code == 200
    titles_admin = [r["title"] for r in mine_admin.json()]
    assert titles_admin == ["admin-1"]


def test_admin_status_transition_open_to_resolved(client: TestClient, engine: Engine) -> None:
    fid = _seed(engine, title="lifecycle")

    # OPEN -> IN_REVIEW
    r1 = client.patch(
        f"/feedback/{fid}/status",
        json={"status": "in_review", "triage_note": "queued"},
        headers={"X-Test-Role": "admin"},
    )
    assert r1.status_code == 200, r1.text
    assert r1.json()["status"] == "in_review"

    # IN_REVIEW -> IN_PROGRESS
    r2 = client.patch(
        f"/feedback/{fid}/status",
        json={"status": "in_progress"},
        headers={"X-Test-Role": "admin"},
    )
    assert r2.status_code == 200

    # IN_PROGRESS -> RESOLVED
    r3 = client.patch(
        f"/feedback/{fid}/status",
        json={"status": "resolved", "triage_note": "fixed"},
        headers={"X-Test-Role": "admin"},
    )
    assert r3.status_code == 200
    assert r3.json()["status"] == "resolved"


def test_delete_only_admin(client: TestClient, engine: Engine) -> None:
    fid = _seed(engine, title="delete-me")

    # staff cannot delete
    r1 = client.delete(f"/feedback/{fid}", headers={"X-Test-Role": "staff"})
    assert r1.status_code == 403

    # admin can
    r2 = client.delete(f"/feedback/{fid}", headers={"X-Test-Role": "admin"})
    assert r2.status_code == 204

    # second delete -> 404
    r3 = client.delete(f"/feedback/{fid}", headers={"X-Test-Role": "admin"})
    assert r3.status_code == 404
