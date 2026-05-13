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
2026-05-13. /grill-me sesiones 1+2 CERRADAS. 22 decisiones (D-001..D-022). F1 ready.

## Key Recent Facts
- Redesign chat-first del Feedback Widget completamente especificado.
- v1.0.0 big-bang PR, ~5 sem. Bindings sin cambios (D-020) → cero migration friction hosts.
- Capture mode (submitter): grill-me-shaped, 5 turn cap, voz Whisper backend-proxy (audio no persiste).
- Refine mode (admin): prompt separado, [Refinar con AI] top bar, contexto = synthesis + chat completo capture.
- Backend SSE: defaults + 1h idempotency. Magic-link unchanged. Iter workspace eliminado.

## Resolved branches
- s1: [[2026-05-13_grilled-feedback-widget-redesign]] — D-001..D-015 estratégicas
- s2: [[2026-05-13_grilled-feedback-widget-redesign-s2]] — D-016..D-022 tácticas

## Active Threads
- F1 implementation puede arrancar. Sin pending bloqueante.
- Futuras grill opcionales: observability, error handling LLM JSON, test strategy, migration guide.

## Resume hints
- Implementación: "Vamos a por F1 — migración Alembic + POST /feedback/chat/sessions."
- Más grill: "Continuemos grill — observability y test strategy del feedback-widget chat."
