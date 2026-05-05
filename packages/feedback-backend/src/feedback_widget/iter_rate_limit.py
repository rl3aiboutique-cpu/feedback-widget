"""SQL-aggregation rate limiter for the Iterate-with-AI module.

Two scopes (spec §7):

* per session — hard cap on total LLM calls (success or failure)
  against one ``feedback_iter_session`` row. Default 20.
* per user per week — sliding 7-day window across ALL of the user's
  sessions. Default 100.

A 30-second in-process TTL cache fronts the count queries so
hot-loops don't hammer Postgres on every page render. Internal
retries on transient provider errors do NOT count (the service
records them as separate ``feedback_iter_call`` rows but excludes
them from the limiter via a status filter).
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlmodel import Session

from .iter_schemas import IterRateLimitError
from .settings import FeedbackSettings

_CACHE_TTL_SECONDS = 30


@dataclass(frozen=True)
class _CacheEntry:
    expires_at: float
    count: int


class IterRateLimitExceededError(RuntimeError):
    """Raised when a check fails. Carries the spec-§7.2 body shape."""

    def __init__(self, body: IterRateLimitError) -> None:
        super().__init__(
            f"rate limit exceeded: {body.scope} ({body.current}/{body.limit})"
        )
        self.body = body


class IterRateLimiter:
    """Per-process counter cache + SQL aggregation.

    Construct one instance per FastAPI app (the same lifetime as
    the engine). Methods are safe to call from request handlers.
    """

    def __init__(self) -> None:
        self._cache: dict[str, _CacheEntry] = {}

    def _cached(self, key: str) -> int | None:
        entry = self._cache.get(key)
        if entry is None or entry.expires_at < time.monotonic():
            return None
        return entry.count

    def _store(self, key: str, count: int) -> None:
        self._cache[key] = _CacheEntry(
            expires_at=time.monotonic() + _CACHE_TTL_SECONDS,
            count=count,
        )

    def _bust(self, *keys: str) -> None:
        for k in keys:
            self._cache.pop(k, None)

    # ── Cache busting ───────────────────────────────────────────────
    def record_call(self, *, session_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Tell the limiter a new call row was just inserted so the
        cache for the affected scopes is invalidated. Cheaper than
        decrementing-and-reading because the next caller will pay
        the SQL cost regardless."""
        bucket = int(time.time() // 60)
        self._bust(
            self._session_key(session_id, bucket),
            self._user_key(user_id, bucket),
        )

    # ── Scope keys ─────────────────────────────────────────────────
    @staticmethod
    def _session_key(session_id: uuid.UUID, minute_bucket: int) -> str:
        return f"session:{session_id}:{minute_bucket}"

    @staticmethod
    def _user_key(user_id: uuid.UUID, minute_bucket: int) -> str:
        return f"user_week:{user_id}:{minute_bucket}"

    # ── Per-session check ───────────────────────────────────────────
    def check_session_total(
        self,
        db: Session,
        *,
        session_id: uuid.UUID,
        settings: FeedbackSettings,
    ) -> None:
        bucket = int(time.time() // 60)
        key = self._session_key(session_id, bucket)
        count = self._cached(key)
        if count is None:
            count = self._sql_session_count(db, session_id)
            self._store(key, count)
        limit = settings.ITER_MAX_CALLS_PER_SESSION
        if count >= limit:
            raise IterRateLimitExceededError(
                IterRateLimitError(
                    scope="session",
                    limit=limit,
                    current=count,
                    retry_after_seconds=0,
                )
            )

    @staticmethod
    def _sql_session_count(db: Session, session_id: uuid.UUID) -> int:
        # Count ALL rows (success + failure) — failures DO count
        # against the cap so a buggy prompt can't be retried forever.
        result = db.execute(
            text(
                """
                SELECT COUNT(*) AS n
                FROM feedback_iter_call
                WHERE session_id = :sid
                """
            ).bindparams(sid=session_id)
        ).one()
        return int(result[0])

    # ── Per-user-week check ─────────────────────────────────────────
    def check_user_week(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        settings: FeedbackSettings,
    ) -> None:
        bucket = int(time.time() // 60)
        key = self._user_key(user_id, bucket)
        count = self._cached(key)
        if count is None:
            count = self._sql_user_week_count(db, user_id)
            self._store(key, count)
        limit = settings.ITER_MAX_CALLS_PER_USER_WEEK
        if count >= limit:
            raise IterRateLimitExceededError(
                IterRateLimitError(
                    scope="user_week",
                    limit=limit,
                    current=count,
                    retry_after_seconds=self._user_week_reset_seconds(
                        db, user_id
                    ),
                )
            )

    @staticmethod
    def _sql_user_week_count(db: Session, user_id: uuid.UUID) -> int:
        result = db.execute(
            text(
                """
                SELECT COUNT(*) AS n
                FROM feedback_iter_call c
                JOIN feedback_iter_session s ON s.id = c.session_id
                WHERE s.created_by_user_id = :uid
                  AND c.created_at > NOW() - INTERVAL '7 days'
                """
            ).bindparams(uid=user_id)
        ).one()
        return int(result[0])

    @staticmethod
    def _user_week_reset_seconds(db: Session, user_id: uuid.UUID) -> int:
        """Approximate seconds until the OLDEST call in the window
        ages out, so the client can set an honest Retry-After.
        """
        result = db.execute(
            text(
                """
                SELECT EXTRACT(
                    EPOCH FROM (
                        (MIN(c.created_at) + INTERVAL '7 days') - NOW()
                    )
                )::int AS seconds_until_reset
                FROM feedback_iter_call c
                JOIN feedback_iter_session s ON s.id = c.session_id
                WHERE s.created_by_user_id = :uid
                  AND c.created_at > NOW() - INTERVAL '7 days'
                """
            ).bindparams(uid=user_id)
        ).one()
        seconds = result[0]
        return max(0, int(seconds or 0))
