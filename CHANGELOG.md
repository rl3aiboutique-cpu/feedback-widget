# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] — 2026-04-30

Additive (no schema change). Submitter-facing ticket preview.

### Added
- **Inline ticket preview** in `MyTicketsPanel`: clicking a row expands
  it to show description, expected outcome, admin triage note, and
  attachments with image thumbnails. The full ticket detail was already
  in the `GET /feedback/mine` response — the panel now actually renders
  it.
- **Signed attachment URLs on `/feedback/mine`** so the submitter can
  preview their own screenshots and uploads without admin role.

## [0.2.0] — 2026-04-30

UX-first simplification + multi-file attachments. **Breaking** — the
schema, the wire shape, and the admin email lifecycle all changed.
v0.1.x clients should drop their old data (this was a beta) and re-pin.

### Added
- **Multi-file attachments**: hosts can now drop or pick up to 5 files
  (≤10 MB each) per submission alongside the auto-captured screenshot.
  Allowed types: PNG / JPEG / GIF / WebP / PDF / plain text / markdown
  / JSON / .log / .ndjson. Frontend validates count + size + MIME +
  extension; backend re-validates with magic-byte sniffing.
- **`expected_outcome` column** on `feedback`: the form now asks
  "How should it work?" as a separate optional field next to "What's
  happening?" so triage gets diagnosis and proposal apart.
- **`filename` column** on `feedback_attachment` for the user-uploaded
  files; surfaced in the LLM-handoff ZIP as `attachments/<name>`.

### Changed
- **Form simplified to 6 types × 3 uniform fields**: `bug`, `ui`,
  `performance`, `new_feature`, `extend_feature`, `other`. Every type
  asks the same three questions (title, description, expected outcome).
  Picking a type only changes triage routing — never the form layout.

### Removed (BREAKING)
- **Persona, linked user stories, parent-ticket cascade, follow-up
  email, consent toggle, type-specific dynamic fields (`type_fields`
  JSONB)**. Submissions still carry redacted page metadata; no
  user-facing checkbox is required.
- **Magic-link accept/reject email flow**: status-transition emails
  are informational from now on. Endpoints `POST /feedback/action/{token}`
  removed, along with the `accepted_by_user` / `rejected_by_user`
  status values, the `acceptance_token` / `acceptance_token_expires_at`
  columns, and the `parent_feedback_id` column.
- **Autocomplete endpoints** `GET /feedback/personas` and
  `GET /feedback/user-stories` (the form fields they fed are gone).
- **Frontend `FeedbackActionPage`** (the public landing page used by
  magic-link emails) — removed from `packages/feedback-frontend/src/public/`
  and from the public export map.

### Migration
- `alembic upgrade head` applies `0003_simplify_to_v0_2_0`: deletes
  rows whose enum values are about to disappear, drops the deprecated
  columns, recreates the three Postgres enums with the new value sets,
  and adds `expected_outcome` + `attachment.filename`.
- Downgrade is **not supported** — restore from a backup taken before
  the migration if you need the old schema back.

### Schema lock-in
After v0.2.0 the schema is frozen. Future destructive changes require
non-destructive migrations with backwards compatibility — no more
clean breaks.

## [0.1.0] — 2026-04-29

First installable version of the package. Tagged locally; push to
`https://github.com/rl3aiboutique-cpu/feedback-widget.git` via:

```bash
git push -u origin main
git push origin v0.1.0
```

The CI's `release.yml` workflow attaches the frontend tarball
(`rl3-feedback-widget-0.1.0.tgz`) to the GitHub release.

### Added
- **Phase 0 — Bootstrap**: pnpm + uv workspaces, pre-commit hooks
  (gitleaks/ruff/biome), GitHub Actions (`backend.yml`, `frontend.yml`,
  `release.yml`, `sapphira-smoke.yml`), Makefile with phased targets,
  README quickstart.
- **Phase 1 — Backend extraction**: `rl3-feedback-widget` Python
  package under `packages/feedback-backend/`. Sync (per ADR-006), with
  host auth/tenant injected via `FeedbackAuthAdapter` Protocol. Includes:
  models / schemas / service / router (factory) / redaction / bundle /
  exceptions / helpers / dto / settings / S3 storage / SMTP mailer /
  Jinja templates / Alembic chain (independent `version_table`) / CLI
  (`migrate`/`version`/`check-config`).
- **Phase 2 — Frontend extraction**: `@rl3/feedback-widget` JS package
  under `packages/feedback-frontend/`. Vendors 10 shadcn primitives —
  pays CRM ADR-042's "29 cross-boundary imports" debt (regression
  check: 0 hits on `from "@/"`). `FeedbackProvider` accepts a
  `bindings` prop the host supplies; the adapter speaks raw fetch with
  the host's apiBaseUrl + getCsrfToken.
- **Phase 3 — Sandbox host**: minimal FastAPI + Vite app under
  `apps/sandbox-host/` that mounts the widget with header-driven
  fake auth. Doubles as demo and source of OpenAPI for SDK regen.
  `make sandbox-up` brings everything up.
- **Phase 4 — Tooling**: `docs/INTEGRATION-GUIDE.md`,
  `docs/INSTALL-SAPPHIRA.md`, `docs/INSTALL-CRM.md`, ADRs 001 / 002 /
  006. `release.yml` produces the frontend tarball as the primary
  install artefact.
- **Phase 5 — Sapphira install**: `feat/feedback-widget` branch in
  `sapphira-clinic` adds the package + adapter + bindings + 3 route
  wrappers + MinIO/MailHog services. ~10 files, ~150 net additions.
- **Phase 6 — Public repo**: remote `origin` set to
  `https://github.com/rl3aiboutique-cpu/feedback-widget.git`; tag
  `v0.1.0` ready to push.

### Architecture decisions

ADR-006 deviates from the original plan's "async-only backend":
shipping sync for v0.1.0 saved ~2 days of porting effort with no
runtime impact (sync `def` endpoints in FastAPI offload to a thread
pool inside async hosts). Async port is a follow-up gated on a
measured perf signal.

### Follow-ups carried into v0.2

- 65 CRM integration tests are not yet adapted to the package's
  fixture shape. The sandbox host's Playwright suite will close the
  functional gap before v0.2.
- Async port of `service.py` + `router.py` (ADR-006 follow-up).
- CRM migration (Phase 5b) — `docs/INSTALL-CRM.md` covers the dual
  Alembic chain handover via `alembic stamp head`.
