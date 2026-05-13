---
type: decision
title: "LLM turn cap: 5 + early exit"
created: 2026-05-13
updated: 2026-05-13
author: claude-code
source: grill-me-session-1
tags:
  - decision
  - llm
  - ux
  - cost
status: developing
priority: 1
date: 2026-05-13
owner: lehidalgo
related:
  - "[[decisions/_index]]"
---

# D-003: LLM turn cap = 5 + early exit on covered ≥ 0.7

## Status
Accepted (2026-05-13, /grill-me session 1).

## Context
GrillMe-style discovery hace preguntas una por una. Sin cap, el LLM puede entrevistar indefinidamente → fatiga + coste. Cap demasiado bajo → síntesis pobre. El cap define la sensación del producto.

## Decision
**5 turnos máximo backend-enforced**. Early exit cuando `covered.* total ≥ 0.7` (suma normalizada sobre las 8 dimensiones).

Lógica en `chat_service.py`:
```python
if turn_count >= MAX_TURNS or coverage_score >= 0.7:
    force_mode = "synthesize"
```

`MAX_TURNS` env-configurable (`FEEDBACK_CHAT_MAX_TURNS`, default 5).

Cap implementado en código, NO en system prompt. Razón: prompt no es garantía; código sí.

## Alternatives considered
- **A — 3 turnos**: bias agresivo a síntesis. Rechazado por riesgo de síntesis pobre.
- **C — 7 turnos**: mucho margen, mayor abandono. Rechazado.
- **D — Sin cap**: LLM decide. Rechazado por imprevisibilidad y coste.

## Consequences
- System prompt menciona "para en 3-5 turnos" pero NO depende del LLM para cumplirlo.
- Métrica a instrumentar: `turn_count_at_synthesis_p50`, `turn_count_at_synthesis_p95`.
- Si p50 > 4 después de 1 sprint, revisar prompt o bajar el coverage threshold.
- Si abandon rate > 20%, considerar bajar MAX_TURNS a 4.
- Coste estimado: 5 turnos × ~2k tokens entrada × $0.0005/1k (gemini-flash) ≈ $0.005/feedback.

## Evidence
- Audit: hoy submit son 5-8 clics. 5 turnos chat ≈ tiempo similar pero con discovery.
- CHANGELOG iter_service `ITER_MAX_TURNS` ya existe — reusable.
