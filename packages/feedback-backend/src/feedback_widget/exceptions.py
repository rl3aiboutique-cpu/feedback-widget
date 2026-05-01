"""Domain exceptions raised by the feedback service.

Extracted from ``service.py`` so router code can import the exception
hierarchy without pulling in the service's heavier dependency graph.
"""

from __future__ import annotations


class FeedbackError(Exception):
    """Base for service-layer errors. Routers translate these to HTTP."""


class FeedbackRateLimitExceededError(FeedbackError):
    """Raised when the per-user submission window is full."""

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__(f"Feedback rate limit exceeded; retry after {retry_after_seconds}s")
        self.retry_after_seconds = retry_after_seconds


class FeedbackNotFoundError(FeedbackError):
    """Lookup failed - either missing or filtered out by RLS."""
