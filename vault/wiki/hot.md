---
type: meta
title: "Hot Cache"
created: 2026-05-13
updated: 2026-05-13
tags:
  - meta
  - hot
status: developing
---

# Recent Context

## Last Updated
2026-05-13. /grill-me session 1 CERRADA. 15 decisiones (D-001..D-015) consolidadas.

## Key Recent Facts
- Redesign chat-first del Feedback Widget aprobado: v1.0.0 big-bang PR, ~5 sem.
- Form actual fuera; `<FeedbackComposeLegacy/>` exportado deprecado 1 release.
- Iter workspace (~9k LOC) eliminado; backend SSE/idempotency/LLM chain reusables como `chat_service`.
- LLM = entrevistador grill-me-shaped, 5 turnos max + early exit, voz neutra sin nombre.
- Voz: OpenAI Whisper backend proxy, tap-toggle universal, **audio NO se persiste** (solo transcript).
- Data model: `feedback_chat_session` source of truth; `feedback` row se crea solo al confirm.

## Resolved branches (D-001..D-015)
- [[2026-05-13_grilled-feedback-widget-redesign]] — consolidated doc

## Recent Changes
- Created: vault scaffold + 15 detail decision pages + 1 consolidated grill doc.
- Updated: hot.md (este).
- Rule update during session: `dev-vault-discipline.md` ahora exige 1 doc consolidado por grill.

## Active Threads
- F1 implementation can start. Pending táctico (no grill): admin reopen-chat UI contract, bindings reduction 10→4, SSE reconnect window, magic-link scope check, per-host customizations.

## Resume hint
> "Sigamos cerrando ramas tácticas del feedback-widget redesign — admin reopen-chat y bindings reduction."
