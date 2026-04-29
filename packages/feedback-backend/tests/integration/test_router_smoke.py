"""End-to-end smoke through the actual router + service + Postgres.

Skipped if Postgres isn't reachable (see integration/conftest.py).
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient


def _create_payload(**overrides: object) -> str:
    base: dict[str, object] = {
        "type": "bug",
        "title": "Smoke test",
        "description": "Steps: open app, click button, observe.",
        "url_captured": "http://localhost/sandbox",
        "type_fields": {"steps_to_reproduce": "1. click 2. boom"},
        "metadata_bundle": {"viewport": "1280x720"},
        "linked_user_stories": [],
        "consent_metadata_capture": True,
    }
    base.update(overrides)
    return json.dumps(base)


def test_health_endpoint(client: TestClient) -> None:
    resp = client.get("/feedback/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert "version" in body


def test_unauthenticated_create_returns_401(client: TestClient) -> None:
    resp = client.post(
        "/feedback",
        files={"payload": (None, _create_payload())},
    )
    assert resp.status_code == 401


def test_create_bug_as_staff_returns_201(client: TestClient) -> None:
    resp = client.post(
        "/feedback",
        files={"payload": (None, _create_payload())},
        headers={"X-Test-Role": "staff"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["title"] == "Smoke test"
    assert body["type"] == "bug"
    assert body["ticket_code"].startswith("FB-")


def test_list_requires_admin(client: TestClient) -> None:
    # staff -> 403
    r = client.get("/feedback", headers={"X-Test-Role": "staff"})
    assert r.status_code == 403
    # admin -> 200 with empty list (truncated each test)
    r2 = client.get("/feedback", headers={"X-Test-Role": "admin"})
    assert r2.status_code == 200
    assert r2.json()["count"] == 0


def test_list_mine_returns_only_caller_rows(client: TestClient) -> None:
    # staff submits one
    r = client.post(
        "/feedback",
        files={"payload": (None, _create_payload(title="mine-1"))},
        headers={"X-Test-Role": "staff"},
    )
    assert r.status_code == 201
    # admin submits one
    r2 = client.post(
        "/feedback",
        files={"payload": (None, _create_payload(title="admin-1"))},
        headers={"X-Test-Role": "admin"},
    )
    assert r2.status_code == 201

    mine_staff = client.get("/feedback/mine", headers={"X-Test-Role": "staff"})
    assert mine_staff.status_code == 200
    titles = [r["title"] for r in mine_staff.json()]
    assert titles == ["mine-1"]

    mine_admin = client.get("/feedback/mine", headers={"X-Test-Role": "admin"})
    assert mine_admin.status_code == 200
    titles_admin = [r["title"] for r in mine_admin.json()]
    assert titles_admin == ["admin-1"]


def test_admin_status_transition_new_to_done(client: TestClient) -> None:
    created = client.post(
        "/feedback",
        files={"payload": (None, _create_payload(title="lifecycle"))},
        headers={"X-Test-Role": "staff"},
    )
    assert created.status_code == 201
    fid = created.json()["id"]

    # NEW -> TRIAGED
    r1 = client.patch(
        f"/feedback/{fid}/status",
        json={"status": "triaged", "triage_note": "queued"},
        headers={"X-Test-Role": "admin"},
    )
    assert r1.status_code == 200
    assert r1.json()["status"] == "triaged"

    # TRIAGED -> IN_PROGRESS
    r2 = client.patch(
        f"/feedback/{fid}/status",
        json={"status": "in_progress"},
        headers={"X-Test-Role": "admin"},
    )
    assert r2.status_code == 200

    # IN_PROGRESS -> DONE
    r3 = client.patch(
        f"/feedback/{fid}/status",
        json={"status": "done", "triage_note": "fixed"},
        headers={"X-Test-Role": "admin"},
    )
    assert r3.status_code == 200
    assert r3.json()["status"] == "done"


def test_delete_only_admin(client: TestClient) -> None:
    created = client.post(
        "/feedback",
        files={"payload": (None, _create_payload(title="delete-me"))},
        headers={"X-Test-Role": "staff"},
    )
    fid = created.json()["id"]

    # staff cannot delete
    r1 = client.delete(f"/feedback/{fid}", headers={"X-Test-Role": "staff"})
    assert r1.status_code == 403

    # admin can
    r2 = client.delete(f"/feedback/{fid}", headers={"X-Test-Role": "admin"})
    assert r2.status_code == 204

    # second delete -> 404
    r3 = client.delete(f"/feedback/{fid}", headers={"X-Test-Role": "admin"})
    assert r3.status_code == 404
