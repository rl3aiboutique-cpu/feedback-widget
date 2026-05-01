# Integration Guide

> **Canonical install guide → [`INSTALL.md`](./INSTALL.md)** — host↔widget responsibility matrix, full env reference, troubleshooting.
>
> Architecture decisions → [`adr/000-index.md`](./adr/000-index.md).

This file is the high-level checklist. Treat `INSTALL.md` as the source of truth.

---

## What you need

- Python ≥ 3.12, FastAPI ≥ 0.115, async DB driver (asyncpg).
- Postgres ≥ 16.
- An S3-compatible blob store (MinIO works in dev; AWS S3 / R2 / B2 / Wasabi in prod).
- An SMTP relay (MailHog for dev; SendGrid / SES / Mailgun in prod).
- React ≥ 18, Tailwind CSS ≥ 4 in the host frontend.

## Backend (4 steps)

1. Add the dependency to your `pyproject.toml`.
2. Set the `FEEDBACK_*` env vars (see [`.env.example`](../apps/sandbox-host/backend/.env.example) and the full reference in `INSTALL.md`).
3. Call once from your API aggregator:

   ```python
   from feedback_widget import mount_feedback_widget_for_async_host

   mount_feedback_widget_for_async_host(
       app,
       secret_key=settings.SECRET_KEY,
       algorithm="HS256",
       prefix="/api/v1/feedback",
   )
   ```
4. Run `feedback-widget migrate` once during boot.

## Frontend (3 steps)

1. Add the dependency to your `package.json`.
2. Implement `FeedbackHostBindings` against your existing auth hook + CSRF (see `QUICKSTART.md` for the shape).
3. Mount `<FeedbackProvider bindings={...}><FeedbackButton /></FeedbackProvider>` inside your authenticated layout root. For the admin triage UI, render `<FeedbackTriagePage />` on a protected route.

## Verification

```bash
# CLI probes (DB / S3 / SMTP)
feedback-widget verify

# Backend health
curl $API_BASE/api/v1/feedback/health

# OpenAPI lists feedback endpoints
curl $API_BASE/openapi.json | jq '.paths | keys[] | select(startswith("/api/v1/feedback"))'

# Submit a test ticket via the floating button (browser)
# Email lands in MailHog at $SMTP_UI
```

For host-specific integration nuances (multi-tenant + RLS, single-tenant Bearer auth, single-tenant cookies + CSRF) see the responsibility matrix in [`INSTALL.md`](./INSTALL.md) and the configuration flags listed there.
