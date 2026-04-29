"""Sync SMTP sender used by the feedback widget.

The sender builds an RFC-822 message with both an HTML and a plain-text
alternative, optionally attaches files, and ships the whole thing via
:mod:`smtplib` from the stdlib.

When ``settings.emails_enabled`` is False (no SMTP host or no FROM
address), the function logs a warning and returns False — this lets
local dev, unit tests, and CI environments operate without an SMTP relay.

The sender is sync; FastAPI routes call it inside ``BackgroundTasks``
so the HTTP response returns before the SMTP round-trip completes.

See ADR-006 for the rationale on the sync default.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage

from feedback_widget.settings import FeedbackSettings, get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class EmailAttachment:
    """One file attachment for an outgoing email."""

    filename: str
    content: bytes
    content_type: str


def _build_message(
    *,
    sender: str,
    to: list[str],
    subject: str,
    html: str,
    text: str,
    attachments: list[EmailAttachment] | None,
) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    for att in attachments or []:
        maintype, _, subtype = att.content_type.partition("/")
        if not subtype:
            maintype, subtype = "application", "octet-stream"
        msg.add_attachment(
            att.content,
            maintype=maintype,
            subtype=subtype,
            filename=att.filename,
        )
    return msg


def send_email(
    *,
    to: list[str],
    subject: str,
    html: str,
    text: str,
    attachments: list[EmailAttachment] | None = None,
    settings: FeedbackSettings | None = None,
) -> bool:
    """Send an email. Returns True on a successful SMTP submission, False otherwise.

    No-ops (returns False, logs a warning) when ``settings.emails_enabled``
    is False.
    """
    cfg = settings or get_settings()

    if not to:
        logger.warning("send_email called with empty recipient list — skipping")
        return False

    if not cfg.emails_enabled:
        logger.warning(
            "send_email called but emails_enabled is False (SMTP_HOST or "
            "EMAILS_FROM_EMAIL missing). Subject=%r recipients=%d",
            subject,
            len(to),
        )
        return False

    sender = cfg.EMAILS_FROM_EMAIL
    sender_name = cfg.EMAILS_FROM_NAME
    from_field = f"{sender_name} <{sender}>" if sender_name else str(sender)

    message = _build_message(
        sender=from_field,
        to=to,
        subject=subject,
        html=html,
        text=text,
        attachments=attachments,
    )

    try:
        if cfg.SMTP_SSL:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(cfg.SMTP_HOST, cfg.SMTP_PORT, context=context) as smtp:
                if cfg.SMTP_USER:
                    smtp.login(cfg.SMTP_USER, cfg.SMTP_PASSWORD)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(cfg.SMTP_HOST, cfg.SMTP_PORT) as smtp:
                if cfg.SMTP_TLS:
                    smtp.starttls(context=ssl.create_default_context())
                if cfg.SMTP_USER:
                    smtp.login(cfg.SMTP_USER, cfg.SMTP_PASSWORD)
                smtp.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        logger.exception(
            "send_email failed: subject=%r recipients=%d host=%s err=%s",
            subject,
            len(to),
            cfg.SMTP_HOST,
            exc,
        )
        return False

    logger.info(
        "send_email ok: subject=%r recipients=%d host=%s",
        subject,
        len(to),
        cfg.SMTP_HOST,
    )
    return True
