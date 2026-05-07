# Iter Focus View — Spec-Protagonist Redesign (v0.6.0)

**Status:** Approved (chat brainstorm). Phase 3 starting now.
**Date:** 2026-05-08
**Type:** Minor bump (0.5.x → 0.6.0). Structural redesign of the focus view, no schema changes, no destructive migrations.

---

## 1. Why this exists — the real objective

The iter feature's downstream purpose is to produce a **chronological context ledger** that gets fed to Claude Code (or another implementation agent) so the ticket gets resolved correctly the first time. The protagonist is the spec; the assumption answers are the *traceable refinements* of that spec; the chat is the user's free-form pushback. **Every artifact persists** — resolved assumptions stay visible after their round, edits to the spec produce a new version row, chat messages live in the call's `user_message`. The downloadable package includes all of it with timestamps so an external agent reads the complete decision trail, not just the final spec.

The previous v0.5.x iterations optimized the wrong axis. v0.5.0 / v0.5.1 / v0.5.2 framed the screen as a multi-panel dashboard. The user's real workflow is:

1. AI ships a spec + assumptions
2. User answers cards, edits spec inline, chats freely
3. When all assumptions are resolved → auto-iter
4. AI ships an updated spec + maybe new assumptions
5. Repeat until "Mark ready"

The protagonist throughout is the **spec**. Assumptions are the AI checking its own homework. Chat is the user's pushback. v0.6 reshapes the layout to match.

## 2. Layout — three zones, one mode

```
┌──────────────────────────────────────────────────────────┬─────────────────────────┐
│ ← Volver  [code]  Title              [Round X/Y][Ready] │ ❓ Preguntas (3 abrt)   │
│                                       [⚙ context]       │ ━━━━━━━━━━━━━━━━━━━━   │
├──────────────────────────────────────────────────────────┤                         │
│                                                           │ ┌───────────────────┐  │
│  # Personas / # User Stories / # Spec / # Diagram        │ │ ABIERTA           │  │
│                                                           │ │ ¿pregunta…?       │  │
│  Editable inline · diagram = Mermaid SVG inline           │ │ Mi lectura: …    │  │
│                                                           │ │ [Confirmar]       │  │
│  This column is the protagonist. It is always visible     │ │ [Corregir]        │  │
│  and dominant. Streams progressively during a run.        │ │ [No aplica]       │  │
│                                                           │ └───────────────────┘  │
│  Roughly 65–70% of focus-pane width.                      │                         │
│                                                           │ ─── resueltas (2) ───   │
│                                                           │ ✓ pregunta · "alto"     │
│                                                           │   [editar respuesta]   │
├──────────────────────────────────────────────────────────┴─────────────────────────┤
│ 💬 Escribe tu desacuerdo, idea nueva o lo que el AI deba reconsiderar:               │
│ ┌──────────────────────────────────────────────────────────────────────────────────┐│
│ │                                                                                   ││
│ └──────────────────────────────────────────────────────────────────────────────────┘│
│                                       [ Run iteration ] [ Mark ready ] [ Abandon ] │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Three zones:
- **Spec hero** — left-center, ~67%, always visible.
- **Question stack** — right, ~28%, lists ALL assumptions (open above, resolved below dimmed and re-editable).
- **Chat strip** — bottom, full-width. Free-text textarea + Run iteration / Mark ready / Abandon.

Header: minimal (Volver, ticket code, title, round, status badge, ⚙ Contexto button that opens a Dialog with the original feedback + screenshot — no longer takes column space).

No left sidebar. No metadata rail. Model badge / elapsed timer / hint condense into a tiny line in the header (or the chat strip — TBD inline).

### 2.1 Container query reflow

- Wide (≥ 100ch): two columns + bottom strip as drawn.
- Mid (60–100ch): same; spec column may compress.
- Narrow (< 60ch): single column stacking — questions stack above spec above chat. Or: spec → questions accordion → chat. Implementation chooses what reads best in the narrow case; document the choice in the commit.

## 3. Behaviors

### 3.1 Question stack (right column)

- Open assumptions render at the top with full action buttons (Confirmar / Corregir / Skip).
- Resolved assumptions render below in a "Resueltas (N)" section, dimmed but legible. Each has an "editar respuesta" affordance that re-opens the card so the user can change a previous answer at any time. **Critical:** this satisfies the user's "siempre se puede volver y responder otra cosa".
- New assumptions from a fresh iter land at the top of the open block. Resolved ones from the previous round STAY in the resolved block; they are not archived behind a disclosure. The chronological ledger is the point.
- Empty state ("0 abiertas, 0 resueltas") — the ⏳ placeholder while the first iter runs, OR "Todo respondido — listo para iterar" green strip when 0 open / N resolved.

### 3.2 Spec hero (left-center)

- 4 sections (Personas / User Stories / Spec / Diagram). Diagram inline as Mermaid SVG.
- Streams progressively (Block B behaviour preserved): pending → streaming → done per section.
- Editable inline: clicking [✎ editar] on a section's heading swaps to a textarea (existing v0.4.4 behaviour, scoped per section instead of whole-doc — implementation should aim for per-section but if too risky in v0.6 ship whole-doc edit and note as deferred).
- 75ch max-width on prose for readability, centered.
- Strip duplicate H1 (v0.5.2 behaviour preserved).

### 3.3 Chat strip (bottom)

- Single textarea, full-width inside the strip.
- Three actions to its right: Run iteration / Mark ready / Abandon.
- Content sent with `Run iteration` populates `IterRunRequest.user_message`. After send, textarea clears.
- `Run iteration` is enabled even with open assumptions (the user can iterate on chat alone) — the AI then incorporates the chat into the next round's spec and may produce new assumptions. The "0 open assumptions" auto-iter trigger still fires for the friction-free path; manual Run iteration is for chat-driven pushback.
- Optional polish: a tiny "💬 N msgs en este round" link near the textarea opens a Dialog showing the chat trail of the current session (data already in `feedback_iter_call.user_message` — read-only chronological list).

### 3.4 Auto-iter countdown (v0.5.0 behaviour preserved)

- When 0 open assumptions and a version exists → 5s countdown banner, Cancelar/Esc.
- Banner appears at the TOP of the spec hero column (overlaying the first section's space) — not in the chat strip. The user is reviewing spec when this fires; surfacing the countdown in their reading area is correct.

### 3.5 Provider fallback toast (v0.4.6 behaviour preserved)

- Radix Toast portals as today. No layout change.

### 3.6 First-round empty state

- Round 1 before iter fires: spec column shows the auto-fire banner ("Iniciando primera ronda…"). Question stack shows "Las preguntas aparecerán cuando el AI termine de leer". Chat strip available but Run iteration is disabled until first iter completes.

## 4. Components

| Action | Component | Notes |
|---|---|---|
| **CREATE** | `SpecHeroPanel.tsx` | The protagonist spec column. Wraps existing EditableSpecPanel logic in a hero-style wrapper. Owns the per-section edit affordance. |
| **CREATE** | `QuestionStackPanel.tsx` | Lists all assumptions. Open block + resolved block. Each card uses existing `AssumptionCard` (open) or a compact resolved-card variant (re-editable). Counter at top. |
| **CREATE** | `ChatStrip.tsx` | Bottom horizontal strip. Textarea + Run / Mark ready / Abandon. Owns the message state; on send, calls back into IterFocusView's stream.start. |
| **CREATE** | `ContextDialog.tsx` | Wraps existing `IterContextPanel` content inside a Radix Dialog opened from the header's ⚙ button. |
| **MOD** | `IterFocusShell.tsx` | New 2-col + bottom-strip grid. Areas: `"spec questions" / "chat chat"`. Container query reflow for narrow. |
| **MOD** | `IterFocusView.tsx` | Orchestrates the new layout. Drops sidebar/rail wiring. Header chips line includes round + tiny model badge + ⚙ button. |
| **DELETE** | `IterPendingSidebar.tsx` | Replaced by `QuestionStackPanel` on the right. |
| **DELETE** | `IterMetadataRail.tsx` | Replaced by header chips + chat strip. |
| **MAYBE DELETE** | `ModelBadge.tsx` / `ElapsedTimer.tsx` / `HintLine.tsx` | Inline in the header. Keep the files if they're trivially reused there; delete if their callsites disappear. |
| **KEEP** | `AssumptionCard.tsx`, `EditableSpecPanel.tsx`, `SpecSectionCard.tsx`, `DiagramPanel.tsx`, `FallbackToast.tsx`, `useIterRunMeta.ts`, `useIterRunStream.ts`, `specSectionState.ts` | Reused by the new shell. |

## 5. Decisions baked in (from chat brainstorm, locked)

- Resolved assumptions stay visible (Option A). No archiving.
- Chat is always visible at the bottom. Send goes into `user_message`, gets persisted, becomes part of the package.
- Spec is protagonist. Always visible. Always the visual anchor.
- "Contextual spec" idea (only relevant section visible) DROPPED — user wants whole spec always.
- Two-mode idea (answer mode vs review mode) DROPPED — single mode, layout doesn't shift with state.
- Left sidebar DROPPED. Questions move to the right.

## 6. Hard rules (cross-block)

- Zero new px values for sizing/spacing/font/breakpoints. Native 1px borders OK.
- Container queries on `IterFocusShell` (not viewport breakpoints).
- Reuse existing tokens (border-input, primary, muted, card, etc.).
- Dark mode parity on every new surface.
- No new heavy dependencies. Mermaid + Radix Toast already in.
- No backend schema changes for v0.6.0. The persistence + package generation are existing endpoints; the UI just orchestrates them differently.

## 7. Durability invariants (cross-version)

Same as v0.5 spec:
- No DROP COLUMN, no DELETE on `feedback_*` tables. Soft-delete only.
- No MinIO key migrations.
- v0.4.x / v0.5.x sessions readable + downloadable in v0.6.x.
- Migrations strictly additive.

## 8. Versioning

**v0.6.0** when A+B+C all merged AND user validates end-to-end. Single tag commit bumps:
- `packages/feedback-backend/src/feedback_widget/__init__.py`
- `packages/feedback-backend/pyproject.toml`
- `packages/feedback-frontend/package.json`
- `packages/feedback-frontend/src/version.ts`

Within v0.6 iteration cycles (post-bump polish), version stays at 0.6.0; commits are SHA-refresh on the capellai pin only (per the workflow rule established 2026-05-07).

## 9. Validation checklist

- [ ] Spec column always visible AND dominant (~67% width).
- [ ] All assumptions visible on right; open above resolved.
- [ ] Resolved assumptions are re-editable from the stack (click "editar respuesta" → re-opens).
- [ ] Chat strip at bottom, full-width, send populates `user_message`.
- [ ] Run iteration enabled even with open assumptions (chat-driven path).
- [ ] Auto-iter countdown still fires at 0 open + has-version (v0.5.0 behaviour preserved).
- [ ] Fallback toast still works (v0.4.6 behaviour preserved).
- [ ] No left sidebar, no rail-as-metadata column.
- [ ] Header has ⚙ button → opens Dialog with original feedback + screenshot.
- [ ] Diagram renders as Mermaid SVG inline in the spec column (v0.5.1 behaviour preserved).
- [ ] No `[Npx]` arbitrary values in committed diff.
- [ ] Dark mode AA contrast on every new surface.
- [ ] Container queries drive reflow; manually tested by embedding in a 50ch parent.
- [ ] Capellai vite build log clean (no `Rollup failed`); bundle hash changes.
- [ ] An existing v0.5.x session opens cleanly in v0.6.0 (durability).

## 10. Open risks

1. **Per-section edit vs whole-doc edit** — the spec implies per-section edit is the goal. If implementing it requires touching the `editIterVersionMarkdown` endpoint contract, defer to v0.6.1 and ship whole-doc edit first.
2. **Narrow-container reflow** — the 3-zone layout is tricky on narrow widths. Document the chosen stacking order in the implementation commit.
3. **Chat history surfaced in UI** — the user said "todo va al package". Today the textarea clears after send; the prior chat content is in the DB but not displayed. Whether to show prior turns in the chat strip is a polish item — flag if user asks.

## 11. Pre-flight

1. v0.5.2 validated (user confirmed redesign was good direction but layout structurally wrong) — done by this critique.
2. No backend changes needed for v0.6.0 layout. Just frontend.
3. Capellai dep hoisting check (still needs `mermaid` and `@radix-ui/react-toast` in capellai's package.json — already added, no-op).

## 12. Self-review

- **Placeholders / TODOs:** "Per-section edit vs whole-doc edit" flagged as risk #1, defer-decision documented. No silent TBDs.
- **Internal consistency:** the resolved-assumptions block intent matches the user's "todo es contexto" objective. Chat strip behaviour matches "siempre abajo + Run iteration enabled even with open assumptions".
- **Scope:** focused on the focus view layout. No backend/schema. No package generation changes (those are downstream).
- **Ambiguity:** the per-section vs whole-doc edit decision is intentionally deferred. Implementation gets to make the call based on contract complexity.

The terminal goal — **a chronological context ledger that Claude Code consumes to resolve the ticket** — is named in §1 so any future change can be evaluated against it.
