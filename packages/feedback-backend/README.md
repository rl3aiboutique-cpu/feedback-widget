# `rl3-feedback-widget` (Python)

FastAPI module providing the RL3 feedback widget's backend: SQLModel tables, router, service, redaction, S3 client, mailer, ticket comments, and its own Alembic chain.

## Install

```bash
pip install "rl3-feedback-widget @ git+https://github.com/rl3aiboutique-cpu/feedback-widget.git@v0.2.4#subdirectory=packages/feedback-backend"
```

## Public API

```python
from feedback_widget import (
    FeedbackSettings,                       # pydantic-settings (env_prefix=FEEDBACK_)
    FeedbackAuthAdapter,                    # Protocol the host implements
    register_feedback_router,               # low-level entry point
    mount_feedback_widget_for_async_host,   # one-call entry point (recommended)
)
```

See top-level [`docs/INSTALL.md`](../../docs/INSTALL.md) for the full guide.

## CLI

```bash
feedback-widget verify           # probe DB / S3 / SMTP
feedback-widget migrate          # apply migrations to feedback_widget_alembic_version
feedback-widget check-config     # dump effective settings
feedback-widget version
feedback-widget drop-tables      # destructive (interactive)
```

## Status

`v0.2.4` — beta. See top-level [`CHANGELOG.md`](../../CHANGELOG.md).
