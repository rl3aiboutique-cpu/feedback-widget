---
type: decision
title: "Type and severity hidden from submitter, admin-only"
created: 2026-05-13
updated: 2026-05-13
author: claude-code
source: grill-me-session-1
tags:
  - decision
  - ux
  - llm
  - inference
status: developing
priority: 2
date: 2026-05-13
owner: lehidalgo
related:
  - "[[2026-05-13_chat-first-replacement-strategy]]"
---

# D-008: Inferred type/severity hidden from submitter; admin can edit in Triage

## Status
Accepted (2026-05-13, /grill-me session 1).

## Context
Brief explícito: "no obligar al usuario a clasificar feedback manualmente" + "no usar lenguaje de tickets, issues, severity". El LLM infiere `type` (bug/improvement/idea) + `severity` (blocker/major/minor/idea) — pero ese vocabulario es de triage, no del usuario.

## Decision
- `SynthesisCard` NO muestra chips de `type` ni `severity`.
- LLM los infiere y los guarda en `synthesis_json.inferred.{type, severity}`.
- Triage page los muestra como chips editables al admin.
- Si el admin cambia algo, `feedback.type` y un nuevo campo `feedback.severity` se actualizan; `synthesis_json` queda intacto como registro original.

## Alternatives considered
- **B — Visible read-only al submitter**: añade jerga al brief, rechazada.
- **C — Visible editable**: rompe el principio, rechazada.
- **D — Mostrar solo si baja confianza**: más código + edge cases; el admin ya hace QA en triage. Rechazada por simplicidad.

## Consequences
- `feedback` gana columna `severity` (nullable, enum) en la misma migración que `synthesis_json` (D-006).
- Triage page necesita 2 dropdowns nuevos (type, severity) inline en el detail view.
- No hay UI de inference confidence — el admin asume que puede equivocarse y edita libremente.
- Métrica futura: % de tickets donde admin cambia type/severity (señal de calidad del prompt).

## Evidence
- Brief sections: "No mostrar formularios largos", "No pedir campos técnicos", "No obligar al usuario a clasificar".
- Hoy `FeedbackType` enum visible al usuario como dropdown de 6 opciones — esto es exactamente lo que el brief quiere eliminar.
