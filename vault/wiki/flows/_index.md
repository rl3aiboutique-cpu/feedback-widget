---
type: domain
title: "Flows"
created: 2026-05-13
updated: 2026-05-13
tags:
  - domain
  - flows
status: seed
subdomain_of: ""
page_count: 0
---

# Flows

User journeys + state machines.

## Hoy (v0.7.0)

- **J0** — Host integrator: install + mount.
- **J1** — Submitter: form-based submit (5-8 clics).
- **J2** — Submitter: my tickets.
- **J3** — Submitter + Admin: comments append-only.
- **J4** — Admin: triage queue.
- **J5** — Admin: status workflow (new → triaged → in_progress → done/wont_fix).
- **J6** — Admin: moderate comments (append-only).
- **J7** — Admin: Iterate-with-AI (workspace).
- **J8** — Admin: LLM handoff ZIP.

## Mañana (chat-first redesign)

- **J1' (nuevo)** — Submitter: abre Sheet → chat → voz/texto → discovery LLM → síntesis → confirmar.
- J2-J6 sobreviven sin cambios.
- J7 desaparece para submitter, sigue accesible al admin (opcional).
- J8 sigue igual.

State machine chat: `idle → opening → awaiting_user → user_typing|recording → transcribing → bot_thinking → synthesizing → confirming → finalizing → done`.
