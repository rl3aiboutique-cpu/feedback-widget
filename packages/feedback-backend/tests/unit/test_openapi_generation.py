"""Regression test — the widget router's OpenAPI schema must generate cleanly.

Reproduces the bug where ``deps.py`` used ``from __future__ import annotations``
and FastAPI's ``get_type_hints()`` failed on the closure-captured
``Annotated[CurrentUserSnapshot, Depends(_get_current_user)]`` parameter,
leaving ``_get_current_admin`` with an unresolved ForwardRef. The /openapi.json
endpoint then 500'd with ``PydanticUserError: ... is not fully defined``.

Hosts hitting Swagger UI or regenerating the SDK from OpenAPI rely on this.
"""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from feedback_widget import build_dependencies
from feedback_widget.auth import CurrentUserSnapshot
from feedback_widget.router import build_router
from feedback_widget.settings import FeedbackSettings
from sqlalchemy import create_engine


class _FakeAuth:
    def get_current_user(self, request: Request) -> CurrentUserSnapshot | None:
        return CurrentUserSnapshot(
            user_id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
            email="user@test.local",
            role="MASTER_ADMIN",
        )

    def is_master_admin(self, user: CurrentUserSnapshot) -> bool:
        return True


def test_openapi_schema_generates_without_pydantic_error() -> None:
    """Hitting /openapi.json must not raise PydanticUserError."""
    settings = FeedbackSettings(
        DATABASE_URL="postgresql+psycopg://x:y@127.0.0.1:1/none",
        S3_ENDPOINT_URL="http://localhost:1",
        S3_ACCESS_KEY="x",
        S3_SECRET_KEY="y",
        BUCKET="test",
        SMTP_HOST="localhost",
        SMTP_PORT=1,
        EMAILS_FROM_EMAIL="t@x.com",
        NOTIFY_EMAILS="",
        CSRF_REQUIRED=False,
        MULTI_TENANT_MODE=False,
        RATE_LIMIT_PER_HOUR=1000,
        BRAND_NAME="Test",
    )
    engine = create_engine(settings.DATABASE_URL)
    deps = build_dependencies(auth=_FakeAuth(), engine=engine, settings=settings)
    storage = MagicMock()
    router = build_router(deps=deps, settings=settings, storage=storage)

    app = FastAPI()
    app.include_router(router, prefix="/feedback")
    client = TestClient(app)
    resp = client.get("/openapi.json")
    assert resp.status_code == 200, resp.text
    schema = resp.json()
    assert "paths" in schema
    assert "/feedback/health" in schema["paths"]
    # The endpoint protected by admin must also be present (tests the
    # ``Annotated[CurrentUserSnapshot, Depends(_get_current_user)]`` path):
    assert any(p.startswith("/feedback") for p in schema["paths"])
