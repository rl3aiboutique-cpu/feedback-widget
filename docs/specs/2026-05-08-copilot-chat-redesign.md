# Iter Focus View — Copilot Chat Redesign (v0.7.0)

**Status:** Approved (chat brainstorm — A/B/C/D ratified). Phase 3 starting.
**Date:** 2026-05-08
**Type:** Minor bump (0.6.0 → 0.7.0). Frontend-only restructure of the right panel; left panel goes from vertical-section-stack to tabbed view. **No backend changes**, no schema, no migration.

---

## 1. Why

After v0.6.0 shipped, the user's UX critique pivoted: the iter view shouldn't feel like a multi-pane dashboard with a chat bar — it should feel like collaborating with a senior BA on a living document. The right panel becomes a **proper chat interface** where the AI talks, asks questions inline as cards inside its bubbles, and the document on the left reacts visibly when the AI updates it.

The conceptual leap: stop modeling the right column as three parallel lists (open / resolved / chat input) and model it as a **single chronological timeline of session events** — versions, AI questions, user resolutions, and free-text chat — sorted by timestamp and rendered as chat bubbles. The data sources stay the same; the UI reorganises them around time.

The downstream objective from v0.6.0 carries over: every artifact persists in chronological order so Claude Code consumes the full ledger when implementing the ticket. The chat timeline IS the ledger, surfaced.

## 2. Layout — 65 / 35, two zones

```
┌──────────────────────────────────────────────────────┬─────────────────────────────────┐
│ ← Volver  [code]  Title                [⚙ contexto] │ 🤖 BA Copilot                   │
│                            [Mark ready] [Abandon]    │  ━━━━━━━━━━━━━━━━━━━━━━━━━     │
├──────────────────────────────────────────────────────┤                                  │
│ [Personas] [User Stories] [Spec] [Diagrama]    ←tabs │ 🤖  He generado el spec v1.    │
│                                                       │     Tengo 3 dudas:              │
│  ## Personas                                          │  ┌──────────────────────────┐  │
│  ### Compliance Officer                               │  │ ¿Cómo se ordena…?       │  │
│  ...IDE-density typography...                         │  │ Mi lectura: por fecha    │  │
│                                                       │  │ [Confirmar][Corregir]    │  │
│  Active tab fills the panel, no global scroll —       │  └──────────────────────────┘  │
│  only the active tab body scrolls if its content      │                                  │
│  exceeds the viewport.                                │ 👤 ✔ Confirmaste lectura  ✎    │
│                                                       │                                  │
│  Highlight-glow (2 s) on the active tab when a        │ 🤖 Spec v2 generado.            │
│  new version arrives.                                 │  ┌──────────────────────────┐  │
│                                                       │  │ ¿Quién…?                  │  │
│                                                       │  │ [...]                     │  │
│                                                       │  └──────────────────────────┘  │
│                                                       │                                  │
│                                                       │ 🤖 Auto-iter en 4 s [Cancelar] │
│                                                       │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                       │ ┌────────────────────────────┐ │
│                                                       │ │ Escribe tu desacuerdo…     │ │
│                                                       │ │                  [↗ Send] │ │
│                                                       │ └────────────────────────────┘ │
└──────────────────────────────────────────────────────┴─────────────────────────────────┘
                          65%                                          35%
```

**Header** (slim): `← Volver`, ticket code, title, `[Mark ready][Abandon]` (small, always visible), `⚙ Contexto` opens Dialog with original feedback. Round + active model chips condense in the header right side.

**Left panel** (65 %, document):
- Radix Tabs along the top: `Personas`, `User Stories`, `Spec`, `Diagrama`.
- Active tab body fills below; inner scroll if needed; **no panel-level scroll**.
- Auto-follow during stream: as SSE `section` events fire, the active tab swaps to the section being written. **User clicking another tab cancels auto-follow** for the rest of that stream. Auto-follow re-arms on the next stream's start.
- Highlight-glow: when a new version arrives (`stream.state.status === "done"` with a fresh `versionId` OR `versions` query refetch detects a new row), the active tab's content area gets `bg-yellow-900/20` for 2 s, fades back via CSS transition.
- Diagrama tab renders the existing `DiagramPanel` (Mermaid SVG) full-width.
- Edit mode (per existing `EditableSpecPanel`) swaps the tab body into a textarea + save/cancel.

**Right panel** (35 %, copilot chat):
- Top: avatar + "BA Copilot" label + "✓" badge when `isComplete`.
- Middle: scrollable timeline of bubbles (chronological). Auto-scroll to bottom on new content; user-scroll detection pauses auto-scroll until they return to bottom.
- Bottom: chat input (textarea + Send button). Enter submits; Shift+Enter newlines.
- **Sending a chat message auto-fires an iter** with that message as `user_message`. While iter is running, a "🤖 Incorporando feedback…" bubble shows; replaced with the version-done bubble when stream completes.
- Cards inline in bot bubbles: each open `assumption` renders as the existing `AssumptionCard` inside the bubble. Resolving the card transforms the bubble into a "👤 Confirmaste: X · ✎ Cambiar" summary, **but the original card is preserved** as a re-openable component (the AssumptionCard already supports the reopen flow internally).
- When `openAssumptions.length === 0` and `versions.length > 0`, the bot emits a synthetic bubble: "¿Marco como listo?" with `[Mark ready] [Seguir refinando]` actions.
- Auto-iter countdown (5 s) when 0 open: rendered as a special bot bubble with `[Cancelar]`. `Esc` cancels.

## 3. Decisions baked in (chat brainstorm A/B/C/D)

1. **Tabs**, not accordion. Auto-follow during stream; user click cancels auto-follow for the rest of that stream.
2. **Both** Mark ready / Abandon: small buttons in the header (always reachable) **and** a proactive bot bubble offering Mark ready when 0 open assumptions.
3. **Auto-fire on chat send.** No separate "Run iteration" button. While running, a "🤖 Incorporando feedback…" status bubble shows.
4. **Section-level highlight-glow** (2 s on active tab body). Per-line diffing deferred to v0.7.1.

## 4. Chat timeline data model

```ts
type ChatTimelineEvent =
  | { kind: "version_done"; version: IterVersionRead; ts: string }
  | { kind: "assumption"; assumption: IterAssumptionRead; ts: string }
  | { kind: "user_message"; message: string; ts: string }
  | { kind: "system"; copy: string; ts: string };

// Live-stream-only synthetic events (not persisted):
//   - "running_now"     → the chat shows a "🤖 Incorporando feedback…" bubble
//   - "all_resolved"    → "¿Marco como listo?" prompt
//   - "auto_iter_count" → countdown bubble with [Cancelar]
```

Build order:

1. `useChatTimeline(sessionId)` hook joins:
   - `versions.data[]` → `version_done` events keyed on `version.created_at`.
   - `assumptions.data[]` → `assumption` events keyed on `assumption.created_at` (resolution status is read off the assumption directly; resolved cards collapse via existing AssumptionCard internals when the panel renders them).
   - `iter_calls.data[]` (via existing `listIterCalls`) → `user_message` events for non-empty `user_message` keyed on `call.created_at`.
2. Sort by `ts` ascending.
3. Append live synthetic events at the end (not part of persisted history; recomputed each render from `useIterRunStream` state).

Resolved-card semantics: the timeline emits ONE event per assumption (the creation event). When the panel renders an `AssumptionCard` for that event and the assumption's status is non-`open`, the card renders in its compact resolved form (with the ✎ "Change my answer" affordance). This satisfies the "siempre se puede volver y responder otra cosa" rule without needing a second resolution event.

## 5. Components

| Action | Component | Purpose |
|---|---|---|
| **CREATE** | `useChatTimeline.ts` | Pure derivation hook — interleaves persisted data into chronological events. |
| **CREATE** | `ChatBubble.tsx` | Base bubble: avatar + meta + body slot. Variants: `bot`, `user`, `system`. Time-stamped. |
| **CREATE** | `CopilotChatPanel.tsx` | Right-panel container: scrollable timeline + chat input. Wires the timeline + live-stream synthetic events + send → iter. |
| **CREATE** | `SpecTabsPanel.tsx` | Left-panel container: Radix Tabs over the 4 sections + per-tab body + edit mode + auto-follow + highlight-glow. |
| **MOD** | `IterFocusShell.tsx` | 2-zone grid: spec 65 % / chat 35 %. No bottom strip. Container queries reflow to single column on narrow. |
| **MOD** | `IterFocusView.tsx` | Header gains `[Mark ready][Abandon]`. Drops ChatStrip + QuestionStackPanel wiring. Wires the new panels. |
| **MOD** | `EditableSpecPanel.tsx` | Stays as a low-level renderer for past-version markdown. SpecTabsPanel uses its per-section split logic but renders one section at a time inside a tab. |
| **DELETE** | `ChatStrip.tsx`, `QuestionStackPanel.tsx` | Rolled into `CopilotChatPanel`. |

## 6. Hard rules

- **Zero new px values** for sizing / spacing / font-size / breakpoints. Native 1 px borders OK.
- **Container queries** only on `IterFocusShell`.
- **Reuse existing tokens** (border-input, primary, muted, card, accent, emerald, amber, yellow). No magic colors.
- **Dark-mode parity** on every new surface.
- **No new dependencies.** Radix Tabs + Radix Dialog already in the dep tree (Tabs is in via `@radix-ui/react-tabs` in `package.json`; Dialog via Sheet primitive).
- IDE-density typography on the left: prose at `text-sm leading-snug` baseline; code blocks tighter than today.

## 7. Durability invariants

Same as v0.6.0:
- No `DROP COLUMN` / `DELETE` on user-data tables.
- No MinIO key migrations.
- v0.4.x / v0.5.x / v0.6.x sessions readable + downloadable in v0.7.x.
- Migrations strictly additive. **v0.7.0 ships zero migrations** (frontend-only).

## 8. Versioning

**v0.7.0** when the 8 steps land + user validates. SHA-refresh during iteration polish. Bump in 4 places (`__init__.py`, `pyproject.toml`, `package.json`, `version.ts`).

## 9. Validation checklist

- [ ] Layout 65 / 35, no global scroll, no dead margins on the focus pane edges.
- [ ] 4 tabs: Personas / User Stories / Spec / Diagrama. Active tab fills below.
- [ ] Auto-follow: tab swaps to the section being streamed. User click on another tab cancels for that stream.
- [ ] Highlight-glow (2 s) fires on active tab when a new version arrives.
- [ ] Right panel renders the chronological timeline as bubbles.
- [ ] Bot bubble can contain an inline assumption card; resolving the card collapses to summary; ✎ reopens.
- [ ] Free-text chat send auto-fires an iter; "Incorporando feedback…" bubble during stream; replaced by version-done bubble on completion.
- [ ] When 0 open assumptions + a version exists: bot emits "¿Marco como listo?" bubble; auto-iter countdown bubble appears separately.
- [ ] Mark ready / Abandon visible in the header and reachable always.
- [ ] Esc cancels auto-iter countdown.
- [ ] Fallback toast still works (Radix Toast portal).
- [ ] No new `[Npx]` arbitrary values in committed diff.
- [ ] Dark-mode AA contrast on every new surface.
- [ ] Container queries drive reflow; manually tested by embedding in a 50 ch parent (single-column stack: tabs above chat).
- [ ] Capellai vite build log clean (no `Rollup failed`); bundle hash changes; `mermaid` + `@radix-ui/react-toast` + `@radix-ui/react-tabs` already hoisted in capellai.
- [ ] An existing v0.6.x session opens cleanly in v0.7.0 (durability).

## 10. Open risks

1. **Auto-follow during stream + user override** — implementation needs a ref that flips to "manual" the moment the user clicks a different tab. Reset on next stream start. Easy to misimplement.
2. **Chat auto-scroll vs user-scroll** — standard pattern but easy to over-engineer. First cut: scroll-to-bottom on every new event UNLESS the user's `scrollTop` is more than ~5 % above bottom; if user scrolls back to bottom, resume auto-scroll. Document the chosen heuristic in the implementation commit.
3. **Highlight-glow timing** — 2 s feels right; if the user navigates away and back during the glow window, restart the timer or skip? First cut: skip (the user already saw the change).
4. **`listIterCalls` query coupling** — needs to be enabled and refetched alongside versions/assumptions. Add to the `qc.invalidateQueries` set when `stream.state.status === "done"`.

## 11. Pre-flight

- v0.6.0 shipped, capellai live with bundle `index-bFmV0r3a.js`.
- `@radix-ui/react-tabs` already in widget deps (`package.json`); `mermaid` + `@radix-ui/react-toast` hoisted in capellai (v0.5.x history).
- No backend changes for v0.7.0.

## 12. Self-review

- **Placeholders / TODOs:** none.
- **Internal consistency:** the timeline objective ("ledger") matches the chat-bubble UX (every event becomes a bubble; nothing hidden). The auto-iter and "Mark ready" prompts are bot-bubble synthetic events; they don't pollute persisted data because they're recomputed each render.
- **Scope:** focus view only. No backend, no schema, no admin workspace, no Mis feedbacks list. The package generation continues to read from the same persisted tables — the package payload doesn't change yet.
- **Ambiguity:** auto-scroll heuristic flagged as risk #2 with a documented first cut. Highlight-glow re-trigger flagged as risk #3 with a documented first cut.

The terminal goal — **chronological context ledger that Claude Code consumes** — is named and load-bearing throughout. The chat timeline IS the ledger, surfaced as a UI.
