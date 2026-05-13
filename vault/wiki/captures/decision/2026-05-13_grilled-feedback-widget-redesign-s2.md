---
type: decision
title: "Grilled — Feedback Widget chat-first redesign (s2: pending táctico)"
created: 2026-05-13
updated: 2026-05-13
author: claude-code
source: grill-me-session-2
tags:
  - decision
  - grill-me
  - redesign
  - feedback-widget
  - v1.0.0
  - tactical
status: developing
priority: 1
date: 2026-05-13
owner: lehidalgo
related:
  - "[[2026-05-13_grilled-feedback-widget-redesign]]"
  - "[[hot]]"
---

# Grilled — Feedback Widget chat-first redesign (sesión 2)

## Plan summary

Sesión 2 cierra las **5 ramas pending tácticas** que quedaron de la sesión 1: admin reopen-chat (subtree completo), bindings reduction, SSE reconnect, magic-link scope, per-host customizations. 7 decisiones (D-016..D-022). Combinado con sesión 1: **22 decisiones totales**. F1 ready to start.

## Resolved branches

### D-016 — Admin reopen-chat: ¿nueva sesión o reopen del original?
**Answer:** Nueva `feedback_chat_session` cada refinamiento, vinculada por `feedback_id`. Histories acotadas; `feedback.synthesis_json` se reemplaza al confirm; sesiones previas quedan como audit trail.
**Rationale:** Sesiones acotadas en tiempo evitan que se inflen a miles de mensajes. Múltiples ciclos de refinamiento son normales.

### D-017 — System prompt: ¿mismo o separado para refine?
**Answer:** Prompt separado **refine mode**. Backend selecciona según `session.mode` (`capture` | `refine`). Refine permite jerga técnica, primer turno muestra synthesis + pregunta "¿qué quieres ajustar?".
**Rationale:** Admin no es submitter. KPIs distintos. Mantener dos prompts ~80 LOC extra es coste irrelevante vs claridad de comportamiento.

### D-018 — UI: ¿dónde el botón "Refinar"?
**Answer:** Top bar del detail page en Triage: `[Refinar con AI]`. Synthesis card permanece read-only. Click → abre `FeedbackChatSheet` con `mode='refine'` + `feedback_id`.
**Rationale:** Acción ocasional, no constante. Card limpia.

### D-019 — Refine: ¿qué contexto del capture ve el LLM?
**Answer:** synthesis_json + chat **completo** del capture session (todos los `messages[]`).
**Rationale:** Máximo contexto del flow original. Coste LLM ~3x vs solo synthesis, aceptado por trade-off de fidelidad.
**Note:** Inicialmente recomendé synthesis + primer mensaje raw (B); el usuario cambió a C para maximizar contexto.

### D-020 — Bindings reduction 10 → ?
**Answer:** Sin cambios en v1.0.0. Bindings shape actual se conserva. Reduction diferida a v2.0.0.
**Rationale:** Cero migration friction para hosts (sapphira, capellai-ai-crm). v1.0.0 ya carga con chat + voz + iter cleanup; un cambio de API añade riesgo sin valor inmediato.

### D-021 — SSE reconnect + idempotency TTL
**Answer:** Browser default `EventSource` auto-reconnect (~3s) + backend idempotency-key cache 1h.
**Rationale:** Reusa machinery existente de `iter_service.py`. Cubre 99% de casos (tab durmiendo, network blip, refresh). Backend re-emite desde último chunk persistido.

### D-022 — Magic-link en v1.0.0
**Answer:** Out of scope. Magic-link sigue solo para emails admin (status-change, refine-done). Chat usa auth normal del host (`useCurrentUser`).
**Rationale:** Cero código nuevo. Submitter chat se accede vía sesión web autenticada, no necesita link.

## Pending

Nada bloqueante. F1 ready to start. Futuras grill sessions opcionales:

- Métricas / observability concretas (Prometheus counters, log structure).
- Error handling LLM JSON malformed (rep loops, fallback prompt).
- Test strategy (unit vs integration vs E2E playwright).
- Migration guide doc para sapphira / capellai-ai-crm.

## Combined decision index (sesiones 1 + 2)

| ID | Decisión | Doc |
|---|---|---|
| D-001 | v1.0.0 legacy opt-in | [[2026-05-13_chat-first-replacement-strategy]] |
| D-002 | Kill Iter, refine via chat | [[2026-05-13_kill-iter-refine-via-chat]] |
| D-003 | LLM turn cap 5 + early exit | [[2026-05-13_llm-turn-cap]] |
| D-004 | Whisper backend proxy | [[2026-05-13_whisper-backend-proxy]] |
| D-005 | Voice tap-toggle | [[2026-05-13_voice-toggle-mode]] |
| D-006 | chat_session table | [[2026-05-13_data-model-chat-session]] |
| D-007 | Screenshot pipeline unchanged | [[2026-05-13_screenshot-pipeline-unchanged]] |
| D-008 | type/severity admin-only | [[2026-05-13_metadata-hidden-from-submitter]] |
| D-009 | Language auto-match | [[2026-05-13_language-auto-match]] |
| D-010 | Big bang single PR | (s1 consolidated) |
| D-011 | Voz neutra persona | (s1 consolidated) |
| D-012 | Ajustar = back to chat | (s1 consolidated) |
| D-013 | No persistir audio | (s1 consolidated) |
| D-014 | Resume in_progress indefinite | (s1 consolidated) |
| D-015 | System prompt v2 verbatim | (s1 consolidated) |
| D-016 | New session per refine | (s2) |
| D-017 | Separate refine prompt | (s2) |
| D-018 | Top bar [Refinar AI] button | (s2) |
| D-019 | Refine context = synthesis + full chat | (s2) |
| D-020 | Bindings unchanged v1.0.0 | (s2) |
| D-021 | SSE defaults + 1h idempotency | (s2) |
| D-022 | Magic-link out of scope | (s2) |

## Next session resume hint

> "Vamos a por F1 implementación del feedback-widget redesign — empieza con la migración Alembic + el endpoint POST /feedback/chat/sessions."

O si surgen ramas nuevas:

> "Continuemos grill — observability concreta y test strategy del feedback-widget chat."
