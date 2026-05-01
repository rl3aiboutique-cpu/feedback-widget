# Plan: sapphira-clinic widget upgrade to v0.2.0

## Context

`sapphira-clinic` is the second host that consumes `@rl3/feedback-widget`
(it was the first install per ADR-006, the CRM came after). With v0.2.0
shipping a destructive schema cleanup + form simplification + multi-file
attachments, sapphira needs the same bump.

Current pin (in both `frontend/package.json` and
`backend/pyproject.toml`): `v0.1.13`.

## Audit — what breaks vs capellai

Searched sapphira's source for v0.1.x APIs we removed in v0.2.0
(`FeedbackActionPage`, `consumeActionToken`, `usePersonasQuery`,
`useUserStoriesQuery`, `persona`, `linked_user_stories`, etc.):

> No matches in `sapphira-clinic/frontend/src` or
> `sapphira-clinic/backend/app`.

That's the headline result: **sapphira does NOT use the removed APIs**.
Unlike the CRM (which had `routes/feedback.accept.tsx` and
`feedback.reject.tsx` wrapping the dropped `FeedbackActionPage`),
sapphira just mounts the floating button + admin triage page.

So the upgrade is **pin-bump + run alembic 0003** — no host code changes.

## Steps

### 1. Update pins
- `sapphira-clinic/frontend/package.json:43`
  `"@rl3/feedback-widget": "git+https://github.com/rl3aiboutique-cpu/feedback-widget.git#v0.2.0"`
- `sapphira-clinic/backend/pyproject.toml:26`
  `"rl3-feedback-widget @ git+https://github.com/rl3aiboutique-cpu/feedback-widget.git@v0.2.0#subdirectory=packages/feedback-backend"`
- Refresh lockfiles:
  - `cd backend && uv lock --upgrade-package rl3-feedback-widget`
  - `cd frontend && pnpm install`

### 2. Apply schema migration
Sapphira is **single-tenant** (`FEEDBACK_MULTI_TENANT_MODE=false`). The
widget's alembic chain runs on its own version table
(`feedback_widget_alembic_version`); 0003 is the current head and
expects 0002 to be already applied.

```bash
docker exec sapphira-backend uv run feedback-widget migrate \
  --database-url "postgresql+psycopg://<sapphira-creds>@postgres:5432/<db>"
```

The migration:
- Deletes rows with deprecated types/statuses (sapphira's beta seed data
  may include some).
- Drops 8 columns from `feedback`.
- Recreates 3 enums.
- Adds `expected_outcome` + attachment.filename.

Postgres-RLS is OFF on sapphira so no policy-rebuild needed.

### 3. Rebuild Docker images
```bash
cd sapphira-clinic
docker compose build --no-cache backend frontend
docker compose up -d --no-deps --force-recreate backend frontend
```

### 4. Smoke checks
- `curl http://localhost:8000/api/v1/feedback/health` → `{"ok":true,"version":"0.2.0"}`.
- Browser: floating button → dropdown shows 6 types → 3 fields per type → drag&drop attachments.
- Removed endpoints:
  - `GET /api/v1/feedback/personas` → expect 401 (auth) or 422 (UUID validation), NOT 200.
  - `POST /api/v1/feedback/action/<token>?action=accept` → expect 404.

### 5. PR / commit message
Single commit on a feature branch (`feat/feedback-widget-v0.2.0`):
> chore(feedback): bump @rl3/feedback-widget to v0.2.0
>
> Adopts the UX-first form (6 types × 3 fields) and multi-file
> attachments. No host code changes — sapphira didn't use any of the
> removed magic-link or persona/US APIs. Run `feedback-widget migrate`
> after deploy to apply Alembic 0003 (drops obsolete columns + recreates
> enums; v0.1.x rows with deprecated types are deleted — beta acceptable).

## Risk + rollback

- **Schema rollback is not supported** by 0003. Take a Postgres dump
  before applying:
  `docker exec sapphira-postgres pg_dump -U <user> <db> > sapphira-pre-v0.2.0.sql`
- If the upgrade goes wrong, restore that dump and re-pin to v0.1.13.

## Sequencing vs capellai

Ship sapphira AFTER capellai is verified green in production. Both can
land in the same week — they touch independent databases.

## Out of scope

- v0.3.0 features (richer metadata capture, ticket comments thread) —
  separate plans.
- Tagging `v0.2.0` of the widget itself — done before either host
  upgrade lands.
