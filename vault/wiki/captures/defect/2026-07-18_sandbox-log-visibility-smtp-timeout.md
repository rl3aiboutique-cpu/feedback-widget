---
type: defect
created: 2026-07-18
author: claude-code
source: spec-001-feedback-email-notifications
tags: [sandbox-host, mailer, observability]
---

# Sandbox log visibility + mailer SMTP timeout (OPEN, follow-up filed)

Found during spec 001 verification; filed as a background task chip, NOT fixed inline
(Principle I — one concern per change).

1. **Sandbox-host observability**: `docker logs feedback-sandbox-backend` shows only startup
   alembic lines; uvicorn access logs and all app logger output (`send_email ok/failed`,
   `feedback notification skipped`) never surface. Suspect stdout/stderr buffering —
   `apps/sandbox-host/backend/Dockerfile` sets no `PYTHONUNBUFFERED=1`. Blocks SC-004 log
   verification in the sandbox (moved to CBP prod smoke).
2. **Mailer lacks SMTP timeout**: `packages/feedback-backend/src/feedback_widget/email/mailer.py`
   opens `smtplib.SMTP(host, port)` / `SMTP_SSL(...)` without `timeout=`. With the relay down,
   the BackgroundTasks send thread blocks on TCP connect for the OS default (minutes). Users
   unaffected (post-response thread), but outage bursts pile up threads. Fix hint: settings-driven
   `FEEDBACK_SMTP_TIMEOUT_SECONDS` (default ~10) passed to both constructors + regression test.

Related: [[2026-07-18_hatchling-duplicate-force-include]]
