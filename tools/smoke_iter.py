"""End-to-end smoke against the running CRM backend.

Exercises:
  1. login as admin
  2. submit a feedback row (multipart with description)
  3. start an iter session
  4. run an iteration (SSE stream against real Gemini / Gemma 3)
  5. list assumptions
  6. resolve all assumptions
  7. run another iteration
  8. finalize
  9. fetch the package + download the ZIP

Not committed as a test — lives in tools/ for one-off real-session
debugging. Lists what worked + what didn't so we can fix forward.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx


BASE = "http://localhost:8002/api/v1"
ADMIN_USER = "admin@capellai.dev"
ADMIN_PASS = "dev-password-123"


def login(client: httpx.Client) -> str:
    """Login + fetch CSRF token. Returns the CSRF value to echo on
    mutating requests."""
    r = client.post(
        f"{BASE}/login/access-token",
        data={"username": ADMIN_USER, "password": ADMIN_PASS},
    )
    r.raise_for_status()
    print("OK login", r.status_code)
    r2 = client.post(f"{BASE}/csrf-token")
    r2.raise_for_status()
    csrf = r2.json()["csrf_token"]
    client.headers["X-CSRF-Token"] = csrf
    print("OK csrf-token", csrf[:8] + "...")
    return csrf


def submit_feedback(client: httpx.Client) -> str:
    """Submit a minimal feedback row. Returns the new feedback id."""
    payload = {
        "type": "new_feature",
        "title": "Smoke test — iter end-to-end",
        "description": (
            "Users want to track the status of their compliance reviews "
            "on a kanban-style board so they can see what's pending vs "
            "in flight at a glance. The current list view forces them "
            "to scroll horizontally to see the status column. We want "
            "a vertical column-based layout instead, with drag-and-drop "
            "between statuses."
        ),
        "expected_outcome": (
            "A new /reviews/board route with one column per review "
            "status. Cards drag between columns to update status. "
            "The existing list view stays as a fallback under "
            "/reviews/list."
        ),
        "url_captured": "http://localhost:3001/reviews",
        "route_name": "/_layout/reviews",
        "metadata_bundle": {
            "viewport": {"width": 1440, "height": 900, "dpr": 1},
            "framework": "react",
            "console_tail": [],
            "network_tail": [],
        },
        "app_version": "0.2.0",
        "git_commit_sha": "abcdef0123456789",
        "user_agent": "smoke-iter/1.0",
    }
    files = {"payload": (None, json.dumps(payload), "application/json")}
    r = client.post(f"{BASE}/feedback", files=files)
    if r.status_code >= 400:
        print("submit failed:", r.status_code, r.text[:300])
        r.raise_for_status()
    body = r.json()
    print("OK submit feedback:", body["id"])
    return str(body["id"])


def start_session(client: httpx.Client, feedback_id: str) -> str:
    r = client.post(
        f"{BASE}/feedback/iterate/sessions",
        json={"feedback_id": feedback_id},
    )
    r.raise_for_status()
    sid = str(r.json()["id"])
    print("OK iter session:", sid)
    return sid


def run_iteration(
    client: httpx.Client, session_id: str, message: str, restructure: bool
) -> str | None:
    """Stream the iteration; print sections + final version id."""
    print(f"\n>>> running iteration (restructure={restructure}) ...")
    sections_seen: list[str] = []
    version_id: str | None = None
    error: str | None = None
    chunks: list[str] = []
    headers = {
        "Idempotency-Key": f"smoke-{int(time.time() * 1000)}",
        "Accept": "text/event-stream",
    }
    body = {"user_message": message, "restructure_allowed": restructure}
    # Stream-mode httpx call.
    started = time.time()
    with client.stream(
        "POST",
        f"{BASE}/feedback/iterate/sessions/{session_id}/iterations",
        json=body,
        headers=headers,
        timeout=180.0,
    ) as resp:
        if resp.status_code != 200:
            text = resp.read().decode("utf-8", "replace")
            print("iteration HTTP error:", resp.status_code, text[:500])
            return None
        buf = ""
        for raw in resp.iter_text():
            buf += raw
            while "\n\n" in buf:
                frame, buf = buf.split("\n\n", 1)
                if frame.startswith(":"):
                    continue
                event = None
                data = ""
                for line in frame.split("\n"):
                    if line.startswith("event:"):
                        event = line[6:].strip()
                    elif line.startswith("data:"):
                        data += line[5:].strip()
                if not event:
                    continue
                try:
                    payload = json.loads(data) if data else {}
                except Exception:
                    payload = {"raw": data}
                if event == "section":
                    sections_seen.append(payload.get("section", "?"))
                    print("  [section]", payload.get("section"))
                elif event == "token":
                    chunks.append(payload.get("chunk", ""))
                elif event == "done":
                    version_id = payload.get("version_id")
                    print("  [done] version_id=", version_id, "v#=", payload.get("version_number"))
                elif event == "error":
                    error = f"{payload.get('error_code')}: {payload.get('message')}"
                    print("  [error]", error)
                else:
                    print("  [", event, "]", payload)
    elapsed = time.time() - started
    text = "".join(chunks)
    print(
        f"  streamed {len(chunks)} chunks ({len(text)} chars) "
        f"sections={sections_seen} in {elapsed:.1f}s"
    )
    if error:
        return None
    return version_id


def list_assumptions(client: httpx.Client, session_id: str) -> list[dict]:
    r = client.get(f"{BASE}/feedback/iterate/sessions/{session_id}/assumptions")
    r.raise_for_status()
    items = r.json()
    print(f"OK {len(items)} assumptions")
    for a in items:
        print(
            f"   - [{a['kind']}] {a['statement'][:80]}"
            f" (status={a['status']}, conf={a['confidence']})"
        )
    return items


def resolve_assumption(client: httpx.Client, aid: str, status: str, response: str | None = None) -> None:
    body: dict[str, object] = {"status": status}
    if response is not None:
        body["user_response"] = response
    r = client.patch(f"{BASE}/feedback/iterate/assumptions/{aid}", json=body)
    r.raise_for_status()
    print(f"  resolved {aid[:8]} -> {status}")


def finalize(client: httpx.Client, session_id: str) -> dict:
    r = client.post(
        f"{BASE}/feedback/iterate/sessions/{session_id}/finalize",
        json={},
    )
    if r.status_code >= 400:
        print("finalize failed:", r.status_code, r.text[:500])
        r.raise_for_status()
    pkg = r.json()
    print("OK finalized; zip key=", pkg["minio_zip_key"])
    return pkg


def download_zip(presigned_url: str, dest: Path) -> int:
    with httpx.Client(timeout=60.0) as c:
        r = c.get(presigned_url)
        r.raise_for_status()
        dest.write_bytes(r.content)
    return len(r.content)


def main() -> int:
    out_dir = Path("tools/iter_smoke_out")
    out_dir.mkdir(parents=True, exist_ok=True)

    with httpx.Client(timeout=600.0) as client:
        login(client)
        # CSRF + cookies stick on the client; subsequent calls inherit.
        feedback_id = submit_feedback(client)
        session_id = start_session(client, feedback_id)

        v1 = run_iteration(client, session_id, message="", restructure=False)
        if v1 is None:
            print("iteration 1 failed — abort")
            return 1

        asms = list_assumptions(client, session_id)
        if not asms:
            print("no assumptions returned — abort (iter expects at least one)")
            return 1

        # Resolve every assumption: confirm half, correct one, irrelevant the rest.
        for i, a in enumerate(asms):
            if i == 0:
                resolve_assumption(
                    client,
                    a["id"],
                    "corrected",
                    response="Use the existing 'Compliance Officer' role; don't create a new persona.",
                )
            elif i % 3 == 1:
                resolve_assumption(client, a["id"], "irrelevant")
            else:
                resolve_assumption(client, a["id"], "confirmed")

        v2 = run_iteration(
            client,
            session_id,
            message=(
                "Tighten the spec: only Compliance Officers can drag cards. "
                "Make Then statements measurable (e.g., 'card moves within 200ms')."
            ),
            restructure=False,
        )
        if v2 is None:
            print("iteration 2 failed — abort")
            return 1

        # Resolve any new assumptions before finalize.
        new_asms = [a for a in list_assumptions(client, session_id) if a["status"] == "open"]
        for a in new_asms:
            resolve_assumption(client, a["id"], "confirmed")

        pkg = finalize(client, session_id)
        url = pkg.get("presigned_zip_url")
        if not url:
            print("no presigned URL — checking GET /package")
            r = client.get(f"{BASE}/feedback/iterate/sessions/{session_id}/package")
            r.raise_for_status()
            pkg = r.json()
            url = pkg.get("presigned_zip_url")
        if not url:
            print("still no presigned URL — abort")
            return 1
        zip_path = out_dir / f"{session_id}.zip"
        size = download_zip(url, zip_path)
        print(f"OK downloaded ZIP {size} bytes -> {zip_path}")

        # Inspect ZIP entries
        import zipfile

        with zipfile.ZipFile(zip_path) as z:
            names = z.namelist()
        print(f"ZIP entries ({len(names)}):")
        for n in sorted(names):
            print("  ", n)

    print("\nALL GREEN")
    return 0


if __name__ == "__main__":
    sys.exit(main())
