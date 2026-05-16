---
type: domain
title: "Components"
created: 2026-05-13
updated: 2026-05-13
tags:
  - domain
  - code
status: seed
subdomain_of: ""
page_count: 0
---

# Components

Componentes UI + hooks reutilizables.

## UI primitives (vendored shadcn — `ui/`)

button, input, select, textarea, sheet, badge, dialog, etc. (ADR-002).

## Hooks

- `useFeedbackAdapter`, `useFeedbackBindings`, `useFeedbackConfig` — context.
- `useCanTriageFeedback` — gate de rol triager.
- `useIterRunStream` — SSE parser (reusable post-redesign).
- `useChatTimeline`, `useIterRunMeta` — internals de iter.

## Chat components (existentes en `iter/`, reutilizables)

- `ChatBubble.tsx` — single message.
- `CopilotChatPanel.tsx` — timeline bidireccional.
- `markdownView.tsx` — render lazy con markdown-it.

## A construir (redesign chat-first)

- `FeedbackChatSheet.tsx` — Sheet derecho + state machine.
- `Composer.tsx` — textarea + mic + send.
- `VoiceRecorder.tsx` — push-to-talk + MediaRecorder.
- `TranscriptionPreview.tsx` — editable post-Whisper.
- `SynthesisCard.tsx` — resumen + user story + confirm.
