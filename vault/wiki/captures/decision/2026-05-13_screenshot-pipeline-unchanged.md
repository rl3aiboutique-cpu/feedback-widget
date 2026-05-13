---
type: decision
title: "Screenshot capture pipeline unchanged"
created: 2026-05-13
updated: 2026-05-13
author: claude-code
source: grill-me-session-1
tags:
  - decision
  - capture
  - screenshot
status: developing
priority: 2
date: 2026-05-13
owner: lehidalgo
related:
  - "[[2026-05-13_data-model-chat-session]]"
---

# D-007: Reuse the existing screenshot capture pipeline verbatim

## Status
Accepted (2026-05-13, /grill-me session 1).

## Context
El pipeline actual (`capture/screenshot.ts` + `Compose.tsx:97-108`) ya es robusto:
- `html-to-image` dynamic-imported on demand
- Modos `capturePageScreenshot()` + `captureElementScreenshot(el)`
- Self-exclude del widget via `data-feedback-widget-root="true"`
- Redacción visual con overlay negro temporal (no muta DOM)
- Cap 1920×1080×2px con scaling proporcional
- DPR-aware (`window.devicePixelRatio`)
- Output PNG `{blob, width, height}`
- Sube a S3 como `FeedbackAttachment(kind='screenshot')`

## Decision
Mantener la pipeline tal cual. Sin re-vista al usuario. Sin botón "tomar otro". Sin thumbnail visible.

Lo que SÍ cambia (por contexto, no por pipeline):
- **Trigger**: ya no es click Submit → ahora se dispara al ABRIR el chat (silencioso, antes del greeting del bot).
- **Modo default**: `capturePageScreenshot()` (whole-page). `captureElementScreenshot()` SOBREVIVE como helper pero sin UI propia en el chat — diferido para una posible acción futura "señala dónde".
- **Persistencia**: ahora se asocia a `feedback_chat_session.auto_context.screenshot_attachment_id` (D-006), no a `feedback.id` (que aún no existe hasta el confirm).
- **LLM**: el screenshot se manda al modelo solo en el primer mensaje del usuario, no en cada turno (cost guardrail).

## Alternatives considered
- Thumbnail visible con [✕ Quitar]: rechazado, añade un decisión + un click más.
- Re-screenshot bajo demanda en el chat: rechazado, complica UX por edge case raro.

## Consequences
- Cero código nuevo en `capture/screenshot.ts`.
- `Compose.tsx` lo borraremos (D-001), pero copiamos las 12 líneas que invocan `capturePageScreenshot()` al nuevo `FeedbackChatSheet.tsx` en el `useEffect(onOpen)`.
- ElementSelector queda exportado pero NO se muestra. Marca de borrado en v1.1.0 si no aparece use case.
- LLM provider en `iter_llm/` ya soporta `LLMAttachment` multimodal — reusar sin cambios.

## Evidence
- `screenshot.ts` 230 LOC, sin issues abiertos.
- `iter_packager.py` ya envía screenshots como `LLMAttachment` — pipeline backend-to-LLM ya probada.
