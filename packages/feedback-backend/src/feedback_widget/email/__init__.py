"""Email subsystem for the feedback widget — Jinja templates + SMTP mailer.

Public API:

* :func:`send_email` — fire-and-forget SMTP send (sync; suitable for
  ``BackgroundTasks.add_task``).
* :class:`EmailAttachment` — typed attachment for inline / file
  attachments.
* :func:`render_template` — Jinja env scoped to ``email/templates/``.

The render functions for feedback-specific subjects + bodies live in
:mod:`feedback_widget.email.render`.
"""

from feedback_widget.email.mailer import EmailAttachment, send_email
from feedback_widget.email.rendering import render_template

__all__ = ["EmailAttachment", "render_template", "send_email"]
