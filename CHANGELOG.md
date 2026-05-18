# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.1] — 2026-05-18

### Fixed

- **`__version__` drift**: el símbolo `feedback_widget.__version__`
  estaba hardcoded a `"1.0.0"` en `__init__.py` y no se bumpeó durante
  el release de v1.1.0, así que los consumidores que leían el atributo
  veían 1.0.0 mientras que la metadata del paquete reportaba 1.1.0
  correctamente. Ahora se deriva en runtime con
  `importlib.metadata.version("rl3-feedback-widget")` — un solo source
  of truth (`pyproject.toml`), sin posibilidad de drift en futuros
  releases.

## [1.1.0] — 2026-05-17

### Added

- **Sprint D — Admin `ChatSessionViewer`**: nuevo componente
  `packages/feedback-frontend/src/admin/ChatSessionViewer.tsx` que
  consume `GET /api/v1/feedback/{id}/chat` (endpoint Sprint C) y
  renderiza synthesis + transcript + LLM call audit trail dentro del
  triage drawer. Cierra el gap visible que dejó la eliminación de
  `IterSessionsSection` en Sprint C — admin recupera la visibilidad
  de la conversación que produjo cada ticket chat-first.
- **Sprint D — `user_agent` en `AutoContext` + prompt LLM**: el
  campo se captura, valida y propaga end-to-end al modelo. El
  frontend (`useFeedbackChat._buildAutoContext`) lo emite con
  `navigator.userAgent.slice(0, 512)`, el schema pydantic
  (`chat_schemas.AutoContext.user_agent`) lo acepta, y
  `_format_auto_context_block` lo incluye en el bloque JSON que ve
  el LLM en cada chat session.

### Fixed

- **Sprint D regresión bloqueante**: `user_agent` se perdía
  silenciosamente en el camino al LLM. La schema `AutoContext`
  declarada con `model_config = ConfigDict(extra="ignore")` dropeaba
  el campo que el FE sí enviaba, así que el grilling perdía el
  contexto de browser/OS. La regresión se introdujo en Sprint B al
  desestructurar el bloque legacy `technical_metadata`. Cobertura
  añadida en `tests/integration/test_chat_confirm_parity.py::
  test_confirm_persists_user_agent_from_auto_context`.

### Changed — **BREAKING**

- **ZIP handoff layout**: la clave `raw/network_tail.json` pasa a
  llamarse `raw/network_errors_tail.json` en
  `bundle.build_feedback_bundle`. Hosts externos que parseen el ZIP
  por nombre de archivo deben actualizar su pipeline. La intención
  es alinear el nombre con el campo de `metadata_bundle`/`AutoContext`
  que el frontend usa post-Sprint-B (`network_errors_tail`).

## [1.0.0] — 2026-05-14

**Chat-first redesign.** The widget no longer ships a form. The
floating launcher opens a chat sheet that captures feedback through
a conversational flow with an LLM. Synthesis (title + summary +
status + type + sentiment) is drafted live as the user types and
the user confirms or abandons. The whole submitter surface is one
screen — the legacy Compose / Canvas / FeedbackPanel /
MyTicketsPanel components are removed.

This is a **breaking** release on the frontend public surface. The
backend keeps the legacy v0.x endpoints (`/feedback`, `/iterate`)
mounted alongside the new `/chat/*` family — hosts that still call
the legacy endpoints continue to work without changes, but the
shipped React components for those flows are gone.

See [ADR-007](./docs/adr/007-chat-first-redesign.md) for the
rationale and the 22 grilled design decisions that anchored the
redesign.

### Added

- **`POST /feedback/chat/sessions`** — opens a chat session bound
  to the calling user (single multi-tenant feedback row gets
  created lazily when the user confirms).
- **`POST /feedback/chat/sessions/{sid}/messages`** — SSE stream
  endpoint. Every user turn streams back assistant tokens plus a
  running `synthesis` event payload (title, summary, status, type,
  sentiment, confidence).
- **`POST /feedback/chat/sessions/{sid}/confirm`** — promotes the
  session into a real feedback row. Idempotent (Idempotency-Key
  header required).
- **`POST /feedback/chat/sessions/{sid}/abandon`** — soft-deletes
  the session. Reversible until garbage collection.
- **`POST /feedback/chat/voice/transcribe`** — backend-proxied
  Whisper transcription. Audio never reaches OpenAI from the
  browser; the widget POSTs the blob, the backend forwards with
  the server-side API key.
- **`FeedbackChatSheet`, `Composer`, `ChatTimeline`,
  `SynthesisCard`, `CapturePicker`, `FeedbackTabs`, `MineFeedTab`,
  `FooterActions`, `StatusPill`, `TicketDetail`, `VoiceRecorder`,
  `TranscriptionPreview`** — new React components composing the
  chat-first submitter surface.
- **`useFeedbackChat`, `useChatRunStream`, `useVoiceCapture`** —
  hooks the chat sheet builds on. Hosts that want to roll their
  own surface can import the building blocks and skip
  `FeedbackButton` entirely.
- **`SubmitVoiceRecording` capability** on the host adapter — lets
  hosts route Whisper traffic through their own auth layer if the
  default backend proxy does not fit.

### Changed

- **Floating launcher (`FeedbackButton`)** — opens the chat sheet
  instead of the legacy form. The badge logic
  (`useMyPendingActionCount`) moved out of the removed
  `MyTicketsPanel` shim into `hooks/useMyPendingActionCount.ts`.
- **Admin Triage page (`FeedbackTriagePage`)** — still consumes
  the iter HTTP client (`listIterSessionsForFeedback`,
  `getIterPackage`) but the embedded submitter iter UI is gone.
  Admin "Refinar" is planned to reuse the chat sheet in a
  follow-up slice (post-v1.0.0).

### Removed

- **Legacy submitter React components (BREAKING):** `Compose`,
  `Canvas`, `FeedbackPanel`, `MyTicketsPanel`, `forms/FeedbackForm`,
  `forms/AttachmentsField`, `forms/types`, `IterWorkspace`,
  `IterWorkspace.lazy`, `InlineIterPane`, `IterFocusView`,
  `IterFocusShell`, `EditableSpecPanel`, `SpecTabsPanel`,
  `SpecSectionCard`, `DiagramPanel`, `AssumptionCard`,
  `IterContextPanel`, `ContextDialog`, `CopilotChatPanel`,
  `FallbackToast`, `iter/ChatBubble`, `chat/PreviousConversations`,
  `chat/useMyConversations`, plus the iter-local helpers
  `markdownView`, `forbiddenWords`, `useIterRunStream`,
  `useIterRunMeta`, `useChatTimeline`, `specSectionState`.
- **Public exports removed (BREAKING):** `IterWorkspace`,
  `IterWorkspaceProps`. The `client/iter` HTTP helpers and the
  iter type re-exports stay — admin UIs and custom integrations
  still use them.

### Migration notes

Hosts on v0.x:

1. Pull the new release.
2. No backend code change required — `register_feedback_router`
   keeps mounting the legacy endpoints. `register_feedback_chat_router`
   is the new mount point for the chat-first surface.
3. Remove any direct imports of the deleted components above. The
   floating launcher (`<FeedbackButton/>`) does not need code
   changes — it now opens the chat sheet automatically.
4. Hosts that mounted `<IterWorkspace/>` directly: the React
   surface is gone. The HTTP client (`startIterSession`,
   `listIterSessionsForFeedback`, etc.) is preserved so internal
   admin tooling keeps working; the public iter submitter UI is
   replaced by the chat sheet.
5. Optional: wire `SubmitVoiceRecording` on your adapter to route
   transcription through your own backend instead of the bundled
   `/feedback/chat/voice/transcribe` proxy.

### Deferred

- Backend `iter_*.py` modules stay on disk and stay registered —
  legacy admin Iter flows might still hit them. A separate
  post-v1.0.0 slice removes them once admin migrates to the chat
  sheet.

## [0.4.6] — 2026-05-07

Same-day patch on top of v0.4.5. v0.4.5 verified the early-stream
fallback walks correctly, but the user-visible test exposed a second
problem: with all three models in the chain on the Flash family,
when Google's Flash infra saturated they all 503'd within a few
seconds of each other and the chain failed visibly. v0.4.6 reshapes
the chain to mix model families and surfaces the swap to the user.

### Added

- **`SSEEventProviderFallback`.** Backend emits a `provider_fallback`
  SSE event the first time the LLM provider's internal chain walks
  to a different model mid-run. Frontend renders a transient amber
  banner ("Cambio de modelo en vuelo… saturación temporal en X;
  tu iteración la está sirviendo Y como respaldo") so the user knows
  why output tone or latency suddenly shifts instead of wondering
  whether the system is broken.
- **`current_model` property on the LLM provider protocol.** Lets
  the service watch for fallback walks between chunks without
  reaching into provider internals. Implemented on Gemini (returns
  the live `_model`), Claude / OpenAI / Fake (return their fixed
  model id since they don't carry chains today).

### Changed

- **Default chain now mixes families.** Primary is
  `gemini-flash-latest` — stable Flash on paid-tier infra with a
  lower 503 surface than the Preview models. Fallback is
  `gemma-3-12b-it`, on a different infrastructure family from
  Flash, so a Google Flash outage no longer cascades through the
  whole chain. Today's evidence: a flash-family-only chain still
  failed because the entire family saturated at once. The user
  asked for medium / small models, not large — Gemma 3 12B is the
  middle of the Gemma 3 line and finishes streaming comfortably
  inside the iter timeout.

## [0.4.5] — 2026-05-07

Same-day patch on top of v0.4.4. User feedback after one round of real
iter use against the new full-screen view: *"sigue sin ser todo lo
amigable que necesitamos. Tengo que hacer scroll, el contenido original
debería auto-fold cuando se está generando el spec. Volvió a petar 503
UNAVAILABLE… si da un error tiene que hacer fallback. Con flash 3.1
estoy perfecto, prioriza modelos medios o pequeños no grandes."*

### Fixed

- **`gemini.py` stream fallback chain now walks on early-stream errors,
  not just on setup errors.** v0.4.4 had a logic gap: if the SDK
  returned the stream iterator successfully but raised 503 on the first
  chunk read (the actual production failure mode), the code treated it
  as fatal "mid-flight after partial output" and refused to fall back —
  even though no text had reached the user yet. v0.4.5 distinguishes
  early-stream errors (no chunks yielded downstream → safe to walk
  chain) from true mid-flight errors (text already on the SSE wire →
  truly unrecoverable). The user's reproducible 503 storm now rolls
  over to the next model in the chain instead of surfacing.
- **Default model + fallback chain switched to all-Flash tier.** Primary
  is now `gemini-3.1-flash-lite-preview` (user picked it explicitly,
  *"con flash 3.1 estoy perfecto"*). Fallback chain is
  `gemini-flash-latest,gemini-flash-lite-latest`. Gemma 3/4 dropped
  from the chain because the user wants medium/small fast models, not
  the larger checkpoints the v0.4.4 chain favoured.

### Changed

- **`<IterContextPanel>` auto-collapses on idle→running transition.**
  The original feedback / screenshot block now folds itself when the
  AI starts streaming so the spec gets the full vertical real estate.
  Manual control survives — the user can still click to re-open
  mid-stream — we only nudge the closed state on the rising edge.

### Pricing table

- Added `gemini-3.1-flash-lite-preview` (free on AI Studio at writing)
  and `gemini-3-flash-preview` (track as Flash) to the
  `_GEMINI_PRICES_USD_PER_M` table so cost reporting doesn't surface a
  KeyError when the new primary serves a turn.

## [0.4.4] — 2026-05-07

User feedback: *"no puedo editar las tarjetas… no puedo editar el texto del md… super anti user friendly mucho scroll… la primera iteración tiene que hacerse automática… tiene que ver más pantalla completa"* + a 503 UNAVAILABLE that retry didn't catch + CI failing on mypy strict in `bundle.py`. v0.4.4 ships all four fixes plus a small version-pill for ops visibility.

### Added

- **Auto-fire of v1** — clicking "Iterate" on a feedback card now starts the first AI iteration automatically. Banner *"Iniciando primera ronda… [Cancelar]"* lets the user bail before the turn is consumed (cancel calls `abandonMutation` so `ITER_MAX_TURNS` isn't burned).
- **`EditableSpecPanel`** — extracted from `IterWorkspace`'s `WorkingDocumentPanel`, now shared between admin view and submitter focus view. Submitter clicks `[✎ Editar]` on the spec markdown → textarea swap → `[💾 Guardar]` writes via the existing `editIterVersionMarkdown` mutation. Disabled during streaming.
- **Sticky assumptions inbox** — `❓ Preguntas pendientes (N)` strip stays at the top of the spec area while the user scrolls the doc body. When all assumptions are resolved, swaps to a green `✅ Todo respondido — listo para iterar de nuevo o marcar como listo.` strip.
- **Inline streaming status copy** — the skeleton now opens with *"Borrador {N} de hasta {M} — el AI está escribiendo {sección}…"* instead of the generic "AI is drafting your spec", so the user sees concrete progress against the turn budget.
- **Auto-scroll-to-top on stream done** — when a fresh version lands, the spec area smooth-scrolls to the top so the user sees the new content rather than wherever they were.
- **`<VersionPill>`** — discreet `fe v0.4.4 · be v0.4.4` text at the bottom of the panel. Click to expand for API base URL + frontend/backend version mismatch warning. Visible whenever the panel is open and not in focus mode. Backend version comes from the existing `GET /health` endpoint; no new endpoint needed.

### Changed

- **Focus mode is full-viewport** during iter. The Sheet expands to `w-screen max-w-none` on `sm+` (mobile already was full-width). The picker doesn't matter during iter (the ticket was already submitted in the compose tab), so we can safely cover the host. `← Volver` in the focus header is the single-button-back-to-feed path.
- **Sheet header (`RL3 Feedback` / "Tell us what's happening…") is hidden during focus mode** — the focus view has its own header with breadcrumb + round counter, and the duplicate title was wasting vertical space.
- **`transition-[max-width]` → `transition-all`** on the Sheet so the drawer→full-screen swap feels smooth.
- **`IterWorkspace.tsx` 73 lines lighter** — the `WorkingDocumentPanel` extraction removes a duplicate edit-textarea implementation; the admin view imports `EditableSpecPanel` instead.

### Fixed

- **CI: `bundle.py` mypy strict 10 errors** — added `feedback_widget.bundle` to the existing SQLModel-overrides group in `pyproject.toml`. Same posture as the other iter modules that use the dynamic `.where(Col == val)` / `.order_by(Col.desc())` SQLModel idiom that mypy strict can't infer through. PR #4's `lint-typecheck-test` job goes from FAILURE → SUCCESS.

## [0.4.3] — 2026-05-07

User feedback: *"mira los tickets anteriores si los pondría en otra
pestaña, demasiado ruido visual"*. The single-canvas pattern from
v0.4.0 (sticky compose at top + card feed below) turned out to be
too cluttered — the feed of older tickets distracted from drafting
a new one.

### Changed

- **`Canvas.tsx`** re-introduces a tab switcher at the top of the
  panel: `✎ Nuevo feedback` and `📋 Mis feedbacks (N)`. The `Mis`
  tab badge shows the count of "done" tickets in primary color
  (so the user notices replies) or the total count in muted grey
  when nothing is pending. Default tab is `Nuevo`. After a
  successful submit the canvas auto-flips to `Mis` so the user
  sees their fresh card without clicking — same v0.3.x semantic.
- These tabs are NOT a return to v0.3.x's modal-over-Sheet pain.
  The iter focus mode (v0.4.1) still takes over the whole panel
  for iteration; tabs only gate the compose-vs-browse view at the
  top level.
- Compose is no longer sticky-pinned at the top of a long scroll —
  when `tab === "compose"` it owns the viewport; when
  `tab === "mine"` it's unmounted entirely. Cleaner mental model,
  no scroll competition.

## [0.4.2] — 2026-05-07

Patch on top of v0.4.1 driven by three independent subagent reviews
(code review, silent-failure hunt, UX evaluation) plus a real
browser test against capellai-ai-crm. Fixes findings in priority
order: crash risks → data correctness → UX papercuts.

### Fixed

- **`bundle.py` iter section** now wraps each render step (session
  lookup, artifact render, summary count) in its own try/except
  with `logger.exception` + a flagged `iter/STATUS.md` marker.
  Previously a transient DB blip on the iter side could 500 the
  ENTIRE bundle including the feedback half. Each section now
  fails independently and visibly.
- **`bundle.py` assumption-count for ITERATING sessions** —
  `iter_session.current_iteration_id` can legitimately be None
  during a race; queries now resolve "latest version id" from the
  version table directly. Replaced the
  `select(...).scalars().all().__len__()` count idiom with
  `select(func.count())`.
- **`gemini.py` retry loops** now re-raise `asyncio.CancelledError`
  before catching `BaseException`. SSE disconnects now propagate
  cleanly through structured concurrency instead of being wrapped
  as fatal LLM errors. Mid-stream errors get a `logger.warning`
  before being raised so ops sees the abort.
- **`gemini.py:_resolve_model` error message** referenced the
  non-existent `gemma-4-26b-a4b-it`; now suggests
  `gemini-flash-lite-latest` + `gemini-flash-latest` as fallback,
  matching the v0.4.1 default chain.
- **`forbiddenWords.ts` empty-list guard** — `_buildRegex([])`
  used to produce a `(?:)` regex that matched at every boundary,
  silently hiding every assumption. Now returns a never-matching
  regex; pathological inputs caught with try/catch and the same
  safe fallback.

### Changed (UX papercuts)

- **`forbiddenWords.ts` list tightened** from ~80 words to ~30 by
  dropping ambiguous tokens (state, index, join, action, service,
  controller, hook, ref, prop, build, deploy, package, library,
  module, queue, image, streaming, polling, etc.) that have
  legitimate non-technical meanings. The server-side scrubber
  stays as the broader enforcement layer; the frontend filter is
  defense-in-depth and shouldn't false-positive on plain English.
- **`IterFocusView` no longer auto-exits on `finalized`** — the
  package download CTA now persists in a sticky emerald banner
  inside the focus pane until the user explicitly clicks
  "← Volver". 1.2s wasn't enough time to read + click; was the
  biggest UX risk surfaced in review.
- **`IterFocusView` Resueltas rail closed by default** with a
  pill-badge count instead of always-open. During deep work the
  open ✅ list competed with the focused question.
- **`IterContextPanel` force-opens on first session entry**
  (`!sess?.current_iteration_id`) so the user sees their
  screenshot at least once before it tucks itself away.
- **`IterFocusView` redundant Close button removed.** Header
  "← Volver" is the single exit semantic ("I'm leaving this view,
  my work stays running"); footer "Abandon" is the explicit kill.
  Two buttons doing the same thing made non-technical users worry
  Close was destructive.
- **`IterFocusView` session GET errors surface as a destructive
  banner** instead of a silent permanent loading state.
- **`FeedbackPanel` focus width** capped at 720px on `lg`
  (1024–1279px) so the host has 304px+ for the element picker;
  only expands to 800px on `xl` (≥1280px).

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
