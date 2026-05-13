---
type: decision
title: "Grilled — Feedback Widget chat-first redesign"
created: 2026-05-13
updated: 2026-05-13
author: claude-code
source: grill-me-session-1
tags:
  - decision
  - grill-me
  - redesign
  - feedback-widget
  - v1.0.0
status: developing
priority: 1
date: 2026-05-13
owner: lehidalgo
related:
  - "[[hot]]"
  - "[[overview]]"
  - "[[decisions/_index]]"
  - "[[flows/_index]]"
  - "[[deliverables/_index]]"
---

# Grilled — Feedback Widget chat-first redesign

## Plan summary

Reemplazar la experiencia form-based del Feedback Widget (5-8 clics + 3 campos) por una **única Sheet conversacional** estilo grill-me: el LLM entrevista al submitter una pregunta por turno, captura voz vía Whisper backend-proxy, y sintetiza el feedback en user story estructurada. Bump a **v1.0.0** en un único PR big-bang. Iter workspace (~9k LOC) se elimina; su plumbing (SSE, idempotency, LLM fallback chain, glossary scrubber) se reutiliza renombrado como `chat_service`.

## Resolved branches

### D-001 — ¿Cómo retiramos el form actual?
**Answer:** v1.0.0 con legacy opt-in. `<FeedbackComposeLegacy/>` exportado deprecado durante 1 release; borrado en v1.1.0.
**Rationale:** Tres hosts (sapphira, capellai-ai-crm, sandbox) ya integrados — escape-hatch baja fricción de migración.
**Detail:** [[2026-05-13_chat-first-replacement-strategy]]

### D-002 — ¿Qué hacemos con Iter (admin)?
**Answer:** Matar Iter completo. Admin refina ticket existente reabriendo el mismo chat con `sessionId` vinculado al `feedback_id`.
**Rationale:** El chat ya produce `synthesis_json` con AC + severidad + contexto; Iter duplicaría la UX.
**Detail:** [[2026-05-13_kill-iter-refine-via-chat]]

### D-003 — ¿Máximo de turnos discovery?
**Answer:** 5 turnos backend-enforced + early exit cuando `covered ≥ 0.7`. Env `FEEDBACK_CHAT_MAX_TURNS`.
**Rationale:** 3 fatiga síntesis pobre; 7 fatiga al usuario; 5 deja margen para 2-3 follow-ups típicos.
**Detail:** [[2026-05-13_llm-turn-cap]]

### D-004 — ¿Proveedor de transcripción?
**Answer:** OpenAI Whisper via backend proxy. `POST /feedback/chat/sessions/{sid}/voice`. Glossary del host se inyecta como `prompt=` de Whisper para mejorar reconocimiento de jerga.
**Rationale:** Brief lo nombra; `iter_llm/openai.py` ya existe; oculta API key; permite redacción server-side.
**Revisión por D-013:** Audio NO se persiste en S3 — se descarta tras transcripción.
**Detail:** [[2026-05-13_whisper-backend-proxy]]

### D-005 — ¿Modalidad de grabación?
**Answer:** Tap-toggle (tap-start, tap-stop) universal mobile + desktop. Auto-stop a 30s y al silencio >3s (configurable).
**Rationale:** PTT mal en clips >5s; toggle es el estándar moderno (ChatGPT, Granola, Notion AI).
**Detail:** [[2026-05-13_voice-toggle-mode]]

### D-006 — ¿Modelo de datos?
**Answer:** Tabla nueva `feedback_chat_session` (source of truth durante la conversación). `feedback` row se crea SOLO al confirm con `synthesis_json` copiado. Migración Alembic no destructiva.
**Rationale:** Drafts abandonados NO contaminan triage list. Audio se asociaba aquí pero D-013 elimina esa parte.
**Detail:** [[2026-05-13_data-model-chat-session]]

### D-007 — ¿Pipeline de screenshot?
**Answer:** Mantener `capture/screenshot.ts` verbatim. Cambia trigger: ahora al abrir el chat (silencioso), no en Submit. Sin pre-vista al usuario. ElementSelector sobrevive como helper sin UI propia.
**Rationale:** Pipeline robusto (html-to-image, redaction overlay, cap 1920×1080×2, S3 upload). Cero código nuevo necesario.
**Detail:** [[2026-05-13_screenshot-pipeline-unchanged]]

### D-008 — ¿`type` y `severity` visibles al submitter?
**Answer:** Oculto al submitter. LLM infiere en silencio y guarda en `synthesis_json.inferred`. Admin edita chips en Triage page.
**Rationale:** Brief: "no obligar a clasificar" + "no usar lenguaje de ingeniería".
**Detail:** [[2026-05-13_metadata-hidden-from-submitter]]

### D-009 — ¿Idioma de respuesta del LLM?
**Answer:** Auto-match al idioma del usuario. Detect en turno 1 (texto) o desde `whisper.language` (voz). Nuevo campo `feedback_chat_session.detected_language`.
**Rationale:** "Experiencia natural" = lengua del usuario. Whisper + Gemini/Claude detectan sin coste extra.
**Detail:** [[2026-05-13_language-auto-match]]

### D-010 — ¿Phasing del rollout?
**Answer:** Big bang single PR. ~5 semanas de trabajo concentrado. v0.7.x → v1.0.0 directo.
**Rationale:** Cleanup + chat + voz interdepended demasiado para fasear sin overhead. Cero rollouts parciales.

### D-011 — ¿Persona del bot?
**Answer:** Voz neutra sin nombre propio. Saludo: "Cuéntame qué tienes en mente."
**Rationale:** Brand-flex; cada host suena consigo mismo; nombre humano suena a chatbot genérico.

### D-012 — ¿Qué hace "Ajustar" en SynthesisCard?
**Answer:** Card se desvanece; bot pregunta "¿Qué cambiarías del resumen?"; user responde texto/voz; LLM regenera synthesis_json; card vuelve.
**Rationale:** "Toda la experiencia dentro del mismo chat" (brief). Conserva el principio conversacional.

### D-013 — ¿TTL del audio en S3?
**Answer:** No persistir. Audio se transcribe y se descarta inmediatamente. Transcript en `messages[].text` es la única fuente.
**Rationale:** Cero footprint S3, GDPR-clean, sin TTL cron. Transcript editable es el escape-hatch.
**Implications:** Revisa D-004 (no `voice_clip` attachment kind) y D-006 (no `audio_attachment_id` en messages).

### D-014 — ¿Continuación de sesión abandonada?
**Answer:** Al cerrar Sheet mid-chat, status → `in_progress`. Indefinido, soft 90d → `abandoned`. Al reabrir Sheet: prompt `[Continuar previa] [Empezar nueva]`.
**Rationale:** Usuario decide; sin TTL hard; multi-session edge → mostrar solo la última.

### D-015 — ¿Aprobamos el system prompt v2 grill-me-shaped?
**Answer:** Verbatim. Instrumentar `turn_count_p50/p95`, `abandon_rate`, manual quality review. Iterar en v1.0.x con señal empírica.
**Rationale:** Prompts ganan refinamiento con datos reales, no a priori. Few-shot examples y A/B se reservan para post-launch si métricas lo piden.
**Prompt completo:** ver sección "Artifact — System Prompt v2" abajo.

## Artifact — System Prompt v2 (aprobado)

```text
Eres un entrevistador de producto entrenado en el método "grill-me":
caminas las ramas del árbol de descubrimiento UNA por UNA, resolviendo
dependencias antes de avanzar, y para cada pregunta PROPONES una respuesta
candidata para que el usuario solo tenga que confirmar o corregir.

Tu trabajo es ayudar al usuario a expresar su feedback sobre la app "{BRAND}".

REGLAS DURAS — sin excepción:
1. UNA sola pregunta por turno. Nunca acumules dos.
2. ≤ 25 palabras por mensaje. Tono cálido, humano, directo.
3. CADA pregunta incluye una respuesta candidata cuando puedas inferirla
   del contexto. Formato sugerido:
     "Parece que [hipótesis]. ¿Es eso, o más bien [alternativa]?"
4. Si puedes RESPONDER explorando el contexto (URL, route, viewport,
   screenshot, user_role, console_tail), HAZLO en silencio. No
   preguntes lo que ya sabes.
5. Nunca uses jerga técnica: prohibido "ticket", "issue", "bug",
   "user story", "criterio de aceptación", "severidad", "release",
   "componente", "endpoint".
6. No pidas que el usuario clasifique nada. Tú clasificas en silencio.
7. Responde SIEMPRE en el idioma del usuario.

ÁRBOL DE DESCUBRIMIENTO (camina en este orden, salta lo ya cubierto):
  rama 1  QUÉ pasó (problema / necesidad / idea)
  rama 2  DÓNDE (pantalla, flujo) — suele inferible del URL
  rama 3  QUÉ ESPERABAS
  rama 4  QUÉ PASÓ REALMENTE
  rama 5  IMPACTO
  rama 6  CAMBIO DESEADO
  hojas opcionales: ejemplo concreto, urgencia

CRITERIO DE CIERRE (chequea cada turno):
- Tienes rama 1 + rama 5 + rama 6 → PUEDES sintetizar.
- Has hecho 5 preguntas de discovery → DEBES sintetizar.
- Usuario dice "ya", "es eso", "listo", "perfecto", "nada más" → cierras.

SALIDA POR TURNO — JSON estricto, sin texto extra:
{
  "mode": "discover" | "synthesize",
  "reply": "<≤25 palabras>",
  "covered": { "problem":0-1, "context":0-1, "expectation":0-1,
               "reality":0-1, "impact":0-1, "change":0-1,
               "example":0-1, "importance":0-1 },
  "active_branch": "1|2|3|4|5|6|leaf",
  "inferred": { "type":"bug|improvement|idea",
                "severity":"blocker|major|minor|idea" },
  "synthesis": null | {
    "title", "summary", "user_story",
    "context", "user_need",
    "acceptance_criteria": [],
    "open_questions": []
  }
}

CONTEXTO TÉCNICO (úsalo, no expongas): url, route, viewport, app_version,
user_role, console_tail, screenshot (multimodal en turno 1).

GLOSARIO DEL PRODUCTO (úsalo SIEMPRE): {GLOSSARY}

PRIMER TURNO: "Cuéntame qué tienes en mente." (sin preguntas)
```

## Pending (cerrar en F1 sin grill)

- **Admin reopen-chat UI contract**: dónde vive el botón en Triage page, qué query param activa el chat con `feedback_id` existente, qué cambia en el system prompt para "modo refinamiento" (si algo).
- **Bindings reduction 10 → 4**: lista concreta de qué se mantiene, qué se fusiona, qué se borra de `FeedbackHostBindings`. Probable: `apiBaseUrl + apiPathPrefix → apiUrl`, eliminar `useCurrentUser + authHeader` duplicidad, mantener `triageRoles`, `extraRedactionSelectors`, `toast`.
- **Backend session timeout / SSE reconnect window**: cuánto espera el SSE consumer antes de reintentar; idempotency-key TTL.
- **Magic-link integration**: probable fuera de v1.0.0 (sigue funcionando como hoy para los flows admin actuales). Confirmar.
- **Per-host customizations**: ¿`bindings.brandName`, `bindings.glossary`, `bindings.forcedLocale`? Mantenerlo mínimo en v1.0.0.

## Risks acordados (sin grill, ya listados en audit original)

- R1 LLM hace demasiadas preguntas → mitigado por D-003 hard-cap 5.
- R2 Whisper traduce mal jerga del producto → mitigado por glossary biasing (D-004).
- R3 Síntesis pobre en feedback trivial → mitigado por early-exit covered≥0.7 (D-003).
- R4 Coste LLM → ~$0.005/feedback con gemini-flash + prompt caching.
- R5 PII en audio → eliminado por D-013 (no persiste).
- R6 Admin echa de menos los 6 tipos → mantener enum, LLM infiere, admin edita (D-008).
- R7 MediaRecorder browser support → Safari iOS 14.5+; fallback mp4 si no webm.
- R8 Ticket_code visible al submitter → nunca (D-008 + chat UX).
- R9 GrillMe puede sonar invasivo → reflejo empático + hard-cap turno 5.
- R10 Backward compat con hosts → mitigado por D-001 legacy opt-in.

## Next session resume hint

> "Sigamos cerrando ramas tácticas del feedback-widget redesign — admin reopen-chat y bindings reduction."

Esto re-abre la rama PENDING. La consolidación de hoy (D-001..D-015) queda firme; futuras sesiones añaden bajo ## Resolved branches sin re-tocar las cerradas.
