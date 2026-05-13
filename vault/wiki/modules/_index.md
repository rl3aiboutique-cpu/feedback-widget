---
type: domain
title: "Modules"
created: 2026-05-13
updated: 2026-05-13
tags:
  - domain
  - code
status: seed
subdomain_of: ""
page_count: 0
---

# Modules

Mapa de los módulos del repo. Una página por módulo significativo.

## Backend (`packages/feedback-backend/src/feedback_widget/`)

- `models.py` — SQLModel tables (Feedback, FeedbackAttachment, FeedbackComment) + enums.
- `router.py` — FastAPI router factory para `/feedback/*`.
- `service.py` — lógica CRUD + redacción server-side.
- `integration.py` — helper `mount_feedback_widget_for_async_host`.
- `iter_service.py` — state machine LLM (~1.4k LOC).
- `iter_packager.py` — empaqueta contexto para LLM.
- `iter_parser.py` — markdown → structured.
- `iter_scrubber.py` — glossary + forbidden words.
- `iter_llm/` — providers (Gemini, Claude, OpenAI, Fake).
- `alembic/` — migration chain propia (ADR-004).

## Frontend (`packages/feedback-frontend/src/`)

- `FeedbackProvider.tsx` + `adapter.ts` — contrato host.
- `forms/`, `Compose.tsx`, `Canvas.tsx`, `FeedbackPanel.tsx` — UI de submit actual.
- `ElementSelector.tsx` — modo picker.
- `capture/` — telemetría (screenshot, metadata, console, network, errors).
- `iter/` — workspace de iteración LLM (21 archivos, ~4.8k LOC).
- `admin/FeedbackTriagePage.tsx` — vista admin.
- `client/` — SDK HTTP tipado.
- `comments/CommentThread.tsx` — hilo append-only.

## Apps

- `apps/sandbox-host/` — demo + valida extracción + produce OpenAPI.
