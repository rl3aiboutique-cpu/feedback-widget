---
type: decision
title: "Kill Iter workspace, refine via chat"
created: 2026-05-13
updated: 2026-05-13
author: claude-code
source: grill-me-session-1
tags:
  - decision
  - redesign
  - iter
  - cleanup
status: developing
priority: 1
date: 2026-05-13
owner: lehidalgo
related:
  - "[[2026-05-13_chat-first-replacement-strategy]]"
  - "[[decisions/_index]]"
---

# D-002: Kill Iter workspace, refine via the same chat

## Status
Accepted (2026-05-13, /grill-me session 1).

## Context
`iter/*` actual = ~4.8k LOC frontend + ~4.2k LOC backend. Construido como workspace post-submit para admin (focus mode 800px, tabs spec/diagram/assumptions/chat, EditableSpecPanel).

El chat-first del submitter ya produce `synthesis_json` (user story + AC + severity + contexto). El 90% de lo que Iter hacía YA sucede en el momento del capture.

## Decision
Borrar `iter/*` frontend completo. Backend `iter_service.py` → renombrar a `chat_service.py`, simplificar (mantener: SSE machinery, idempotency, provider fallback chain, glossary scrubber; descartar: state machine `draft→iterating→finalized`, packager con ZIP, EditableSpec versioning).

Admin que necesite refinar un ticket reabre el mismo chat:
- Triage page → botón "Continuar conversación"
- Abre `<FeedbackChatSheet/>` con `sessionId` vinculado al `feedback_id` existente
- El chat añade turnos al hilo, regenera `synthesis_json`
- Cero UI nueva, cero workspace separado

## Alternatives considered
- **B — Mantener Iter como admin-only**: dos UIs para "conversar con AI sobre feedback". Rechazada por duplicación.
- **C — Killear frontend, dejar backend con nombres obsoletos**: dead code en backend. Rechazada por higiene.
- **D — Diferir post-v1.0.0**: riesgo de cargar v1.0.0 con 9k LOC que nadie usa. Rechazada por inercia.

## Consequences
- Phase 4 del plan (cleanup) absorbe la mayoría del borrado.
- Backend renaming: `iter_service.py` → `chat_service.py`, `iter_router.py` → `chat_router.py`, `iter_models.py` se fusiona con `chat_session` tabla nueva.
- Tabla `feedback_iter_*` → migrar datos existentes (si los hay) a nuevo schema o droppear (consultar D-XXX migration).
- `iter_packager.py` con ZIP de handoff: SOBREVIVE pero se mueve a `chat_service.py` como output de finalize, NO como concepto separado.
- Borrado: `iter/IterWorkspace.tsx`, `IterFocusShell.tsx`, `IterFocusView.tsx`, `EditableSpecPanel.tsx`, `SpecTabsPanel.tsx`, `DiagramPanel.tsx`, `AssumptionCard.tsx`, `InlineIterPane.tsx`, `IterContextPanel.tsx`, `ContextDialog.tsx`, `SpecSectionCard.tsx`, `specSectionState.ts`, `IterWorkspace.lazy.tsx`.
- Sobreviven (renombrados): `ChatBubble.tsx`, `useIterRunStream.ts` → `useChatRunStream.ts`, `markdownView.tsx`, `forbiddenWords.ts`.

## Evidence
- Audit: ~9k LOC concentrados en iter; el 80% del repo.
- Backend SSE/idempotency/fallback chain ya funcionan (CHANGELOG v0.4.5/v0.4.6).
- No conocemos hosts que usen Iter en producción más allá de demos.
