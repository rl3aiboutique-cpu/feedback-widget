---
type: decision
title: "Replacement strategy: v1.0.0 with legacy opt-in"
created: 2026-05-13
updated: 2026-05-13
author: claude-code
source: grill-me-session-1
tags:
  - decision
  - redesign
  - versioning
status: developing
priority: 1
date: 2026-05-13
owner: lehidalgo
related:
  - "[[decisions/_index]]"
---

# D-001: Replacement strategy — v1.0.0 with legacy opt-in

## Status
Accepted (2026-05-13, /grill-me session 1).

## Context
Tres hosts ya integrados con la API form-based (`Compose`, `FeedbackForm`, `Canvas`, `ElementSelector`):
- sapphira
- capellai-ai-crm
- sandbox-host (interno)

El redesign chat-first es un cambio de UX major. Migration sin escape-hatch aumenta la fricción de adopción.

## Decision
Bump a **v1.0.0**. El chat es el default exportado (`<FeedbackButton/>` ahora abre el chat). El form legacy se sigue exportando como `<FeedbackComposeLegacy/>` durante un release con `console.warn` de deprecación. Borramos en v1.1.0.

## Alternatives considered
- **A — Full removal v1.0.0**: rotura limpia. Rechazada por riesgo de bloquear hosts.
- **C — v0.8.0 feature flag**: convivencia larga, costo de mantener 2 flujos. Rechazada por dilución.
- **D — Fork como paquete nuevo**: 2 productos. Rechazada por overhead.

## Consequences
- Necesitamos `CHANGELOG.md` con migration guide explícita.
- Tests E2E del form legacy se mantienen hasta v1.1.0.
- Bindings reducción (10 → 4) puede esperar a v1.1.0 para no romper junto con la UI.
- Iter workspace para admin queda fuera de esta decisión (ver D-002).

## Evidence
- 3 hosts encontrados en search del repo (sapphira, capellai-ai-crm, sandbox-host).
- ADR-005 ya prescribe distribución por git tags → rollback trivial.
