"""Domain exceptions raised by the feedback service.

Extracted from ``service.py`` so router code can import the exception
hierarchy without pulling in the service's heavier dependency graph.
"""

from __future__ import annotations

from feedback_widget.models import FeedbackType


class FeedbackError(Exception):
    """Base for service-layer errors. Routers translate these to HTTP."""


class FeedbackRateLimitExceededError(FeedbackError):
    """Raised when the per-user submission window is full."""

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__(f"Feedback rate limit exceeded; retry after {retry_after_seconds}s")
        self.retry_after_seconds = retry_after_seconds


class FeedbackNotFoundError(FeedbackError):
    """Lookup failed - either missing or filtered out by RLS."""


class FeedbackTypeRequiresFieldError(FeedbackError):
    """A type-specific required field was missing from type_fields."""

    def __init__(self, field_name: str, feedback_type: FeedbackType) -> None:
        super().__init__(
            f"Field {field_name!r} is required for feedback type {feedback_type.value!r}"
        )
        self.field_name = field_name
        self.feedback_type = feedback_type
