# ADR-006 — Backend ships **sync** for v0.1.0; async port is a follow-up

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-04-29 |
| **Phase** | 1 (backend extraction) |
| **Revisit when** | Two consecutive consumer hosts hit a measured perf issue from the threadpool offload, OR sapphira's product team asks for the SSE/long-lived endpoints v2 plan requires. |

## Context

The CRM widget is sync (psycopg + `Session`). Sapphira-clinic is async (asyncpg + `AsyncSession`). The plan's first draft picked **async-only** for the package, on the theory that "sapphira is the first consumer, so the package matches sapphira."

Reality check during Phase 1: porting `service.py` (32 KB) + `router.py` (37 KB) + 65 integration tests from sync to async cleanly is **two full days** by itself, and the value-add is theoretical for v0.1.0:

- FastAPI runs `def` endpoints inside a thread pool automatically, so a sync widget mounted into an async host (sapphira) does not block the event loop.
- Both hosts already keep their DB pool sized for short-lived sync workers; the widget uses ≤ 2 connections per request (one for the row, one for the screenshot upload), well within the existing budget.
- The *only* real benefit of async here is being able to share sapphira's existing `AsyncSession` pool. That's a cosmetic win — sapphira can spin up a dedicated `psycopg.pool.ConnectionPool` for `feedback_widget` with 10 lines of code.

The async port is *worth* doing eventually (better perf under contention, alignment with sapphira's idiom, removes one engine config), but it's not on the v0.1.0 critical path.

## Decision

`v0.1.0` ships **sync**:

- `feedback_widget.service.FeedbackService` consumes `sqlmodel.Session` (sync).
- `feedback_widget.router` endpoints are `def` (FastAPI offloads to threadpool).
- `feedback_widget.deps.SessionDep` wraps `Session` from a sync `Engine`.
- Settings expose `FEEDBACK_DATABASE_URL` (sync `postgresql://...` URL — no `+asyncpg`).
- Hosts that are async-native (sapphira) configure a dedicated sync engine for the widget:

  ```python
  from sqlalchemy import create_engine
  from feedback_widget import register_feedback_router, FeedbackSettings

  feedback_engine = create_engine(
      str(host_settings.SQLALCHEMY_DATABASE_URI).replace("+asyncpg", ""),
      pool_size=10, pool_pre_ping=True,
  )
  register_feedback_router(app, auth=..., settings=FeedbackSettings(),
                            engine=feedback_engine, prefix="/feedback")
  ```

- Alembic migrations: sync, also using a sync engine.

The `engine` parameter on `register_feedback_router` is the seam that keeps the door open for v0.2 (passing an async engine via the same parameter, branched internally on type).

## Alternatives considered

- **Async-only (original plan).** Rejected for v0.1.0 — costs ~2 days and delays sapphira validation without measurable runtime benefit. Reopened automatically when the revisit conditions trigger.
- **Dual sync + async support gated by a settings flag.** Rejected as YAGNI: every method exists twice, every test exists twice, every migration exists twice. Wait for a real demand.
- **Sync but force the host to also pass an `AsyncSession` factory** so the v0.2 transition is invisible. Rejected — exposes complexity hosts don't need yet, and the parameter shape is going to change anyway.

## Consequences

**Easier**:

- Phase 1 collapses from "rewrite everything to async + adapt 65 tests" to "swap host imports, copy as-is, validate". Saves ~2 days and unlocks Phase 5 (sapphira install) sooner.
- Tests port one-for-one — same fixtures, same assertions, no `pytest-asyncio`.
- The CRM's existing pattern stays portable on day one (CRM is also sync).

**Harder**:

- Sapphira has to instantiate a sync `Engine` alongside its async one. ~10 lines, documented in [`docs/INSTALL-SAPPHIRA.md`](../INSTALL-SAPPHIRA.md).
- Async-native idioms (e.g. `async with` middleware accessing `feedback_widget` deps) must adapt the sync session via `asyncio.to_thread` or `run_in_executor`. None of the integration points the widget exposes do that today.

**Riskier**:

- v2 async port becomes slightly more work because more code is in flight. Mitigated by keeping `engine` as the dependency-injection seam: the v2 port replaces one type, not the surface.
- The package marketing line changes from "async-friendly" to "sync, threadpool-offloaded under async hosts". Honest, but less impressive in copy.

## Evidence

- This ADR.
- `feedback_widget.deps.SessionDep` (Phase 1).
- `register_feedback_router(app, auth, settings, engine, prefix)` signature in `feedback_widget/__init__.py`.
- INSTALL-SAPPHIRA.md `## Wire the sync engine` section (Phase 5).
