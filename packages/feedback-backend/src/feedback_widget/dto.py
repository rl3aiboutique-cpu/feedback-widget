"""Plain data carriers shared by the feedback router + service.

Pulled out of ``service.py`` so importers (e.g. the helpers module) can
read the upload shape without taking a dependency on the heavier
service module's imports.
"""

from __future__ import annotations

from dataclasses import dataclass

from feedback_widget.models import FeedbackAttachmentKind


@dataclass
class ScreenshotUpload:
    """In-memory auto-captured screenshot the router hands to the service."""

    content: bytes
    content_type: str
    width: int | None = None
    height: int | None = None


@dataclass
class AttachmentUpload:
    """In-memory user-uploaded attachment (wireframe, log, note, …)."""

    content: bytes
    content_type: str
    filename: str
    kind: FeedbackAttachmentKind = FeedbackAttachmentKind.USER_ATTACHMENT
    width: int | None = None
    height: int | None = None
