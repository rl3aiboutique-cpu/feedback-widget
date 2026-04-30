# Integration Guide

> **Canonical install guide → [`INSTALL.md`](./INSTALL.md)** — host↔widget responsibility matrix, full env reference, Docker BuildKit secret pattern, troubleshooting.
>
> Host-specific walkthroughs:
> - sapphira-clinic → [`INSTALL-SAPPHIRA.md`](./INSTALL-SAPPHIRA.md)
> - CRM (Compliance Brain) → [`INSTALL-CRM.md`](./INSTALL-CRM.md)
>
> Architecture decisions → [`adr/000-index.md`](./adr/000-index.md).

The skeleton below predates `INSTALL.md` and is kept only as historical reference; treat `INSTALL.md` as the source of truth.

---

## What you need

- Python ≥ 3.12, FastAPI ≥ 0.115, async DB driver (asyncpg).
- Postgres ≥ 16.
- An S3-compatible blob store (MinIO works in dev).
- An SMTP relay (MailHog for dev).
- React ≥ 18, Tailwind CSS ≥ 4 in the host frontend.

## Backend (5 steps)

1. Add the dependency to your `pyproject.toml`.
2. Run `python -m feedback_widget migrate`.
3. Implement `FeedbackAuthAdapter` against your existing auth.
4. Set `FEEDBACK_*` env vars (see [`.env.example`](../apps/sandbox-host/backend/.env.example)).
5. Call `register_feedback_router(app, auth, settings)` from your API aggregator.

## Frontend (4 steps)

1. Add the dependency to your `package.json`.
2. Implement `FeedbackHostBindings` against your existing auth hook + CSRF.
3. Mount `<FeedbackProvider bindings={...}><FeedbackButton /></FeedbackProvider>` inside your authenticated layout root.
4. Add three thin route wrappers (admin triage, magic-link accept, magic-link reject).

## Verification (4 commands)

```bash
# Backend health
curl $API_BASE/api/v1/feedback/health
# OpenAPI lists feedback endpoints
curl $API_BASE/openapi.json | jq '.paths | keys[] | select(startswith("/feedback"))'
# Submit a test ticket via the floating button (browser)
# Email lands in MailHog at $SMTP_UI
```

Full battery for sapphira-clinic: [`INSTALL-SAPPHIRA.md`](./INSTALL-SAPPHIRA.md).
CRM migration plan: [`INSTALL-CRM.md`](./INSTALL-CRM.md).
Architecture decisions: [`adr/000-index.md`](./adr/000-index.md).
