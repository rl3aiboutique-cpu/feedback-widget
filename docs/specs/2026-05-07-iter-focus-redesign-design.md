# Iter Focus View — UX Redesign (v0.5.0)

**Status:** Approved (Phase 1 + Phase 2). Phase 3 execution pending user validation of v0.4.6.
**Date:** 2026-05-07
**Author / driver:** rl3 boutique (collaborative design with user)
**Versioning:** No version bump until Phase 3 starts. Final merge tags v0.5.0.

---

## 1. Context

The iter focus view (the canvas where a non-technical user iterates with the AI agent on a feedback ticket) has visible UX problems after one full real-use session against v0.4.4–v0.4.6:

- Content lives in a narrow left column; most of the viewport is dead space.
- Spec markdown renders as one long vertical dump despite the existing SSE `section` events.
- Status banners are static strings; the model-fallback banner names a model that doesn't update.
- The "20–60s typical" hint is permanent — no completion state.
- 10 pending questions hide behind a `+ N más` disclosure; navigation is painful.
- Action bar and feedback input float disconnected at the bottom.

This spec restructures the focus view as a senior frontend / UX pass. Three blocks: fluid layout, progressive section rendering, live model state. **Zero absolute pixel values** for sizing, spacing, font-size or breakpoints — only borders and 1px hairlines exempt. Container queries over media queries.

The product purpose this view serves stays the same: **a senior-analyst AI iterating with a non-technical user to extract everything a developer needs to build the feature**.

## 2. Decisions baked in (locked in Phase 1 Q&A)

| # | Decision | Source |
|---|---|---|
| Q1 | Five spec-section cards = the five H2s the server already detects (`Personas`, `User Stories`, `Spec`, `Diagram`, `Assumptions`). Sub-personas live inside the Personas card, not as separate cards. | locked |
| Q2 | **Sidebar (left):** all 10 pending questions as compact cards (SCOPE/OPEN tag, %, truncated title, active highlighted) + collapsible "Resueltas" with counter beneath. No TOC. No rounds history. **Main (center):** active question + spec stream. **Rail (right):** run metadata only — model badge, elapsed timer, round indicator, contextual hint, "Contexto original" collapsible, fallback-toast landing zone. | locked |
| Q3 | Container query measured against the focus pane's **own div**, not Sheet, not viewport. More portable; semantically correct. | locked |
| Q4 | Backend emits a new `provider_active {model}` SSE event at stream start AND after each fallback walk. Badge is a pure render of the latest event — zero inference. Defensive bootstrap from `session.current_primary_model_id` if event hasn't arrived (cold-start race). | locked |
| Q5 | Fallback toast: auto-dismiss 6 s with pause-on-hover; badge persists; close button visible; `Esc` closes; `aria-live="polite"`. **New dependency:** `@radix-ui/react-toast` (~3 KB gz, headless accessible primitive, idiomatic in shadcn ecosystem). | locked |
| Q6 | Keyboard scope: sidebar focus group only. `↑`/`↓` cycle; `Enter` activates; `Home`/`End` jump to extremes; `Tab` exits. No global hijack of arrows or `j`/`k`. | locked |
| Q7 | Native 1px borders stay (`border` class). The no-px rule applies to layout / spacing / sizing / typography / breakpoints — not hairlines. | locked |
| Q8 | Out of scope: `Mis feedbacks` list, `Nuevo feedback` form, admin `IterWorkspace`, host Sheet chrome, `VersionPill` internals. `IterContextPanel` internals stay (v0.4.5 covers auto-collapse already); only consumes new prop signature if Block A's reflow forces a tweak — flag and stop before touching. | locked |
| Q9 | Versioning: stays on v0.4.6 until (a) v0.4.6 validated, (b) plan approved, (c) Phase 3 starts. Final merge tags v0.5.0. | locked |

## 3. Durability invariants (non-negotiable, cross-block)

This redesign cannot lose user-generated content from any v0.4.x session. Concrete rules every block must respect:

- **DB:** no `DROP COLUMN`, no physical `DELETE`, no destructive migration on `feedback`, `feedback_attachment`, `feedback_iter_session`, `feedback_iter_version`, `feedback_iter_assumption`, `feedback_iter_call`. Soft-delete only via `deleted_at`. Migrations strictly additive.
- **MinIO:** no bucket renames, no key migrations that would break already-issued pre-signed URLs (downloads in clients, package ZIPs sent in emails, screenshot links).
- **Cross-version compat:** any v0.4.x `IterSession` / `IterVersion` / package ZIP must remain readable + downloadable in v0.5.x.
- **Backups before schema touch:** I verify schema state before any migration command and surface risk to the user before applying.

If a Phase 3 task accidentally bumps into one of these rules, **stop and surface to the user** before proceeding.

---

## 4. Block A — Fluid layout

### 4.1 Goal

A 3-column CSS Grid that breathes with the focus pane's container width via container queries, not viewport breakpoints. Reflows at three logical container widths (narrow, mid, wide) without magic pixel thresholds.

### 4.2 Reflow logic (plain language)

- **Wide container** (~loosely ≥ 80ch worth of focus-pane width): three columns visible — sidebar / main / rail. Approximate proportions `minmax(0, 1fr) minmax(0, 2.4fr) minmax(0, 1.1fr)` (judgment, tunable).
- **Mid container**: rail folds into a horizontal strip pinned to the top of main; sidebar stays as a column.
- **Narrow container**: sidebar collapses to a dropdown/drawer trigger placed at the top of main; rail folds into a collapsible accordion above main.

Container measure target: `IterFocusShell`'s own root `<div>`, not Sheet, not viewport. Tailwind v4 native `@container` utilities (no plugin needed).

### 4.3 Files touched

| Action | Path | Reason |
|---|---|---|
| MODIFY | `packages/feedback-frontend/src/iter/IterFocusView.tsx` | Replace flex + breakpoint classes with grid + container query; extract child components. |
| CREATE | `packages/feedback-frontend/src/iter/IterFocusShell.tsx` | Pure layout: grid container + container query host + reflow rules. |
| CREATE | `packages/feedback-frontend/src/iter/IterPendingSidebar.tsx` | Left sidebar: compact card list of 10 questions + "Resueltas" collapsible. Owns sidebar keyboard nav. |
| CREATE | `packages/feedback-frontend/src/iter/IterMetadataRail.tsx` | Right rail with named slots: `<modelBadgeSlot>`, `<elapsedTimerSlot>`, `<roundSlot>`, `<hintSlot>`, `<contextoSlot>`, `<toastLandingSlot>`. Today renders empty placeholders + reuses `IterContextPanel`. Block C fills the slots. |
| MODIFY (conditional) | `packages/feedback-frontend/src/iter/IterContextPanel.tsx` | Only if container-query target reveals a needed prop tweak. Flag and stop before touching. |
| MODIFY (potential) | `packages/feedback-frontend/src/styles.css` | Likely none. If a CSS variable is needed for the grid template's column ratios it lives here, not as inline magic. |

### 4.4 New components

- **`IterFocusShell`** — pure layout. Owns the `@container` parent and the grid template. No business logic.
- **`IterPendingSidebar`** — full pending-questions list (no `+ N más`), with active-question highlight driven by shared parent state. Owns keyboard nav within its focus group.
- **`IterMetadataRail`** — named-slot container, no business logic. Block C fills the slots.

### 4.5 Risks

1. **Sticky sidebar overflow.** If 10-question list is taller than viewport, naive `position: sticky` on the whole sidebar doesn't help — it scrolls. Mitigation: nested `overflow-auto` inside sidebar; sticky only on its top header strip ("Preguntas pendientes" + count).
2. **Sheet width interaction.** Today `FeedbackPanel.tsx` forces `w-screen sm:max-w-none` in focus mode. Container queries on the focus pane will see effectively viewport width — that is what we want. Sheet logic stays untouched (Q8 scope guard). But: if we ever embed the focus view OUTSIDE the Sheet later (admin tile, dashboard), the container query lets us reflow without Sheet changes — that upside is the reason Q3 chose target (a).
3. **Active-question state lift.** Today `openAssumptions[0]` is implicitly the focused card. With the new sidebar, selection is explicit. Need shared state for `selectedAssumptionId` (React context inside the focus view, or prop drill from `IterFocusView`). Pick prop drill — only 2 levels deep.
4. **`grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1.1fr)]` arbitrary value.** Legal under no-px rule (no `px`, no breakpoints). Just verbose. Optionally promote to a CSS variable in `styles.css`.

### 4.6 Execution order within Block A

1. Extract `IterPendingSidebar`, `IterMetadataRail`, `IterFocusShell` skeletons. Wrap existing JSX, no behavior change yet.
2. Move full pending-questions list (no `+ N más`) into `IterPendingSidebar`. The focused card stays in main; sidebar selects which one is focused.
3. Move `IterContextPanel` from above-the-body into `IterMetadataRail`'s `contextoSlot`.
4. Replace flex with CSS Grid + `@container` query in `IterFocusShell`. Implement wide / mid / narrow reflow.
5. Add typography `clamp()` to relevant headings (h1/h2 in the focus pane chrome — not the spec markdown, that's Block B).
6. Add `max-width: 75ch` to prose containers (the rail's "Contexto original" body).
7. Sidebar keyboard nav: `↑/↓` cycle, `Enter` activates, `Home/End` jump, `Tab` exits.
8. Visual smoke at three logical widths (narrow / mid / wide). Screenshot evidence in PR.

---

## 5. Block B — Progressive section rendering for spec MD

### 5.1 Goal

Render the streamed spec markdown as 5 cards (one per H2), each with `pending` / `streaming` / `done` states. Reservation of vertical space prevents layout shift on transitions. First incomplete card auto-scrolls into view.

### 5.2 Section attribution wire

The backend already emits `SSEEventSection {section}` (defined `iter_schemas.py:402`, detected in `iter_sse.py:94 SectionDetector`) the first time each H2 appears. The client reducer maintains:

```ts
sectionStates: Record<SectionKey, { status: "pending" | "streaming" | "done"; markdown: string }>
```

Wire:
- On `section` event → flip the previous section to `done`, the new section to `streaming`. Update `currentSection`.
- On `token` event → append `chunk` to `sectionStates[currentSection].markdown`.
- On `done` event → all sections to `done`.
- Anything received before the first `section` event lands in a "preamble" bucket and is discarded for display (per existing prompt structure, real spec output starts with `## Personas`).

### 5.3 Files touched

| Action | Path | Reason |
|---|---|---|
| CREATE | `packages/feedback-frontend/src/iter/SpecSectionCard.tsx` | Card with header (sticky inside main), state badge, body (skeleton when `pending`, partial MD when `streaming`, full MD + check icon when `done`). |
| CREATE | `packages/feedback-frontend/src/iter/specSectionState.ts` | Pure helpers: section-key types, derivation from stream events, body slicer for already-completed versions. |
| MODIFY | `packages/feedback-frontend/src/iter/markdownView.tsx` | Repurpose `StreamingSkeleton` as a per-section primitive (height-by-em). `RenderedMarkdown` stays as the per-section body renderer; consumers feed it the section's markdown slice. |
| MODIFY | `packages/feedback-frontend/src/iter/useIterRunStream.ts` | Add `sectionStates` to state; reducer cases for `section` / `token`. Existing `partialMarkdown` accumulator stays (used for editing whole-doc and as fallback). |
| MODIFY | `packages/feedback-frontend/src/iter/EditableSpecPanel.tsx` | Render mode shows N `SpecSectionCard`s mapped from `sectionStates` (or split-by-H2 of `output_markdown` for completed past versions). Edit mode keeps whole-doc `<Textarea>` as today (per-section edit was OOS in v0.4.4). |
| MODIFY | `packages/feedback-frontend/src/iter/IterFocusView.tsx` | Pass `sectionStates` (or the past version's slices) into `EditableSpecPanel`. |

### 5.4 New components

- **`SpecSectionCard`** — card primitive, three states. Sticky header inside main column.
- **`specSectionState.ts`** — helpers (no component): `splitMarkdownByH2(md): Record<SectionKey, string>`, types.

### 5.5 Risks

1. **Markdown-it state across slices.** Footnote refs and link defs at the bottom of a doc would break if we render 5 isolated `markdown-it` invocations. Pre-flight: grep DB samples of `output_markdown` for `[^foo]:` patterns. If zero (expected — the system prompt doesn't use them), markdown-it per slice is safe. If non-zero, switch strategy to "render the full doc once, then post-split the resulting HTML at heading boundaries."
2. **Skeleton heights chosen by hand.** Each card reserves an `em`-based `min-height` rough-matching expected content density (Personas ~5em, User Stories ~10em, Spec ~30em, Diagram ~8em, Assumptions ~10em). If the model writes shorter, blank space at the bottom of the card. Cosmetic; acceptable.
3. **Auto-scroll vs user scroll.** Detect user scroll via `onScroll` listener with debounce; if `scrollTop` changes outside our programmatic flag window, mark `userScrollOverride = true`. Reset when the next section flips to `streaming`. Standard pattern — easy to miss `scrollend` edge cases on mobile; will visual-smoke.
4. **Past-version rendering** (when displaying `latestVersion?.output_markdown` rather than streaming): no SSE events, so we use `splitMarkdownByH2` on the persisted markdown to derive `sectionStates` with all `done`. Same component, two data paths, single state shape.

### 5.6 Execution order within Block B

1. Add `sectionStates` derivation to `useIterRunStream` (no UI change yet — pure store extension). Unit-verify with synthetic event stream.
2. Implement `splitMarkdownByH2` in `specSectionState.ts`. Unit test against a recorded `output_markdown` sample.
3. Create `SpecSectionCard` with three states; visual smoke.
4. Replace `<RenderedMarkdown>` in `EditableSpecPanel` render mode with N `<SpecSectionCard>`s.
5. Sticky section headers within main column.
6. Auto-scroll-to-first-incomplete + user-scroll cancellation.
7. Visual smoke during a real iter run.

---

## 6. Block C — Live model state, single source of truth

### 6.1 Goal

One state object `{ requested, active, fallbackReason, status, startedAt, completedAt }` from which everything renders. Active-model badge in rail driven purely by SSE events (option iii from Q4). Fallback message becomes a transient toast that dismisses into the badge. Latency hint conditional on status; on completion swaps to elapsed time.

### 6.2 New SSE event

Backend emits `SSEEventProviderActive { model: str }`:
- ONCE at stream start, immediately after prompt build and before entering the chunk loop, with `provider.current_model`.
- Again immediately after each `provider_fallback` event (so the badge always renders the latest event and never has to infer).

Existing `provider_fallback {from_model, to_model, reason}` (v0.4.6) stays — it feeds the toast. The badge reads only `provider_active`.

### 6.3 Files touched

**Backend:**

| Action | Path | Reason |
|---|---|---|
| MODIFY | `packages/feedback-backend/src/feedback_widget/iter_schemas.py` | Add `SSEEventProviderActive` to the union. |
| MODIFY | `packages/feedback-backend/src/feedback_widget/iter_service.py` | Emit `SSEEventProviderActive(provider.current_model)` before the chunk loop. After each `SSEEventProviderFallback` emission, emit a follow-up `SSEEventProviderActive(provider.current_model)`. |
| MODIFY | `packages/feedback-backend/tests/unit/test_iter_service.py` | Assert `provider_active` is the first non-heartbeat event in the stream. Assert pairing: every `provider_fallback` is followed by a `provider_active`. |

**Frontend:**

| Action | Path | Reason |
|---|---|---|
| MODIFY | `packages/feedback-frontend/src/client/types.ts` | Add `provider_active` variant to `IterStreamEvent`. |
| MODIFY | `packages/feedback-frontend/src/iter/useIterRunStream.ts` | Reduce `provider_active` → `activeModel`. Track `startedAt` (set on stream `start`), `completedAt` (set on `done` or `error`). Existing `providerFallback` reducer stays. |
| CREATE | `packages/feedback-frontend/src/iter/useIterRunMeta.ts` | Hook deriving `{ requested, active, fallbackReason, status, startedAt, completedAt }`. `requested = session.current_primary_model_id`. `active = stream.activeModel ?? session.current_primary_model_id` (defensive bootstrap). `status` derived from stream + session. |
| CREATE | `packages/feedback-frontend/src/iter/ModelBadge.tsx` | Compact ⚡ + name. Tooltip lists fallback chain (read from session metadata). |
| CREATE | `packages/feedback-frontend/src/iter/ElapsedTimer.tsx` | Live counter when `status === "generating"`; freezes to `Generated in Xs` on completion. Uses `Date.now() - startedAt` per animation frame; never accumulates drift. |
| CREATE | `packages/feedback-frontend/src/iter/FallbackToast.tsx` | Radix Toast wrapper. 6 s auto-dismiss, pause-on-hover, `Esc` closes, close button visible, `aria-live="polite"`. |
| CREATE | `packages/feedback-frontend/src/iter/HintLine.tsx` | Single line: model latency hint when generating, "Generated in Xs" when done. Replaces the static `modelHint` prop on `EditableSpecPanel`. |
| MODIFY | `packages/feedback-frontend/src/iter/IterMetadataRail.tsx` | Wire ModelBadge / ElapsedTimer / HintLine / Round indicator / FallbackToast landing into the rail's slots. |
| MODIFY | `packages/feedback-frontend/src/iter/IterFocusView.tsx` | Drop the static fallback banner (today lines 343-361). Drop static `modelLatencyHint` call. Use `useIterRunMeta` once at the top, prop-drill `meta` to children. |
| MODIFY | `packages/feedback-frontend/src/iter/markdownView.tsx` | `modelLatencyHint` stays as a util. `StreamingSkeleton`'s internal latency-hint copy line is removed; that role now belongs to `<HintLine>` in the rail. |
| MODIFY | `packages/feedback-frontend/package.json` | Add `@radix-ui/react-toast` dependency. |

### 6.4 New components

- `ModelBadge`, `ElapsedTimer`, `FallbackToast`, `HintLine`, hook `useIterRunMeta`.

### 6.5 Risks

1. **Race: `provider_active` vs first token.** Service must `yield SSEEventProviderActive(...)` BEFORE entering the `async for chunk in provider.stream(...)` loop. Today the service does prompt build → call `provider.stream` → first chunk arrives → first token event yielded. Safe insertion point is between prompt build and the async-for. Test asserts ordering.
2. **Fallback walk: dual-event sequence.** After each `provider_fallback`, emit a follow-up `provider_active` so the badge stays a pure render of the latest event. Implementation: in the service's existing fallback-drain loop (added v0.4.6 in `iter_service.py`), emit `provider_active` right after each `provider_fallback` from `consume_fallback_events()`.
3. **Timer drift.** Use `Date.now() - startedAt` recomputed every animation frame; never tick-accumulate. Standard.
4. **Cold-start defensive bootstrap.** If user opens an in-flight session whose `provider_active` event already fired and was missed (browser refresh mid-stream), `stream.activeModel` will be empty; `useIterRunMeta` falls back to `session.current_primary_model_id`. The badge never flashes empty.
5. **Toast portal + Sheet z-index.** Radix Toast portals to body. Sheet (Radix Dialog) is also at body. Toast must layer above Sheet. Visual smoke needed; expect a `z-index` adjustment on the Toast Provider wrapper.
6. **Toast focus management.** When toast appears mid-iteration, focus stays on the action the user was doing (Confirm button in main, sidebar question, etc.). Toast itself is not focused. `Esc` closes it without stealing focus.

### 6.6 Execution order within Block C

1. Backend: add `SSEEventProviderActive` schema. Emit at stream start. Emit after each fallback. Add tests.
2. Frontend: add `provider_active` to event union and reducer. Add `startedAt`/`completedAt` to stream state.
3. Frontend: create `useIterRunMeta`.
4. Frontend: install `@radix-ui/react-toast` (single justified dep). Update lockfile.
5. Frontend: create `ModelBadge`, `ElapsedTimer`, `HintLine`, `FallbackToast`.
6. Frontend: wire all into `IterMetadataRail`'s slots.
7. Frontend: drop static fallback banner from `IterFocusView`. Drop static `modelHint` prop wiring.
8. Visual smoke: trigger a real fallback in dev (force the chain to walk) and verify toast → dismiss → badge swap → elapsed timer freezes on done.

---

## 7. Cross-cutting hard rules (apply across all blocks)

- **Zero absolute pixel values** for sizing, spacing, font-size, breakpoints. Use `rem`, `ch`, `%`, `fr`, `clamp()`, `em`, `vh`/`dvh`, `svh`. Native `1px` borders OK.
- **Container queries over media queries** wherever the component might be embedded in different contexts. (Block A is the carrier.)
- **Reuse existing design tokens.** No inline magic values. If a token is missing (e.g., a section-card success accent), propose adding it to `styles.css` rather than inlining.
- **Keyboard navigation:** `↑`/`↓` cycle questions in sidebar focus group, `Enter` activates, `Home`/`End` jump to extremes, `Tab` exits sidebar, `Esc` dismisses toasts (Block C).
- **Dark mode is baseline.** Verify WCAG AA contrast on every new surface.
- **No new heavy dependencies.** Single addition justified: `@radix-ui/react-toast` (~3 KB gz).

## 8. Validation checklist (Phase 4)

Each item with evidence (screenshot, manual check, or test):

- [ ] Layout reflows fluidly across container widths; no broken intermediate states.
- [ ] `git diff` of committed code: zero `[Npx]` arbitrary values for sizing/spacing/font-size/breakpoints. (`grep -E '\[(\d+)px\]' packages/feedback-frontend/src/iter` over the diff.)
- [ ] Container queries drive reflow; manually tested by embedding `IterFocusView` in a 50ch parent in dev.
- [ ] All 10 pending questions reachable from the sidebar without `+ N más` disclosure.
- [ ] Spec MD sections appear progressively with `pending → streaming → done` transitions and no layout shift (visual-record a streaming run).
- [ ] Active model badge reflects real model state and updates live on fallback walk.
- [ ] "20–60s typical" hint disappears on completion, replaced by elapsed time `Generated in Xs`.
- [ ] All existing actions still work: Confirm, Correct, Mark irrelevant, Skip, Run iteration, Mark ready, Abandon, comment submission.
- [ ] Keyboard nav: arrows cycle in sidebar, Enter activates, Home/End jump, Tab exits, Esc closes toast.
- [ ] Dark mode contrast passes WCAG AA on all new surfaces (axe-core or manual eyeball).
- [ ] Typography scales fluidly with `clamp()`; no jarring jumps at arbitrary widths.
- [ ] **Durability:** an existing v0.4.6 iter session opens cleanly in v0.5.0 (read latestVersion, list assumptions, render past spec, download package).

## 9. Out of scope

- `Mis feedbacks` tab list
- `Nuevo feedback` compose form
- Admin `IterWorkspace`
- Sheet chrome (`FeedbackPanel.tsx`) — unless Block A's container-query strategy forces a touch (flag and stop before)
- `VersionPill` internals
- `IterContextPanel` internals (only consumes new prop signature if Block A reflow forces a tweak — flag and stop before)
- Per-section `[✎ Editar]` button (whole-doc edit only, same as v0.4.4)
- Provenance footnotes ("Source: assumption ①, turn 2")
- Accept/reject diff overlay on regenerate
- TOC rail
- Section-level regenerate (`[↻]` per section)
- Backend changes beyond `SSEEventProviderActive` (no schema, no migration, no router refactor)

## 10. Pre-flight checks before Phase 3

Before opening the first commit of Block A, I will:

1. Verify v0.4.6 is validated by the user (the current in-flight test).
2. Greppy DB sample of `output_markdown` for footnote refs (`[^.*]:`) — informs Block B mitigation choice.
3. Confirm the user approves this spec by reviewing it at `feedback-widget/docs/specs/2026-05-07-iter-focus-redesign-design.md` (this file).

If any pre-flight fails I stop and surface to the user.

## 11. Open risks / things I want flagged before starting

1. **Sheet width strategy survives.** Container queries on the focus pane work as long as Sheet remains the parent. If we ever embed this view OUTSIDE the Sheet, the container query lets us reflow without Sheet changes — that upside justifies Q3 (a) but isn't blocking today.
2. **Markdown-it footnotes.** Pre-flight grep above. Cheap.
3. **Toast portal stacking.** 5-min visual-smoke after Block C step 5; no blocker, just attention.

## 12. Versioning & merge strategy

- One commit per block. Commit headers `feat(v0.5): [Block A] …`, `feat(v0.5): [Block B] …`, `feat(v0.5): [Block C] …`. No mixing concerns.
- No version bump until A, B, C all merged AND user validates end-to-end. Then bump frontend `package.json`, `src/version.ts`, backend `pyproject.toml`, `__init__.py` to `0.5.0` in a single tag commit.
- If Phase 3 surfaces a blocker that requires schema or contract changes outside this spec, **stop and surface to the user** before improvising.

---

## 13. Self-review (performed inline before commit)

- **Placeholders / TODOs:** none. Every section concrete.
- **Internal consistency:** Block A creates `IterMetadataRail` with empty slots; Block C fills them. Block B's `sectionStates` reducer change is independent of A and C. No section contradicts another.
- **Scope:** focused on the iter focus view. Out-of-scope list explicit. Block C touches backend in one minimal way (`SSEEventProviderActive`); no schema or migration.
- **Ambiguity:** "fluid container width thresholds" deliberately not pegged to specific `ch` values — ratio-based reflow chooses thresholds during implementation by visual judgment, then locked once. That's acceptable and documented.
- **Decomposition:** three blocks, sequential, each independently mergeable. A unblocks the rail slots; B is self-contained; C plugs into the rail. Order A → B → C is correct.
