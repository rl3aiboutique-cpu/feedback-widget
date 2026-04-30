"""Feedback router helpers.

These were inlined in the CRM's ``app/feedback/router.py`` until the
file pushed past the 700-line cap. Splitting them out keeps the router
free of content-sniffing magic and SMTP plumbing while preserving every
behaviour pinned by the existing test suite.

The functions here are called only from the router; importing them
back via the router keeps the public surface area unchanged.
"""

from __future__ import annotations

import logging
import re
import uuid

from fastapi import BackgroundTasks, HTTPException, Request, status
from starlette.datastructures import FormData
from starlette.datastructures import UploadFile as StarletteUploadFile

from feedback_widget.dto import AttachmentUpload, ScreenshotUpload
from feedback_widget.email import EmailAttachment, send_email
from feedback_widget.settings import FeedbackSettings

logger = logging.getLogger(__name__)


# Maximum number of user-uploaded attachments per submission. The
# auto-captured screenshot is independent of this cap.
MAX_USER_ATTACHMENTS = 5


# Magic-byte signatures for image content-types we accept on the
# auto-captured screenshot. The Content-Type header is attacker-
# controlled, so we sniff the first bytes to confirm. SVG is
# intentionally NOT in this list — SVG can carry inline JavaScript
# that would run when an admin opens the screenshot's presigned URL.
_ALLOWED_SCREENSHOT_TYPES: frozenset[str] = frozenset({"image/png", "image/jpeg", "image/webp"})
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_JPEG_MAGIC = b"\xff\xd8\xff"
_WEBP_RIFF = b"RIFF"
_WEBP_TAG = b"WEBP"
_GIF_MAGIC_87 = b"GIF87a"
_GIF_MAGIC_89 = b"GIF89a"
_PDF_MAGIC = b"%PDF-"

# User-uploaded attachments allow a wider set: still no SVG, no
# executables, no archives, no HTML. Text formats have to UTF-8 decode
# cleanly. Octet-stream uploads with a ``.log`` / ``.txt`` extension
# are remapped to ``text/plain`` before this check (see read_attachments).
_ALLOWED_ATTACHMENT_TYPES: frozenset[str] = frozenset(
    {
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/json",
        "application/x-ndjson",
    }
)
_TEXT_ATTACHMENT_TYPES: frozenset[str] = frozenset(
    {"text/plain", "text/markdown", "application/json", "application/x-ndjson"}
)


def sniff_image_type(data: bytes) -> str | None:
    """Return the canonical content-type if ``data`` begins with a known
    image magic byte sequence; otherwise None.
    """
    if data.startswith(_PNG_MAGIC):
        return "image/png"
    if data.startswith(_JPEG_MAGIC):
        return "image/jpeg"
    if len(data) >= 12 and data[:4] == _WEBP_RIFF and data[8:12] == _WEBP_TAG:
        return "image/webp"
    return None


def sniff_attachment_type(data: bytes, declared: str) -> str | None:
    """Return the canonical content-type if ``data`` matches the declared
    type via magic bytes (images, PDFs) or a clean UTF-8 decode (text).
    Returns None on mismatch.
    """
    declared = declared.lower().strip()
    if declared.startswith("image/"):
        if declared == "image/gif":
            if data.startswith(_GIF_MAGIC_87) or data.startswith(_GIF_MAGIC_89):
                return "image/gif"
            return None
        sniffed = sniff_image_type(data)
        return sniffed if sniffed == declared else None
    if declared == "application/pdf":
        return "application/pdf" if data.startswith(_PDF_MAGIC) else None
    if declared in _TEXT_ATTACHMENT_TYPES:
        try:
            data.decode("utf-8")
        except UnicodeDecodeError:
            return None
        return declared
    return None


_FILENAME_SAFE_RE = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_filename(filename: str, *, max_length: int = 200) -> str:
    """Reduce a user-supplied filename to alphanumerics + ``._-`` so it
    can sit safely inside an S3 object key and inside a ZIP path. Empty
    or all-stripped names fall back to ``attachment``.
    """
    safe = _FILENAME_SAFE_RE.sub("_", filename).strip("._-")
    if not safe:
        safe = "attachment"
    if len(safe) > max_length:
        if "." in safe:
            base, _, ext = safe.rpartition(".")
            keep = max_length - len(ext) - 1
            safe = f"{base[:keep]}.{ext}" if keep > 0 else safe[:max_length]
        else:
            safe = safe[:max_length]
    return safe


async def read_screenshot(
    screenshot: StarletteUploadFile | None,
    *,
    settings: FeedbackSettings,
) -> ScreenshotUpload | None:
    """Pull the screenshot bytes off the wire, validate, and wrap them.

    Returns None when no file was uploaded. Enforces:

    * Size cap (``settings.MAX_SCREENSHOT_BYTES``, default 10 MB) → 413.
    * Content-type allowlist (PNG / JPEG / WebP only) → 415.
    * Magic-byte sniff to reject content masquerading as an allowed type → 415.
    """
    if screenshot is None:
        return None
    data = await screenshot.read()
    if not data:
        return None
    if len(data) > settings.MAX_SCREENSHOT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Screenshot exceeds the {settings.MAX_SCREENSHOT_BYTES} byte cap.",
        )
    declared_type = (screenshot.content_type or "").lower().strip()
    if declared_type not in _ALLOWED_SCREENSHOT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                "Screenshot content-type must be one of "
                f"{sorted(_ALLOWED_SCREENSHOT_TYPES)}; got {declared_type or '(none)'}."
            ),
        )
    sniffed = sniff_image_type(data)
    if sniffed is None or sniffed != declared_type:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                "Screenshot bytes do not match the declared content-type. "
                "We accept PNG, JPEG, and WebP only."
            ),
        )
    return ScreenshotUpload(content=data, content_type=sniffed)


async def read_attachments(
    uploads: list[StarletteUploadFile],
    *,
    settings: FeedbackSettings,
) -> list[AttachmentUpload]:
    """Pull up to ``MAX_USER_ATTACHMENTS`` files off the wire, validate,
    and wrap them.

    Enforces:

    * Count cap (``MAX_USER_ATTACHMENTS``) → 400.
    * Size cap per file (``settings.MAX_SCREENSHOT_BYTES``) → 413.
    * MIME allowlist (images, PDF, text/log/json/markdown) → 415.
    * Magic-byte sniff (images, PDF) or UTF-8 decode (text) → 415.
    """
    if not uploads:
        return []
    if len(uploads) > MAX_USER_ATTACHMENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Up to {MAX_USER_ATTACHMENTS} attachments allowed per submission.",
        )
    results: list[AttachmentUpload] = []
    for upload in uploads:
        data = await upload.read()
        if not data:
            continue
        original_filename = upload.filename or "attachment"
        if len(data) > settings.MAX_SCREENSHOT_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    f"Attachment '{original_filename}' exceeds the "
                    f"{settings.MAX_SCREENSHOT_BYTES} byte cap."
                ),
            )
        declared = (upload.content_type or "").lower().strip()
        # Browsers sometimes send octet-stream for plain text/log files.
        # If the filename extension is a known text-like one, remap to
        # text/plain so the allowlist + UTF-8 check apply.
        if declared in {"application/octet-stream", ""}:
            lower_name = original_filename.lower()
            if lower_name.endswith(".log") or lower_name.endswith(".txt"):
                declared = "text/plain"
            elif lower_name.endswith(".md"):
                declared = "text/markdown"
            elif lower_name.endswith(".json"):
                declared = "application/json"
        if declared not in _ALLOWED_ATTACHMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=(
                    f"Attachment '{original_filename}' has unsupported type "
                    f"{declared or '(none)'}. Allowed: images (PNG/JPEG/GIF/WebP), "
                    "PDF, plain text, markdown, JSON."
                ),
            )
        sniffed = sniff_attachment_type(data, declared)
        if sniffed is None:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=(
                    f"Attachment '{original_filename}' bytes do not match the "
                    f"declared content-type {declared!r}."
                ),
            )
        results.append(
            AttachmentUpload(
                content=data,
                content_type=sniffed,
                filename=sanitize_filename(original_filename),
            )
        )
    return results


def enqueue_notification(
    background: BackgroundTasks,
    *,
    feedback_id: uuid.UUID,
    feedback_snapshot_subject: str,
    html: str,
    text: str,
    screenshot_bytes: bytes | None,
    screenshot_content_type: str | None,
    settings: FeedbackSettings,
) -> None:
    """Schedule the SMTP send + attach (or inline) the screenshot.

    No-op when there are no configured recipients.
    """
    recipients = settings.notify_emails_list
    if not recipients:
        logger.info(
            "feedback notification skipped: NOTIFY_EMAILS empty (id=%s)",
            feedback_id,
        )
        return

    attachments: list[EmailAttachment] = []
    if screenshot_bytes is not None:
        attachments.append(
            EmailAttachment(
                filename="screenshot.png",
                content=screenshot_bytes,
                content_type=screenshot_content_type or "image/png",
            )
        )

    def _task() -> None:
        try:
            send_email(
                to=recipients,
                subject=feedback_snapshot_subject,
                html=html,
                text=text,
                attachments=attachments or None,
                settings=settings,
            )
        except (OSError, RuntimeError):
            logger.exception("feedback notification dispatch failed (id=%s)", feedback_id)

    background.add_task(_task)


async def parse_feedback_form(request: Request) -> FormData:
    """Pre-parse the multipart form with a 12 MB per-part limit.

    The route owns the multipart body via this dep — there are no
    ``Form()`` / ``File()`` body params on the route — because in
    FastAPI 0.135+ the request handler eagerly calls ``await
    request.form()`` (with Starlette's 1 MB default) BEFORE
    sub-dependencies resolve when the route declares any ``Form()``
    body params. Owning the body via the dep alone keeps FastAPI's
    body-handling shortcut out of the way and lets
    ``request.form(max_part_size=12 MB)`` run first.

    File parts: 1 ``payload`` + 1 ``screenshot`` + up to
    ``MAX_USER_ATTACHMENTS`` ``attachments``.
    """
    return await request.form(
        max_files=2 + MAX_USER_ATTACHMENTS,
        max_fields=16,
        max_part_size=12 * 1024 * 1024,
    )
