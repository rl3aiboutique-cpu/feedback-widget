---
type: decision
title: "LLM responds in user's language (auto-match)"
created: 2026-05-13
updated: 2026-05-13
author: claude-code
source: grill-me-session-1
tags:
  - decision
  - i18n
  - llm
  - ux
status: developing
priority: 2
date: 2026-05-13
owner: lehidalgo
related:
  - "[[2026-05-13_whisper-backend-proxy]]"
---

# D-009: LLM responds in the user's language (auto-detected)

## Status
Accepted (2026-05-13, /grill-me session 1).

## Decision
- **Texto**: LLM detecta idioma del primer mensaje y lo refleja en cada turno. Instrucción en el system prompt: "Responde siempre en el idioma del usuario."
- **Voz**: Whisper devuelve `language` field → se inyecta como hint al LLM en el siguiente turno.
- **Glossary**: el host lo provee en su idioma canónico (ej. inglés). El LLM traduce términos al responder al usuario si su idioma difiere, conservando el término canónico cuando el usuario lo menciona explícitamente.
- **Síntesis JSON**: campos textuales (`title`, `summary`, `user_story`, `acceptance_criteria`) en el idioma del usuario. El admin ve el original; si traduce, lo hace manualmente en triage.

## Alternatives considered
- **B — Forzado al locale del host**: dispar con usuarios multilingüe.
- **C — Auto + override**: posible en v1.1.0 si hosts lo piden; v1.0.0 sin override.
- **D — Limitado a ES+EN**: artificial; el LLM y Whisper soportan más.

## Consequences
- Nuevo campo `feedback_chat_session.detected_language` (string, 2-letter ISO, nullable hasta turno 1).
- Métrica: distribución de idiomas detectados, para entender el mercado del host.
- Edge case: usuario mezcla idiomas (code-switch ES↔EN). LLM elige el dominante del turno; no se penaliza.
- Riesgo bajo: si idioma raro (catalán, euskera, hindi) → LLM puede caer a español/inglés cercano. Aceptable en v1.0.0.

## Evidence
- Whisper-1 retorna `language` field en la API.
- Gemini-flash y Claude detectan idioma sin instrucción explícita.
- Brief: "experiencia natural" implica lengua del usuario.
