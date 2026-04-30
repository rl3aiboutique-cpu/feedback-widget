"""Fixtures that need a real Postgres + a fake S3 + a clean app process.

Skip the whole module if FEEDBACK_DATABASE_URL is unset / unreachable —
unit tests stay green even when there's no DB locally.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Generator
from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from feedback_widget import (
    CurrentUserSnapshot,
    FeedbackAuthAdapter,
    FeedbackSettings,
    register_feedback_router,
    run_migrations,
)
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError


def _database_url() -> str:
    # Use psycopg (v3) explicitly — sqlalchemy defaults to psycopg2 when
    # the driver is omitted, and psycopg2 is not in our deps.
    return os.environ.get(
        "FEEDBACK_DATABASE_URL",
        "postgresql+psycopg://feedback:feedback@localhost:5432/feedback_test",
    )


def _is_database_reachable(url: str) -> bool:
    try:
        engine = create_engine(url, connect_args={"connect_timeout": 2})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except OperationalError:
        return False
    except Exception:
        return False


_REACHABLE = _is_database_reachable(_database_url())

pytestmark = pytest.mark.skipif(
    not _REACHABLE,
    reason="Postgres not reachable at FEEDBACK_DATABASE_URL — skipping integration tests",
)


@pytest.fixture(scope="session")
def database_url() -> str:
    return _database_url()


@pytest.fixture(scope="session")
def settings(database_url: str) -> FeedbackSettings:
    """Test settings — single-tenant, CSRF off, MinIO/SMTP disabled."""
    os.environ["FEEDBACK_DATABASE_URL"] = database_url
    os.environ["FEEDBACK_BUCKET"] = "feedback-test"
    os.environ["FEEDBACK_S3_ENDPOINT_URL"] = "http://localhost:1"
    os.environ["FEEDBACK_S3_ACCESS_KEY"] = "test"
    os.environ["FEEDBACK_S3_SECRET_KEY"] = "test"
    os.environ["FEEDBACK_SMTP_HOST"] = ""
    os.environ["FEEDBACK_EMAILS_FROM_EMAIL"] = ""
    os.environ["FEEDBACK_NOTIFY_EMAILS"] = ""
    os.environ["FEEDBACK_CSRF_REQUIRED"] = "false"
    os.environ["FEEDBACK_MULTI_TENANT_MODE"] = "false"
    os.environ["FEEDBACK_RATE_LIMIT_PER_HOUR"] = "1000"
    os.environ["FEEDBACK_BRAND_NAME"] = "Test"
    return FeedbackSettings()


@pytest.fixture(scope="session")
def engine(database_url: str) -> Engine:
    return create_engine(database_url, pool_pre_ping=True)


@pytest.fixture(scope="session", autouse=True)
def _migrate_once(engine: Engine, database_url: str) -> Generator[None, Any, None]:
    """Apply the package's Alembic chain once per test session."""
    run_migrations(database_url=database_url)
    yield
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS feedback_attachment CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS feedback CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS feedback_widget_alembic_version CASCADE"))
        conn.execute(text("DROP TYPE IF EXISTS feedback_type CASCADE"))
        conn.execute(text("DROP TYPE IF EXISTS feedback_status CASCADE"))
        conn.execute(text("DROP TYPE IF EXISTS feedback_attachment_kind CASCADE"))


@pytest.fixture(autouse=True)
def _truncate_each_test(engine: Engine) -> Generator[None, Any, None]:
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE feedback_attachment, feedback CASCADE"))


_TEST_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
_TEST_ADMIN_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")


class TestAuth(FeedbackAuthAdapter):
    def get_current_user(self, request: Request) -> CurrentUserSnapshot | None:
        role = request.headers.get("X-Test-Role")
        if role is None:
            return None
        if role == "admin":
            return CurrentUserSnapshot(
                user_id=_TEST_ADMIN_ID,
                email="admin@test.local",
                tenant_id=None,
                role="admin",
                full_name="Test Admin",
            )
        return CurrentUserSnapshot(
            user_id=_TEST_USER_ID,
            email="staff@test.local",
            tenant_id=None,
            role="staff",
            full_name="Test Staff",
        )

    def is_master_admin(self, user: CurrentUserSnapshot) -> bool:
        return user.role == "admin"


class FakeStorage:
    """In-memory storage stand-in — integration tests don't hit MinIO."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def ensure_bucket(self, *, bucket: str | None = None) -> None:
        return None

    def upload(
        self,
        *,
        key: str,
        data: bytes,
        content_type: str,
        bucket: str | None = None,
    ) -> None:
        del content_type, bucket
        self.objects[key] = data

    def download(self, key: str, *, bucket: str | None = None) -> bytes:
        del bucket
        return self.objects.get(key, b"")

    def delete(self, key: str, *, bucket: str | None = None) -> None:
        del bucket
        self.objects.pop(key, None)

    def presigned_url(
        self,
        *,
        key: str,
        expires: int | None = None,
        bucket: str | None = None,
    ) -> str:
        del expires, bucket
        return f"https://fake-storage.test/{key}"


@pytest.fixture
def fake_storage() -> FakeStorage:
    return FakeStorage()


@pytest.fixture
def app(settings: FeedbackSettings, engine: Engine, fake_storage: FakeStorage) -> FastAPI:
    fastapi_app = FastAPI()
    register_feedback_router(
        fastapi_app,
        auth=TestAuth(),
        engine=engine,
        settings=settings,
        prefix="/feedback",
        storage=fake_storage,  # type: ignore[arg-type]
    )
    return fastapi_app


@pytest.fixture
def client(app: FastAPI) -> Generator[TestClient, Any, None]:
    with TestClient(app) as c:
        yield c
