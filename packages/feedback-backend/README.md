# `rl3-feedback-widget` (Python)

Async-only FastAPI module providing the RL3 feedback widget's backend: SQLModel tables, router, service, redaction, S3 client, mailer, and its own Alembic chain.

## Install

```bash
pip install "git+https://github.com/rl3-ai/feedback-widget.git@v0.1.0#subdirectory=packages/feedback-backend"
```

## Public API

```python
from feedback_widget import (
    FeedbackSettings,        # pydantic-settings (env_prefix=FEEDBACK_)
    FeedbackAuthAdapter,     # Protocol the host implements
    register_feedback_router # the one function to call
)
```

See top-level [`docs/INTEGRATION-GUIDE.md`](../../docs/INTEGRATION-GUIDE.md).

## CLI

```bash
python -m feedback_widget migrate --database-url=postgresql+asyncpg://...
python -m feedback_widget version
python -m feedback_widget check-config
```

## Status

`v0.1.0` — under construction. See top-level CHANGELOG.
