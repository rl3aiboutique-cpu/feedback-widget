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
2026-05-13. S1 (Schema + sessions endpoint) IMPLEMENTED. Demo gate passed.

## Key Recent Facts
- Redesign chat-first del Feedback Widget en marcha. v1.0.0 big-bang PR, ~5 sem.
- S1 done: migration 0007 + chat_models + chat_schemas + chat_service + chat_router + wiring (__init__, integration, sandbox-host main, conftest).
- 13 archivos staged, 1231 LOC, 14 nuevos tests (10 unit + 4 integration chat-specific).
- Single commit por fase (Iron Law 7 + user preference D-commit-end-of-flow).

## Decisión master
- [[2026-05-13_feedback-widget-v1-redesign]] — todas las 22 decisiones consolidadas.

## Active Threads
- S1 IMPLEMENTED, esperando commit final con user `ok` (Iron Law 7).
- Next: S2 (LLM messages SSE) → generar plan via writing-plans skill cuando S1 commiteado.

## Pendientes infra (no bloquean S1)
- `_truncate_each_test` ahora incluye `feedback_chat_session` (S1 fix).
- Env-leak bug pre-existing: `tests/integration/conftest.py:75` setea `FEEDBACK_MULTI_TENANT_MODE=false` global → contamina unit `test_defaults_are_safe`. No es regresión, no de S1 scope.
- DuplicateTable cross-session (iter_*, chat_*): el `_migrate_once` teardown solo dropea 4 tablas legacy. Pre-existing limitación; cleanup en S7 cuando borremos iter_*.

## Resume hints
- Implementación: "Sigue con S2 — plan via writing-plans + LLM messages SSE."
- Más grill: "Continuemos grill — observability y test strategy del feedback-widget chat."
