---
type: rule
created: 2026-05-13
author: claude-code
source: brainstorming-feedback-widget-v1
tags:
  - implementation
  - principle
  - cleanup
---

# Reuse existing code maximally; optimize only what is broken

**Rule:** Cuando implementes el redesign chat-first (D-001..D-022 — ver [[2026-05-13_feedback-widget-v1-redesign]]), reusa al máximo el código existente. Solo optimiza/refactoriza lo que ESTÉ MAL y necesite arreglo. No reescribas por estética ni por modernización gratuita.

**Why:** El audit del feedback-widget mostró que el plumbing existente (SSE en `iter_service.py`, LLM provider chain con fallback, idempotency, `iter_scrubber`, `iter_parser`, redaction, `capture/screenshot.ts`) es robusto y probado en producción. Reemplazarlo por código nuevo introduce regresiones donde no hay valor. El big-bang PR (D-010) ya carga 5 sem de trabajo; cualquier refactor opcional infla scope.

**How to apply:**
- Renombrar `iter_*` → `chat_*` con copy-paste, NO reescritura.
- Reusar `useIterRunStream` → `useChatRunStream` con cambios mínimos.
- Mantener `screenshot.ts` y `capture/metadata.ts` verbatim (D-007).
- Bindings unchanged (D-020).
- Si encuentras código que ESTÉ MAL (bug, race condition, anti-patrón claro): arregla y documenta por qué.
- Refactor cosmético / "podría ser más limpio" → NO. Diferir a v1.1.0+.

**Scope:** Implementación de v1.0.0 feedback-widget redesign.
