# Install `@rl3/feedback-widget` into capellai-ai-crm

> **Status: planned (Phase 5b)**. The CRM consumes the widget once
> sapphira validates the contract end-to-end. This guide is the
> migration path.

## What changes

The CRM's `backend/app/feedback/` and `frontend/src/widgets/feedback/`
become obsolete — the package replaces them. Touched files:

* `backend/pyproject.toml` — add the package as a git dependency.
* `backend/app/api/main.py` — `register_feedback_router(...)` replaces
  the manual `app.include_router(feedback_router, ...)`.
* `backend/app/api/crm_feedback_adapter.py` — NEW (~30 lines) —
  bridges the CRM's `CurrentUser` + `TenantSession` to the package's
  `FeedbackAuthAdapter`, including `tenant_id` (CRM is multi-tenant).
* `backend/app/feedback/` — DELETED.
* `frontend/package.json` — add the package.
* `frontend/src/lib/feedback-bindings.ts` — NEW (~15 lines).
* `frontend/src/routes/_layout.tsx:49` — replace inline mount with the
  package's `<FeedbackProvider bindings={...}>`.
* `frontend/src/routes/_layout/admin_.feedback.tsx` —  replace inline
  triage page with `<FeedbackTriagePage />`.
* `frontend/src/routes/feedback.{accept,reject}.tsx` — replace with
  package's `<FeedbackActionPage action="..." />`.
* `frontend/src/widgets/feedback/` — DELETED.

## Settings

CRM is multi-tenant + uses CSRF, so the env vars differ from sapphira:

```bash
FEEDBACK_MULTI_TENANT_MODE=true
FEEDBACK_CSRF_REQUIRED=true
FEEDBACK_BRAND_NAME="Compliance Brain"
# ...rest match sapphira.
```

The `MULTI_TENANT_MODE=true` flag turns on `WHERE tenant_id = ...`
defence-in-depth in the service. It does NOT add `CREATE POLICY` —
the CRM's existing RLS policies on `feedback` / `feedback_attachment`
remain in place; the package's migrations (with
`version_table='feedback_widget_alembic_version'`) sit alongside the
CRM's own chain.

## Dual-Alembic-chain handover

Tricky bit: the CRM has already applied migrations
`b5e9f1c4a2d8_add_feedback_tables` and
`d7c4a8e91f23_feedback_ticketing_workflow` from its own chain. The
package's chain is `0001_initial_feedback_schema` +
`0002_ticketing_workflow`. Schemas match, but Alembic doesn't know.

Migration plan:

1. Mark the CRM's existing feedback migrations as already-applied
   (via the CRM's chain, no change there).
2. Run `python -m feedback_widget migrate --database-url=...` once.
   The package detects existing tables (Alembic's CREATE TABLE
   would fail) — instead, **stamp** the package's chain at head:
   `alembic stamp head` via the package's CLI:
   ```bash
   uv run python -c "from feedback_widget.cli import _alembic_config
   from alembic import command
   cfg = _alembic_config('postgresql://...')
   command.stamp(cfg, 'head')"
   ```
3. From this point forward, **all new feedback schema changes ship
   via the package's chain**. The CRM stops adding feedback
   migrations to its own `app/alembic/versions/`.

## Validation

After migration, the CRM's existing 65-test suite for feedback should
pass against the package router. The router's URL prefix is the same
(`/api/v1/feedback`), the JSON shapes are identical, and the CSRF +
multi-tenant gates are flipped on. The smoke test:

```bash
cd capellai-ai-crm
make up
make smoke
make test  # 158-ish tests still green
pnpm exec playwright test  # parity suite
```

## Phase

This migration is Phase 5b in the plan. It runs **after** sapphira
(Phase 5) has been stable for a week — the second consumer is the
real validator that ADR-043's "two consecutive consumer apps"
threshold is hit.
