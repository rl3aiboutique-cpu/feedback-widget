# Feedback Widget v1.0.0 — shell híbrida (OLD chrome + NEW chat)

- **Date**: 2026-05-14
- **Document**: 2026-05-14-feedback-widget-shell-hybrid-design.md
- **Category**: SPEC
- **Status**: Approved (brainstorming complete)
- **Supersedes**: parts of [`2026-05-13-feedback-widget-chat-first-design.md`](./2026-05-13-feedback-widget-chat-first-design.md) related to `FeedbackChatSheet` shell. The 22 grilled decisions (D-001..D-022) remain valid; this spec refines the visual shell.

## Why this spec exists

After visual review of the OLD UI inside CBP (Compliance Brain at `localhost:3001`), the user requested that the existing widget chrome be preserved verbatim — header, tabs, CAPTURE picker, bottom buttons — and only the form-fields zone (title / description / expected_outcome / attachments) be replaced by the chat (bubbles + composer). The chat-first redesign keeps its LLM behavior, data model, and backend; only the frontend Sheet layout changes.

## Shell elements preserved from OLD

| Element | Source | Behavior |
|---|---|---|
| Header `RL3 Feedback` + RL3 logo + description paragraph | `FeedbackPanel.tsx` (existing) | Unchanged |
| Tabs `[✎ Nuevo feedback]` / `[📋 Mis feedbacks N]` | `Canvas.tsx:178-231` (existing) | Unchanged. "Mis feedbacks" tab still renders the legacy feed (later S3E will integrate inline comments). The collapsible "Conversaciones previas" header from S3C is **removed** — the OLD tabs cover that need. |
| `CAPTURE` label + `[Whole page]` / `[Select element]` buttons | `Compose.tsx:135-162` (existing) | Unchanged. Selecting `Select element` triggers `ElementSelector.tsx` overlay (existing); locked element flows into `auto_context.element_selector/xpath/bounding_box`. |
| Footer powered-by RL3 + version pill | `FeedbackPanel.tsx:99-115` (existing) | Unchanged. Visible only during discovery (hidden when SpecCard is on-screen). |
| Cancel button at very bottom | `FeedbackPanel.tsx:120-127` | Unchanged. |

## Shell elements removed from OLD

| Element | Why removed |
|---|---|
| `TYPE` dropdown (6 categories) | D-008: LLM infers type silently; admin edits in Triage. No user-facing classification. |
| `TITLE` input | Replaced by chat-driven discovery + SpecCard editable. |
| `DESCRIPTION` textarea | Same. |
| `EXPECTED OUTCOME` textarea | Same. |
| `ATTACHMENTS` drop zone | Deferred to v1.1.0 (D-007 — screenshot auto-capture covers 95%). |
| `[Send and Iterate]` bottom button | The chat IS the iteration — separate "Iterate" button no longer makes sense. |

## NEW elements in the form-area zone

| Element | Role |
|---|---|
| **ChatTimeline** | Vertical list of `ChatBubble`s (assistant / user / synthesis-card). Auto-scrolls to bottom. |
| **SpecCard inline-editable** (Batch B existing) | Rendered as the FINAL assistant bubble when synthesis arrives. Each field is click-to-edit on blur autosave. |
| **Composer** | Textarea + send button. Disabled during `bot_thinking` / `synthesizing` / `confirming` / `finalizing`. Hidden when SpecCard is visible (user uses bottom buttons instead). |

## Bottom buttons — state-driven visibility

Replaces the old fixed `[Send feedback]` + `[Send and Iterate]` pair.

| `state` | Bottom buttons | Composer |
|---|---|---|
| `idle` / `opening` | hidden | hidden |
| `awaiting_user` (discovery) | **hidden** | active |
| `bot_thinking` | **hidden** | disabled |
| `synthesizing` | **disabled + spinner** | hidden |
| `confirming` (SpecCard visible) | **`[↺ Sigamos iterando]` secondary + `[✓ Confirmar]` primary** | hidden |
| `finalizing` | both disabled | hidden |
| `done` | hidden, replaced by "✓ ¡Gracias!" message | hidden |
| `error` | `[Reintentar]` primary | hidden |

**Behavior of the buttons:**

- **`[↺ Sigamos iterando]`** — clears synthesis from UI state, bot pushes assistant message "¿Qué quieres ajustar?", state returns to `awaiting_user`. The previous synthesis stays in `feedback_chat_session.synthesis_json` history (mutated on next synthesize event).
- **`[✓ Confirmar]`** — calls `POST /chat/sessions/{sid}/confirm`. Returns `{feedback_id, ticket_code}`. Bot pushes "✓ ¡Gracias! Tu feedback es FB-2026-NNNN". State `done`. Sheet auto-closes after 3s.

## LLM architecture — single call per turn (NOT LangGraph)

Decision after weighing trade-offs (see brainstorm session 2026-05-14):

### What single call per turn delivers

| Capability | How |
|---|---|
| **Memory** | Each turn passes `system_prompt + full conversation history + new user message`. Postgres persists `feedback_chat_session.messages JSONB[]`. Total recall across browser refreshes. |
| **Reasoning** | Modern LLMs (gemini-flash-latest, claude haiku, gpt-4o-mini) reason within a single call. The strict JSON output with `covered` self-scores forces structured self-reflection. |
| **Context capacity** | Gemini Flash = 1M tokens. 5-turn conversation ≈ 1.5k tokens + screenshot 1.5k + system prompt 500 = ~3.5k. Trivial; conversations 10x longer still fit easily. |
| **One question at a time** | Hard rule in D-015 system prompt + JSON schema with single `reply` field. |
| **Skip covered dimensions** | LLM sees previous `covered` scores in conversation history; the system prompt instructs to advance only on uncovered branches. |
| **Empathetic reflection** | "Reflect before asking" rule in D-015. |

### What single call does NOT cover (acceptable for v1.0.0)

- **No multi-step planning within one call** — by design. Each user message → 1 turn. Natural for grill-me.
- **No tool calls** — not needed. Glossary is in system prompt; screenshot is multimodal turn-1 attachment.
- **No critic / second-opinion pass** — optional improvement (see §"Quality improvements" below).

### Why NOT LangGraph for v1.0.0

| Criterion | Single call | LangGraph |
|---|---|---|
| Time-to-v1.0.0 | implemented today | +2-3 weeks rewrite |
| Cost per feedback | ~$0.005 | ~$0.015-0.025 |
| Lock-in | provider-agnostic (Gemini / Claude / OpenAI / Fake) | LangChain ecosystem |
| Debug | uvicorn logs + chat_router SSE events | graph traces, checkpoints |
| Prompt iteration | edit `chat_prompts/capture_prompt.py` | edit + redeploy graph + reseed state |

**Verdict:** ship single call now, add LangGraph in v1.1+ ONLY if metrics show insufficient quality.

## Quality improvements (without LangGraph)

Three surgical additions that lift grill-me quality and ship inside v1.0.0 if time permits, or v1.0.1 post-launch:

| # | Improvement | Code | Benefit |
|---|---|---|---|
| 1 | **Few-shot examples in system prompt** | +500 prompt tokens (cached via Anthropic / Gemini prompt caching) | Reduces drift on first 1-2 user inputs; +consistency tone |
| 2 | **Optional critic pass post-synthesis** | +1 LLM call after `mode=synthesize` to review synthesis quality and rewrite if vague | ~+20% subjective quality; +$0.001/feedback |
| 3 | **Observability metrics** | +30 LOC backend logging: `turn_count_at_synthesis`, `coverage_at_exit`, `synthesis_word_count`, `abandon_state` | Enables post-launch data-driven decisions on whether LangGraph is worth it |

## Metrics SLOs to watch post-launch

| Metric | Target | If breached → action |
|---|---|---|
| `turn_count_at_synthesis_p95` | ≤ 5 | Tune system prompt; lower coverage threshold from 0.7 to 0.6 |
| `abandon_rate` | < 25% | UX review of grill-me prompt; check sentiment of first bot message |
| `admin_edit_rate` (admin re-writes synthesis) | < 50% | Improve synthesis prompt; consider critic-pass (improvement #2 above) |
| `synthesis_word_count_p50` | 80-150 words | If < 50 → too terse; if > 250 → too verbose. Tune via prompt examples |
| Cost per feedback | < $0.01 | Switch to cheaper model OR reduce context (drop history older than 10 turns) |

## Components changed by this spec

### Modified (frontend)

| File | Change |
|---|---|
| `packages/feedback-frontend/src/FeedbackChatSheet.tsx` | Re-architect to use OLD shell (header + tabs + CAPTURE picker + footer + bottom buttons) wrapping the chat zone |
| `packages/feedback-frontend/src/FeedbackButton.tsx` | Remove `VITE_FEEDBACK_CHAT_FIRST` flag (legacy goes away) |
| `packages/feedback-frontend/src/chat/Composer.tsx` | Hide (not just disable) when state ∈ {synthesizing, confirming, finalizing, done} |
| `packages/feedback-frontend/src/chat/SynthesisCard.tsx` | Already inline-editable per S3D scope; remove its own bottom buttons (they move to Sheet-level footer) |
| `packages/feedback-frontend/src/chat/useFeedbackChat.ts` | Emit state changes the new Sheet shell reads for button visibility |
| `packages/feedback-frontend/src/chat/PreviousConversations.tsx` | **REMOVED** — its function moves into the legacy "Mis feedbacks" tab |

### Reused as-is (no changes)

| File | Reused for |
|---|---|
| `Compose.tsx:135-162` (CAPTURE picker chunk) | Extract into a small `<CapturePicker>` component or copy verbatim |
| `Canvas.tsx:178-231` (tabs chunk) | Same approach |
| `ElementSelector.tsx` | Element picker overlay |
| `capture/screenshot.ts` + `capture/metadata.ts` | Auto-capture pipeline |
| Backend `chat_service.run_turn` + `chat_router` + Whisper proxy stub (S2 done) | Unchanged |
| Backend `chat_prompts/capture_prompt.py` (D-015 grill-me v2) | Unchanged |

### Deleted / deferred

| File | Disposition |
|---|---|
| `Compose.tsx` (form fields) | Delete in S7 — but the CAPTURE picker chunk is extracted to a new `<CapturePicker>` first |
| `forms/FeedbackForm.tsx` + `forms/AttachmentsField.tsx` | Delete in S7 (attachments deferred to v1.1.0) |
| `Canvas.tsx` (full file) | Delete in S7 — tabs chunk extracted to a new `<FeedbackTabs>` |
| `FeedbackPanel.tsx` | Delete in S7 — its shell role moves to the refactored `FeedbackChatSheet.tsx` |
| `MyTicketsPanel.tsx` | Delete in S7 — `Mis feedbacks` tab renders the feed inline |
| `chat/PreviousConversations.tsx` (S3C) | Delete (functionality moves to tabs) |
| `useMyConversations.ts` (S3C) | Delete |

## Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Adding the shell makes the Sheet visually busy | Compact CAPTURE row (single row); hide tabs when only one feedback exists; collapse footer pills when synthesis is visible |
| R2 | User confused why CAPTURE buttons are still visible after chat starts | The picker is the entry decision — after chat starts, picker becomes read-only badge ("📍 elemento marcado" or "🌐 página completa") |
| R3 | Bottom buttons changing visibility may feel "ghosty" | Use fade-in animation 200ms; the SpecCard appearance is the visual cue that confirmation is available |
| R4 | "Mis feedbacks" tab content overlap with admin Triage permissions | Mine tab shows only `user_id == current_user.id`; existing endpoint already filters |
| R5 | LLM single-call quality insufficient → metrics breach | Mitigations 1+2+3 from §Quality improvements; LangGraph migration plan documented but not yet implemented |
| R6 | Single LLM call cost spikes if conversation history grows | Hard cap 5 turns (D-003) keeps history bounded |
| R7 | CAPTURE picker click after chat already has messages should re-capture? | Decision: NO. Once chat starts, the picker is locked. To change capture mode, user must close and reopen (rare case). |

## Out of scope for this spec

- Voice input (Whisper) — S4 owns
- Admin refine mode — S6 owns
- Comments inline / admin-reply bubbles — S3E owns
- LangGraph migration — v1.1+ if metrics demand
- TYPE dropdown re-introduction — never (D-008 final)

## Implementation slices affected

| Slice | Status | New scope |
|---|---|---|
| S3D (SpecCard editable + Sigamos iterando) | pending | Editable fields + move "Confirmar" / "Sigamos iterando" buttons to Sheet footer |
| S3F (NEW) | new — replaces S3C | Shell refactor: extract `<CapturePicker>`, `<FeedbackTabs>`, refactor `FeedbackChatSheet` to compose old chrome + chat zone |
| S5 (Backend confirm + abandon) | pending | Unchanged |
| S5b (Frontend wire confirm) | pending | Frontend hits real `/confirm` from the Sheet footer button |
| S3E (comments inline + status) | pending | Mine tab inline comment thread per ticket |
| S4 (voice) | pending | Unchanged |
| S7 (cleanup) | pending | Now deletes `Compose.tsx`, `Canvas.tsx`, `FeedbackPanel.tsx`, `MyTicketsPanel.tsx`, `forms/`, `chat/PreviousConversations.tsx`, `chat/useMyConversations.ts` |

## Resume hint for writing-plans

> "Plan implementation of the shell-hybrid refactor: write bite-sized plan for S3F (extract CapturePicker + FeedbackTabs + refactor FeedbackChatSheet). After S3F demo passes, write S3D (SpecCard editable + footer buttons). Defer S5/S5b/S3E/S4/S7 plans to their slice trigger."
