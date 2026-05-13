---
type: decision
title: "Voice recording: tap-start/tap-stop toggle"
created: 2026-05-13
updated: 2026-05-13
author: claude-code
source: grill-me-session-1
tags:
  - decision
  - voice
  - ux
status: developing
priority: 2
date: 2026-05-13
owner: lehidalgo
related:
  - "[[2026-05-13_whisper-backend-proxy]]"
---

# D-005: Voice recording = tap-toggle, no push-to-talk

## Status
Accepted (2026-05-13, /grill-me session 1).

## Context
PTT (hold) es natural mobile WhatsApp-style pero rompe en clips >5s y mal en desktop. Toggle es estándar moderno (ChatGPT, Notion AI).

## Decision
- Click mic → empieza grabación → waveform animada en el composer.
- Click otra vez → para, dispara transcripción.
- Auto-stop a 30s hard-cap (D-XXX max-duration).
- Auto-stop opcional al detectar silencio >3s (`MediaRecorder` + `AnalyserNode` RMS threshold). Configurable via env, default ON.

## Alternatives considered
- **B — Push-to-talk**: rechazado por friction en clips largos.
- **C — Híbrido mobile/desktop**: rechazado por dual-code path.
- **D — Voice mode full-screen ChatGPT-style**: bonito pero rompe single-surface chat. Diferido para evaluación futura.

## Consequences
- Componente `VoiceRecorder` con state `idle | recording | stopping`.
- Visual: waveform 5 barras animadas + timer `00:14 / 00:30` + stop circle rojo.
- Permission flow: primera vez pide permiso, si denegado → mic deshabilitado con tooltip "Permite el micrófono en ajustes del navegador".
- En Safari iOS: usar `audio/mp4` fallback si `webm/opus` no soportado.

## Evidence
- ChatGPT, Granola, Notion AI: todos toggle.
- WhatsApp: PTT, pero contexto distinto (mensajería continua, no formularios).
