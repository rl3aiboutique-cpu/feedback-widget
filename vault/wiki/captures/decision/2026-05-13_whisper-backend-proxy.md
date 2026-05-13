---
type: decision
title: "Transcription: OpenAI Whisper via backend proxy"
created: 2026-05-13
updated: 2026-05-13
author: claude-code
source: grill-me-session-1
tags:
  - decision
  - voice
  - whisper
  - backend
status: developing
priority: 1
date: 2026-05-13
owner: lehidalgo
related:
  - "[[decisions/_index]]"
---

# D-004: Voice transcription via OpenAI Whisper backend proxy

## Status
Accepted (2026-05-13, /grill-me session 1).

## Context
Brief explícito: "Whisper API o equivalente" + transcript editable visible al usuario. Pipeline directo audio→LLM (multimodal Gemini) ahorra hop pero rompe la promesa de "transcript editable" del brief.

## Decision
**Pipeline**: Browser `MediaRecorder` → multipart POST `/feedback/chat/sessions/{sid}/voice` → backend → `openai.audio.transcriptions.create(model="whisper-1", language=hint, prompt=glossary_str)` → guarda audio en S3 → devuelve `{transcript, audio_key, lang}`.

**Stack reuse**:
- `iter_llm/openai.py` SDK existente; añadir helper `transcribe_audio()`.
- `storage/` S3 backend existente; añadir `FeedbackAttachmentKind.VOICE_CLIP`.
- `redaction.py` NO sobre el audio (es binario); SÍ sobre el transcript devuelto.

**Glossary biasing**: `prompt=` parameter de Whisper recibe los términos del host glossary join-eados para mejorar reconocimiento de jerga de producto (ej. "Sapphira", "Capellai").

## Alternatives considered
- **B — Signed-token directo a OpenAI**: -1 hop, +complejidad de seguridad (token expiry, CORS, abuso). Rechazado: la latencia de un hop es <300ms, no es bottleneck.
- **C — Gemini multimodal sin transcript**: rompe brief. Rechazado.
- **D — Deepgram**: nuevo vendor, sin razón fuerte para sumarlo. Rechazado por minimalismo.

## Consequences
- Endpoint nuevo: `POST /feedback/chat/sessions/{sid}/voice` (multipart, ≤30s clip — D-XXX).
- Env nueva: `FEEDBACK_OPENAI_API_KEY` (separada de `ITER_OPENAI_API_KEY` por si el host quiere usar provider distinto para chat vs voz).
- Tabla `feedback_attachment` gana enum value `voice_clip` (migración no destructiva).
- Coste: ~$0.003 × ~30s clip = despreciable. Throttle = mismo rate-limit que el chat.
- Si el host no setea API key, mic queda deshabilitado con tooltip; chat sigue text-only.

## Evidence
- Brief: "Transcribir el audio usando Whisper API o una solución equivalente."
- iter_llm/openai.py ya existe — incremento de superficie mínimo.
- Whisper-1 multilingual coverage incluye español + catalán + portugués (hosts RL3).
