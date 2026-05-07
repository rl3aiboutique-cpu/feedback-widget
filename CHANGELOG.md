# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.1] — 2026-05-07

Patch — focus mode for iter, real retry on streaming, comprehensive
telemetry, single-ZIP admin bundle that includes the iter half, and
a hardened "no technical questions" guarantee.

### Added

- **Iter focus mode** — when the user clicks Iterate, the canvas
  hides Compose + the rest of the card feed and renders a new
  `<IterFocusView>` full-height. Sheet expands from ~520px to
  ~800px on lg+ for spec markdown breathing room. Includes a
  collapsible `<IterContextPanel>` with screenshot + original texts
  (collapsed by default, persists across the tab session). Two-
  column body on lg+: focused assumption + spec markdown growing
  live on the left, resolved-assumptions rail on the right.
- **`FeedbackConfig.iterStyle`** = `"focus" | "inline"`. Default
  `"focus"`; hosts that prefer the v0.4.0 inline-in-card flow can
  opt into `"inline"` for back-compat.
- **`stream()` retry-then-fallback** in `gemini.py` — same per-model
  budget the v0.4.0 commit added to `generate()`. 2 retries with
  exponential backoff (1s, 2s) on transient/rate-limited errors,
  then walks the fallback chain. Mid-stream errors stay fatal.
- **`_wrap_provider_error` widened** — detects 5xx/429 by HTTP
  status code first (`exc.code`), then class name, then message
  substring fallback (catches the literal `"503 UNAVAILABLE"`
  message the user reported).
- **`installErrorWrap()`** — public installer for
  `window.error` + `unhandledrejection` ring buffer. Captures
  uncaught exceptions with redacted stacks (4KB cap each).
- **`network_successes` ring buffer** — `networkWrap.ts` now
  records 2xx/3xx responses that took longer than 1s alongside
  the existing failure buffer. Independent ring (30 entries) so
  slow successes can't push out genuine failures.
- **Extended `metadata_bundle`** — adds `errors_tail`,
  `network_successes`, `timing` (TTFB, DOMContentLoaded,
  loadEventEnd, domInteractive), `connection`
  (effectiveType, downlink, rtt, saveData), `page` (title,
  referrer, age_ms), `memory` (Chromium-only), and
  `viewport.scroll_y` / `viewport.document_height` /
  `viewport.visibility_state`.
- **Single admin ZIP** — `bundle.py` now embeds the iter session
  alongside the original feedback when present:
  - `iter/_AI_INSTRUCTIONS.md`, `01_personas.md` … `06_iteration_log.md`
  - `iter/versions/v01.md`, `v02.md`, …, `vN.md` — every persisted
    iteration's `markdown_rendered` verbatim (the user's "última
    iter" requirement)
  - Top-level `README.md` gets an "Iteration summary" block with
    status, rounds, resolved-vs-open assumption counts, completion
    reason, and a pointer to `iter/03_spec.md`.
  - When no iter session exists: writes a single-line
    `iter/STATUS.md` so the bundle still builds cleanly.
- **`GET /mine/{feedback_id}/download`** — submitter-facing endpoint
  returning the same comprehensive ZIP as the admin
  `GET /{feedback_id}/download`. Scoped to the caller's own
  tickets only.
- **`iter_render.py`** — extracted markdown renderers (personas,
  user stories, spec, diagram, assumptions, iteration log) so both
  the iter packager and the admin bundle import from one place.
- **`scrub_questions(items, ...)`** — same forbidden-words/density
  policy as `scrub_assumptions` applied to
  `IterationOutput.unresolved_questions`. Drops/rewrites are
  persisted in `feedback_iter_call.scrub_log` with `q_<idx>` slot
  keys.
- **Frontend forbidden-words filter** — `iter/forbiddenWords.ts`
  + filter inside `IterFocusView` and `InlineIterPane`. Hides any
  assumption whose statement+rationale matches a forbidden token
  the server scrubber missed; emits one
  `console.warn("[iter] hid jargon-leaking assumption", slot_key)`.
  Soft fail; never blocks the round.

### Changed

- **`FEEDBACK_ITER_FORBIDDEN_WORDS` default widened** — now
  covers ~80 terms across networking/API, caching/perf, auth/
  security, storage/data, concurrency, frontend internals, and
  build/deploy. Hosts can shrink via env if a term is genuinely
  needed.
- **`FeedbackPanel.tsx`** width follows focus state via a smooth
  Tailwind `transition-[max-width]` swap (520px ↔ 800px on lg+).
  Branding strip + footer hidden during focus to maximise vertical
  space for the iter pane.
- **`IterWorkspace.tsx`** (admin) imports `RenderedMarkdown`,
  `StreamingSkeleton`, and `modelLatencyHint` from the new
  `iter/markdownView` module instead of duplicating them inline.
- **`build_feedback_bundle(...)`** signature gains a `db` kwarg
  (default `None`). Callers that pass it get the iter section;
  callers that don't (e.g. unit tests, scripts) write the
  no-iter-session marker and skip silently.

### Fixed

- **Streaming iter no longer surfaces 5xx/503 to the user** when
  the same iteration would have succeeded on retry. The v0.4.0
  retry budget existed but only fired on `generate()`; the SSE
  iter path used `stream()`, which had no retry. v0.4.1 closes
  that gap.

## [0.4.0] — 2026-05-07

Single-canvas UX rebuild + iter that converges. The Submit/Mine tab
pattern is gone; the iter modal-over-Sheet is gone; Iterate-with-AI
now runs inline in the expanded ticket card. The iter agent has a
hard turn budget, an explicit `is_complete` signal, server-side
jargon scrubbing, and multiple-choice phrasing — so the user is no
longer trapped in a casino of open-ended questions written in
developer dialect.

### Added

- **`Canvas.tsx`** — single scrolling surface with sticky `<Compose>`
  at top and a vertical card feed below. Replaces the v0.3.x
  `FeedbackPanel` Submit/Mine tab pattern.
- **`Compose.tsx`** — extracted compose form (validation, screenshot,
  submit pipeline). Lives sticky inside the canvas.
- **`iter/InlineIterPane.tsx`** — replaces the fullscreen
  `IterWorkspace` for the submitter flow. Same data hooks, but
  rendered inline inside the expanded ticket card; surfaces a
  one-question-at-a-time disclosure and the "Round N of M" /
  "Mark ready" / "Abandon" controls.
- **`iter_scrubber.py`** — server-side forbidden-word scan against
  every parsed assumption. Quiet-rewrites via the host glossary
  when possible; drops assumptions that are ≥ 50 % jargon. Audit
  log persisted on `feedback_iter_call.scrub_log`.
- **`register_feedback_iter_router(..., iter_glossary=...)`** —
  hosts can pass a `{term: canonical_phrasing}` map that is
  injected into the iter system prompt as a `<glossary>` block
  AND used by the scrubber as a rewrite map.
- **`FEEDBACK_ITER_MAX_TURNS=5`** + **`FEEDBACK_ITER_FORBIDDEN_WORDS`** —
  new settings driving the convergence budget and the scrubber's
  default word list.
- **`is_complete` / `completion_reason`** on `IterationOutput`,
  `FeedbackIterVersion`, and `IterSessionRead`. The model signals
  when the spec is ready; the UI swaps "Run iteration" for
  "Mark ready".
- **`options[]`** on `Assumption` + `IterAssumptionRead` +
  `FeedbackIterAssumption`. When set, `AssumptionCard` renders
  radio buttons instead of an open Confirm/Correct.
- **`Skip` action** on `AssumptionCard`. Reuses the existing
  `irrelevant` enum value with a marker token in `user_response`
  so we don't burn a destructive enum migration.
- **Migration `0006_iter_scrub_completion`** — adds the new columns
  on `feedback_iter_version`, `feedback_iter_assumption`, and
  `feedback_iter_call`. Additive + nullable; downgrade reverses
  cleanly.

### Changed

- **`FeedbackPanel.tsx`** stripped to a thin Sheet shell that mounts
  the `<Canvas>`. Wider on `lg+` (`max-w-2xl xl:max-w-[560px]`) so
  the inline iter pane has room.
- **`MyTicketsPanel.tsx`** shrunk to a one-line shim that re-exports
  `useMyPendingActionCount` (kept for `FeedbackButton` import
  stability). All card-list logic moved into `Canvas`.
- **`AssumptionCard.tsx`** renders multiple-choice radios when the
  assumption ships with `options[]`; falls back to the legacy
  Confirm/Correct/Mark irrelevant trio otherwise.
- **`system_v1.py`** prompt extended with convergence rules
  (`is_complete`/`completion_reason`), phrasing rules
  (prefer 2-4 `options[]` for finite-answer ambiguities), and a
  `<glossary>` block reference.
- **`iter_router.py`** surfaces `remaining_turns` / `max_turns` /
  `is_complete` / `completion_reason` on every session response;
  emits a stable `turn_budget_exhausted` SSE error code when the
  budget is gone, so the frontend can swap UI without string
  matching the message.
- **`iter_service.py`** runs the scrubber after parse and persists
  the audit log. `IterService` now accepts a `glossary=` kwarg.
- **`IterWorkspace.tsx`** kept as the wide 3-tab admin/deep-link view
  (used by `/admin/feedback?iter=…` hosts); the widget itself uses
  the new inline pane.

## [0.2.4] — 2026-04-30

QA pass — fixes the silent-failure findings + type-contract gaps that
the code-reviewer / silent-failure-hunter / architecture agents
flagged on the v0.2.0 → v0.2.3 series.

### Fixed
- **`bundle.py`**: bundle ZIP no longer ships silently-incomplete on
  storage failures. Catches `BotoCoreError` / `ClientError` (was
  `OSError`/`RuntimeError` only — wrong shape for boto3), logs each
  failure, and lists the missing artefacts in the README so the LLM
  reading the bundle knows context is reduced.
- **`service.delete()`**: orphaned S3 objects on cascade now surface a
  single `logger.warning` summary line listing every `bucket/key`
  that survived the row delete — sweep jobs can grep on a stable
  prefix and reconcile.
- **`service.create_comment()`**: when the redactor rewrites
  user-typed comment text (e.g. dotted version strings matching the
  JWT regex), log the before/after lengths so silent rewrites become
  observable. The user's original is still mangled (no diff returned)
  but at least operators see it.
- **`helpers.read_attachments()`**: empty file uploads no longer
  silently disappear from the result list. Now `400 Attachment '<n>'
  is empty` so the user gets a clear signal.
- **`adapter.ts`**: `_getJson` / `_patchJson` / `_deleteJson` /
  `_postJson` now throw a typed `FeedbackApiError(status, path,
  detail, retryAfter)` instead of `Error("PATCH /foo failed (500)
  ...")`. The Retry-After header propagates to all callers, not just
  `submitFeedback`.
- **`CommentThread`**: `onError` branches on `FeedbackApiError`
  status — 429 shows the rate-limit countdown, 401/403 shows a
  re-auth prompt, everything else shows a clean generic message
  instead of `String(err)` leaking server URLs.
- **`FeedbackComment.tenant_id`**: ORM annotation widened from
  `uuid.UUID` to `uuid.UUID | None` to match the migration's
  `nullable=True`. Fixes the type-contract mismatch that would have
  surfaced in single-tenant deployments (sapphira).
- **`CommentThread` heading**: dropped the duplicated
  `text-muted-foreground` so the heading actually renders in the
  foreground colour.

### Added
- **Public exports**: `FeedbackApiError` (so hosts can branch on it
  in their own toast handlers) plus `FeedbackCommentRead`,
  `FeedbackCommentCreatePayload`, `FeedbackCommentListResponse`,
  `FeedbackCommentAuthorRole` types — hosts that want to render the
  comment thread standalone can now type against the public API
  surface instead of importing internal `client/` paths.

## [0.2.3] — 2026-04-30

Frontend-only fix.

### Fixed
- **CommentThread badge**: own messages now render "You" regardless of
  the author's role. Previously an admin posting on a ticket they
  themselves filed saw "Team" on their own message because the badge
  only looked at `author_role`. Now it compares
  `author_user_id` to `useCurrentUser().id` first, falling back to
  the role for messages from the other party. Also added a
  `Submitter` label for admins viewing the user's side of the thread.

## [0.2.2] — 2026-04-30

Additive (no destructive change). Chat-style comment thread on every
ticket. First post-v0.2.0-freeze migration: append-only.

### Added
- **`feedback_comment` table** + Alembic migration 0004. Append-only
  in v0.2.2 — edit / delete arrive in a later minor version.
- **Endpoints**: `GET /feedback/{id}/comments` and
  `POST /feedback/{id}/comments`. Submitter sees + writes on tickets
  they filed; admin sees + writes on any ticket in the tenant.
- **CommentThread component** wired into both `MyTicketsPanel` (the
  user's own ticket detail) and the admin triage `DetailBody`. Polls
  every 30 s so admin replies surface near-live.
- Replaces the v0.2.0-removed magic-link accept/reject loop with an
  in-app conversation.

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
