# ADR-007 — Chat-first redesign (v1.0.0)

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-05-14 |
| **Phase** | 5 (v1.0.0 surface freeze) |
| **Revisit when** | Two consecutive consumer hosts hit a measured UX issue with the conversational capture (drop-off > 30%, completion time > 90s, or repeated user complaints that "the chat does not understand what I want"), OR an admin user-test against the planned chat-based "Refinar" flow surfaces a blocker that the form-based iter workspace would have avoided. |

## Context

The widget shipped in v0.x as a classic 5-to-8-click form: type select →
title → free-text body → screenshot review → submit. After ~10 weeks of
real use across two pilot hosts (CRM, sapphira) the signal was
consistent:

- **Drop-off at the body field.** Roughly 40% of opens never reached
  submit. Users said the form felt like work, especially on mobile where
  the keyboard ate the screenshot preview.
- **Low information density per submission.** Free-text bodies skewed
  short (median 14 words), often missed the steps-to-reproduce, the
  expected vs actual, or which screen the user was on. Triage had to
  ping back for clarification on ~55% of tickets.
- **Iter was never reached by submitters.** The "iterate with AI"
  workspace shipped in v0.4 was used by admins exclusively. The
  submitter UI never linked into it because the form already felt
  heavy — adding "now talk to an AI" on top was rejected in user
  tests.

The team ran a `grill-me` session on 2026-05-13 with the user (22
decisions captured at
`vault/wiki/captures/decision/2026-05-13_feedback-widget-v1-redesign.md`).
The grill resolved the design tree and approved a single direction:
**replace the form with a conversational sheet**.

## Decision

`v1.0.0` ships a **chat-first submitter surface**. The floating
launcher opens a single Sheet that contains:

- a `Composer` (textarea + voice button)
- a `ChatTimeline` of user/assistant bubbles
- a live `SynthesisCard` (title, summary, status, type, sentiment,
  confidence) that the assistant updates as the user types
- a `FooterActions` row with "Confirmar" / "Abandonar"

The assistant runs in a `capture` mode: it asks short clarifying
questions, builds the synthesis incrementally, and stops when the user
hits Confirmar. The synthesis is then promoted into a real `feedback`
row by `POST /chat/sessions/{sid}/confirm`. Abandonar soft-deletes the
session.

Voice is supported via a backend Whisper proxy — the browser POSTs the
blob, the backend forwards it with the server-side OpenAI API key, and
the transcript flows back as a preview that the user accepts before
sending. Audio is never persisted.

The legacy submitter UI (`Compose`, `Canvas`, `FeedbackPanel`,
`MyTicketsPanel`, the `forms/` directory, and the full `iter/`
workspace) is **physically deleted** in the same release. The backend
keeps the legacy `/feedback` and `/iterate` endpoints registered so
existing v0.x deployments don't break at the wire level, but the React
surface for those flows is gone.

### What stays

- The HTTP client for iter (`client/iter`) and its type exports —
  `FeedbackTriagePage` (admin) still consumes them.
- The backend `iter_*.py` modules — admin Iter still might call
  them. A separate post-v1.0.0 slice removes them once admin "Refinar"
  migrates to the chat sheet.
- `ElementSelector` and the picker round-trip — the chat sheet
  exposes a CapturePicker control that mounts ElementSelector exactly
  like v0.x.
- `comments/CommentThread` — embedded inside `chat/TicketDetail` for
  the read-receipt / admin-reply flow.

### What changes for hosts

The integration call (`register_feedback_router(app, ...)`) is unchanged.
A new mount point `register_feedback_chat_router(app, ...)` exposes the
new endpoint family. Hosts that mount `<FeedbackButton/>` get the chat
sheet automatically. Hosts that mounted `<IterWorkspace/>` directly
need to remove that import — the React surface is gone (the HTTP
client is preserved).

## Alternatives considered

1. **Keep the form, add a "chat with AI" affordance inside it.** Tried
   in the v0.5 prototype. Felt like a fourth field on an already-heavy
   form. Did not address drop-off.
2. **Ship the chat sheet next to the form, A/B test for two
   sprints.** Doubled the maintenance surface for an outcome we already
   had signal on from user tests. Rejected by the user on 2026-05-13.
3. **Chat sheet, but keep `<IterWorkspace/>` as a public component for
   advanced users.** Two surfaces for the same job. Rejected — admin
   Refinar will reuse the same chat sheet (post-v1.0.0 slice).
4. **Delete the iter backend in the same release.** Rejected for v1.0.0
   because admin flows might still hit it. Tracked as a separate
   slice.

## Consequences

**Positive:**

- One submitter surface, one mental model. The Sheet is the only
  entry point.
- Synthesis quality is higher than free-text bodies — the LLM
  enforces presence of title/summary/status/type/sentiment before
  Confirmar.
- Voice capture removes the typing tax on mobile.
- Code surface shrinks: ~5.5k LOC of legacy React removed in one
  release.

**Negative:**

- **Breaking change on the React public surface.** Hosts that
  imported `<IterWorkspace/>` directly need to remove the import.
  Mitigated by keeping `client/iter` exports stable.
- **LLM dependency on the critical path.** A submitter cannot file a
  ticket without the backend reaching its provider chain. Mitigated
  by the existing provider fallback chain (Gemini → Gemma) and a
  planned offline-mode skip (post-v1.0.0).
- **Backend iter modules linger.** `iter_router.py`, `iter_service.py`,
  `iter_llm/` stay on disk even though no shipped React surface uses
  them. Resolved by the deferred cleanup slice.

**Neutral:**

- Whisper traffic now flows through the widget's backend by default.
  Hosts that want to route it through their own auth layer can wire
  `SubmitVoiceRecording` on their adapter (see CHANGELOG).

## Evidence

- 22 grilled decisions:
  `vault/wiki/captures/decision/2026-05-13_feedback-widget-v1-redesign.md`
- Approved spec:
  `docs/specs/2026-05-13-feedback-widget-chat-first-design.md`
- Implementation plan:
  `docs/superpowers/plans/2026-05-13-feedback-widget-chat-first.md`
- Shell-hybrid follow-up design:
  `docs/specs/2026-05-14-feedback-widget-shell-hybrid-design.md`
- Shell-hybrid plan:
  `docs/superpowers/plans/2026-05-14-feedback-widget-shell-hybrid.md`
- CHANGELOG entry: `CHANGELOG.md` § `[1.0.0] — 2026-05-14`
