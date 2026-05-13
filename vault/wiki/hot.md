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
2026-05-13. /grill-me session 1 en progreso — 6 decisiones acordadas.

## Key Recent Facts
- **Redesign chat-first del widget** decidido. Bump a v1.0.0.
- Form-based flow se reemplaza por chat conversacional + voz (Whisper).
- ~9k LOC del módulo Iter se borran; backend SSE/idempotency/LLM provider chain se reusan.
- LLM = entrevistador GrillMe-style, 5 turnos max, salida temprana en covered≥0.7.
- Transcripción: OpenAI Whisper via backend proxy, transcript editable.
- Recording: tap-toggle universal (no PTT).
- Data model: `feedback_chat_session` source of truth, `feedback` row se crea solo al confirm.

## Decisiones acordadas (D-001..D-006)
- D-001 [[2026-05-13_chat-first-replacement-strategy]] — v1.0.0 con legacy opt-in
- D-002 [[2026-05-13_kill-iter-refine-via-chat]] — matar Iter, refinar via chat
- D-003 [[2026-05-13_llm-turn-cap]] — 5 turnos + early exit
- D-004 [[2026-05-13_whisper-backend-proxy]] — Whisper backend proxy
- D-005 [[2026-05-13_voice-toggle-mode]] — toggle no PTT
- D-006 [[2026-05-13_data-model-chat-session]] — chat_session + feedback at confirm

## Active Threads
- /grill-me session 1 sigue. Próximas ramas: screenshot/multimodal, severidad visible, language strategy, phasing.
- Ramas cerradas: estrategia, iter cleanup, llm cap, voz pipeline, voz UX, data model.

## Open Questions
- ¿Multimodal screenshot solo en turno 1 o en todos?
- ¿Severidad/tipo visibles al submitter o solo al admin?
- ¿Idioma de respuesta: el del usuario o el del producto?
- ¿Persona name del bot ("Feedback Assistant" vs custom)?
