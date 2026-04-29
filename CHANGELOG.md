# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
