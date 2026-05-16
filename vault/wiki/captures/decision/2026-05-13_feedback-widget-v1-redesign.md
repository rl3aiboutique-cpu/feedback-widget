---
type: decision
title: "Feedback Widget v1.0.0 — chat-first redesign (master doc)"
created: 2026-05-13
updated: 2026-05-13
author: claude-code
source: grill-me-sessions-1-and-2
tags:
  - decision
  - grill-me
  - redesign
  - feedback-widget
  - v1.0.0
  - master
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

# Feedback Widget v1.0.0 — chat-first redesign

Master doc consolidando todas las decisiones de las sesiones de /grill-me. Reemplaza los archivos individuales por una única fuente de verdad.

## Plan summary

Reemplazar la experiencia form-based del Feedback Widget (5-8 clics + 3 campos obligatorios) por una **única Sheet conversacional** estilo grill-me. El LLM entrevista al submitter (modo `capture`), graba voz vía Whisper backend-proxy, y sintetiza el feedback en user story estructurada. El admin tiene un modo `refine` separado (prompt distinto) que abre el mismo chat sobre tickets existentes desde la Triage page. Bump a **v1.0.0** en un único PR big-bang. El módulo Iter (~9k LOC) se elimina; su plumbing (SSE, idempotency, LLM fallback chain, glossary scrubber) se reusa renombrado como `chat_service`. Bindings host se mantienen sin cambios — cero migration friction para sapphira/capellai-ai-crm.

Total: **22 decisiones** (D-001..D-022) en 2 sesiones grill (2026-05-13).

## Decisiones

### D-001 — Estrategia de reemplazo

**Answer:** v1.0.0 con legacy opt-in. `<FeedbackComposeLegacy/>` exportado deprecado con `console.warn` durante 1 release. Borrado en v1.1.0.

**Rationale:** Tres hosts ya integrados (sapphira, capellai-ai-crm, sandbox). Escape-hatch baja fricción de migración.

**Alternatives:**
- Full removal v1.0.0 (rotura limpia) — rechazado, bloquea hosts.
- v0.8.0 feature flag — rechazado, convivencia larga.
- Fork como paquete nuevo — rechazado, 2 productos a mantener.

**Consequences:** CHANGELOG con migration guide. Tests E2E del form legacy hasta v1.1.0. Bindings reduction diferida.

### D-002 — Iter workspace (admin)

**Answer:** Matar Iter completo. Frontend: borrar `iter/*` excepto `ChatBubble.tsx`, `useIterRunStream.ts` → `useChatRunStream.ts`, `markdownView.tsx`, `forbiddenWords.ts`. Backend: `iter_service.py` → `chat_service.py`, simplificado. Admin refina via `<FeedbackChatSheet/>` reabierto con `mode='refine'` + `feedback_id`.

**Rationale:** El chat ya produce `synthesis_json` con AC + severidad + contexto. Iter duplicaría la UX. ~9k LOC ganados.

**Borrar:** `IterWorkspace.tsx`, `IterFocusShell/View.tsx`, `EditableSpecPanel.tsx`, `SpecTabsPanel.tsx`, `DiagramPanel.tsx`, `AssumptionCard.tsx`, `InlineIterPane.tsx`, `IterContextPanel.tsx`, `ContextDialog.tsx`, `SpecSectionCard.tsx`, `specSectionState.ts`, `IterWorkspace.lazy.tsx`.

### D-003 — Hard-cap de turnos LLM

**Answer:** 5 turnos backend-enforced + early exit cuando `covered_total ≥ 0.7` (suma normalizada sobre 8 dimensiones). Env `FEEDBACK_CHAT_MAX_TURNS`.

**Rationale:** 3 → síntesis pobre. 7 → fatiga usuario. 5 → margen para 2-3 follow-ups típicos. Cap en código, NO en prompt (más fiable).

**Métricas:** `turn_count_at_synthesis_p50`, `turn_count_at_synthesis_p95`. Si p50 > 4 en 1 sprint → revisar prompt. Si abandon > 20% → bajar a 4.

**Coste:** ~5 turnos × ~2k tokens × $0.0005/1k (gemini-flash) ≈ $0.005/feedback.

### D-004 — Voice transcription

**Answer:** **OpenAI Whisper via backend proxy**. Pipeline: Browser `MediaRecorder` → multipart `POST /feedback/chat/sessions/{sid}/voice` → backend → `openai.audio.transcriptions.create(model="whisper-1", language=hint, prompt=glossary)` → devuelve `{transcript, lang}` al cliente.

**Rationale:** Brief explícito. `iter_llm/openai.py` ya existe. Oculta API key. Permite redacción server-side.

**Glossary biasing:** `prompt=` parameter recibe términos del host glossary join-eados → mejor reconocimiento de jerga.

**Env:** `FEEDBACK_OPENAI_API_KEY` (separada de la key de chat para flexibilidad). Si no se setea → mic deshabilitado con tooltip.

**Revisado por D-013:** Audio NO se persiste en S3 — se descarta tras transcripción.

### D-005 — Modalidad grabación voz

**Answer:** Tap-toggle (tap-start, tap-stop) universal mobile + desktop. Auto-stop a 30s hard-cap. Auto-stop al silencio >3s (configurable, default ON).

**Rationale:** PTT mal en clips >5s. Toggle es estándar moderno (ChatGPT, Granola, Notion AI).

**Componente `VoiceRecorder`** estados: `idle | recording | stopping`. Visual: waveform 5 barras + timer `00:14/00:30` + stop circle rojo. Safari iOS: fallback `audio/mp4` si `webm/opus` no soportado.

### D-006 — Modelo de datos

**Answer:** Nueva tabla `feedback_chat_session` como source of truth durante la conversación. `feedback` row se crea SOLO al confirm.

```sql
CREATE TABLE feedback_chat_session (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    user_id         UUID NOT NULL,
    mode            chat_session_mode NOT NULL DEFAULT 'capture',  -- capture | refine
    status          chat_session_status NOT NULL DEFAULT 'open',
                    -- open | in_progress | synthesizing | awaiting_confirm | confirmed | abandoned
    messages        JSONB NOT NULL DEFAULT '[]'::jsonb,
    synthesis_json  JSONB,
    auto_context    JSONB NOT NULL,
    feedback_id     UUID REFERENCES feedback(id) ON DELETE CASCADE,
    glossary_snapshot JSONB,
    detected_language VARCHAR(8),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at    TIMESTAMPTZ,
    abandoned_at    TIMESTAMPTZ
);

CREATE INDEX ON feedback_chat_session (tenant_id, user_id, status);
CREATE INDEX ON feedback_chat_session (feedback_id) WHERE feedback_id IS NOT NULL;

ALTER TABLE feedback ADD COLUMN chat_session_id UUID REFERENCES feedback_chat_session(id);
ALTER TABLE feedback ADD COLUMN synthesis_json JSONB;
ALTER TABLE feedback ADD COLUMN severity feedback_severity;  -- D-008
```

**Rationale:** Drafts abandonados NO contaminan triage list. Multi-tenancy: `tenant_id` mirroreado → RLS gemela. Migración Alembic NO destructiva (ADR-004).

### D-007 — Pipeline screenshot

**Answer:** Mantener `capture/screenshot.ts` verbatim. Cambios solo de trigger/uso:
- Trigger: al ABRIR el chat (silencioso, antes del greeting), no en Submit.
- Modo default: `capturePageScreenshot()`. `ElementSelector` sobrevive como helper sin UI propia en el chat.
- Persistencia: en `feedback_chat_session.auto_context.screenshot_attachment_id`.
- LLM: se manda al modelo SOLO en el primer mensaje del usuario, no cada turno.
- Sin pre-vista al usuario.

**Rationale:** Pipeline robusto (html-to-image, redaction overlay, cap 1920×1080×2, DPR-aware, S3 upload). Cero código nuevo.

### D-008 — Type / severity visibles al submitter

**Answer:** Oculto al submitter. LLM infiere `type` (bug | improvement | idea) y `severity` (blocker | major | minor | idea) en silencio y guarda en `synthesis_json.inferred`. Admin edita chips en Triage page.

**Rationale:** Brief: "no obligar a clasificar" + "no usar lenguaje de ingeniería".

**Schema:** `feedback.severity` nullable enum + Triage page con dropdowns para `type` y `severity`. Si admin cambia, `synthesis_json` queda intacto como registro original.

**Métrica futura:** % de tickets donde admin cambia type/severity → señal de calidad del prompt.

### D-009 — Idioma de respuesta del LLM

**Answer:** Auto-match al idioma del usuario. Detect en turno 1 (texto) o desde `whisper.language` (voz). Glossary se mantiene en idioma canónico del host; LLM traduce términos al responder. Síntesis en idioma del usuario.

**Rationale:** "Experiencia natural" = lengua del usuario. Whisper + Gemini/Claude detectan sin coste extra.

**Schema:** `feedback_chat_session.detected_language` (string, 2-letter ISO, nullable hasta turno 1).

**Edge:** code-switch ES↔EN → LLM elige dominante del turno. Catalán/euskera/hindi → cae a español/inglés cercano (aceptable v1.0.0).

### D-010 — Phasing del rollout

**Answer:** **Big bang single PR**. ~5 semanas de trabajo concentrado. v0.7.x → v1.0.0 directo. Sin rollouts parciales.

**Rationale:** Cleanup + chat + voz interdependen demasiado para fasear sin overhead.

### D-011 — Persona del bot

**Answer:** Voz neutra sin nombre propio. Saludo: "Cuéntame qué tienes en mente."

**Rationale:** Brand-flex. Cada host suena consigo mismo. Nombre humano suena a chatbot genérico.

### D-012 — Botón "Ajustar" en SynthesisCard

**Answer:** Card se desvanece. Bot mensaje: "¿Qué cambiarías del resumen?". User responde texto/voz. LLM regenera `synthesis_json`. Card vuelve con nueva versión.

**Rationale:** "Toda la experiencia dentro del mismo chat" (brief). Conserva principio conversacional.

### D-013 — TTL del audio en S3

**Answer:** **No persistir**. Audio se transcribe y se descarta inmediatamente. Transcript en `messages[].text` es la única fuente.

**Rationale:** Cero footprint S3. GDPR-clean. Sin TTL cron. Transcript editable es el escape-hatch.

**Implications:** Revisa D-004 (no `voice_clip` attachment kind necesario), D-006 (no `audio_attachment_id` en messages).

### D-014 — Continuación de sesión abandonada

**Answer:** Al cerrar Sheet mid-chat, status → `in_progress`. Indefinido (soft 90d → `abandoned`). Al reabrir Sheet: backend chequea sesiones `in_progress` del user → frontend muestra prompt `[Continuar previa] [Empezar nueva]`. Si "nueva", la previa queda como `in_progress` indefinida.

**Rationale:** Usuario decide. Sin TTL hard. Multi-session edge → mostrar solo la última.

### D-015 — System prompt v2 (capture mode)

**Answer:** Verbatim. Instrumentar `turn_count_p50/p95`, `abandon_rate`, manual quality review. Iterar en v1.0.x con señal empírica.

**Rationale:** Prompts ganan refinamiento con datos reales, no a priori.

**Prompt completo:**

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

### D-016 — Admin reopen-chat: nueva sesión vs reopen

**Answer:** Nueva `feedback_chat_session(mode='refine', feedback_id=$fid)` cada refinamiento. Histories acotadas. `feedback.synthesis_json` se reemplaza al confirm. Sesiones previas quedan como audit trail.

**Rationale:** Sesiones acotadas evitan que se inflen. Múltiples ciclos de refinamiento son normales.

### D-017 — System prompt en refine mode

**Answer:** Prompt **separado** para refine. Backend selecciona según `session.mode`. Refine permite jerga técnica, primer turno muestra synthesis + pregunta "¿qué quieres ajustar?".

**Rationale:** Admin no es submitter. KPIs distintos. Dos prompts ~80 LOC extra es coste irrelevante vs claridad.

**Refine prompt — esqueleto:**

```text
Eres un asistente que ayuda a un admin de producto a refinar
una síntesis de feedback existente.

CONTEXTO:
synthesis_actual = { ... synthesis_json ... }
chat_original_completo = [ ... messages[] del capture session ... ]   # D-019

REGLAS:
1. Primer turno: muestra el title + user_story actuales en una
   frase, y pregunta "¿qué quieres ajustar?".
2. El admin habla en jerga de producto. Tú también puedes.
3. Una pregunta por turno cuando necesites info. Si el cambio es
   evidente, ejecuta directo y muestra el diff.
4. Salida JSON con synthesis_new + diff_summary.
```

### D-018 — Botón "Refinar" en Triage

**Answer:** Top bar del detail page: `[Refinar con AI]`. Synthesis card permanece read-only. Click → abre `FeedbackChatSheet` con `mode='refine'` + `feedback_id`.

**Rationale:** Acción ocasional, no constante. Card limpia.

### D-019 — Contexto del capture visible al LLM en refine

**Answer:** `synthesis_json` + **chat completo** del capture session (todos los `messages[]`).

**Rationale:** Máximo contexto del flow original. Coste LLM ~3x vs solo synthesis, aceptado por trade-off de fidelidad.

### D-020 — Bindings reduction

**Answer:** **Sin cambios** en v1.0.0. `FeedbackHostBindings` shape actual se conserva (10 campos). Reduction diferida a v2.0.0.

**Rationale:** Cero migration friction para hosts. v1.0.0 ya carga con chat + voz + iter cleanup; cambio de API añade riesgo sin valor inmediato.

### D-021 — SSE reconnect + idempotency TTL

**Answer:** Browser default `EventSource` auto-reconnect (~3s) + backend idempotency-key cache 1h.

**Rationale:** Reusa machinery de `iter_service.py`. Cubre 99% casos. Backend re-emite desde último chunk persistido.

### D-022 — Magic-link en v1.0.0

**Answer:** Out of scope. Magic-link sigue solo para emails admin (status-change, refine-done). Chat usa auth normal del host (`useCurrentUser`).

**Rationale:** Cero código nuevo. Submitter chat se accede vía sesión web autenticada.

## Schema de datos del feedback resultante (`synthesis_json`)

```jsonc
{
  "title": "<≤80 chars, lenguaje del usuario>",
  "summary": "<2-3 frases>",
  "user_story": "Como <rol>, quiero <necesidad>, para <beneficio>.",
  "context": "<dónde y cuándo>",
  "user_need": "<qué busca conseguir>",
  "acceptance_criteria": ["criterio 1", "criterio 2"],
  "open_questions": [],
  "inferred": {
    "type": "bug|improvement|idea",
    "severity": "blocker|major|minor|idea"
  },
  "raw": {
    "user_first_message": "...",
    "voice_transcripts": ["..."],   // texto, no audio (D-013)
    "transcript_lang": "es"
  }
}
```

## Endpoints (backend)

```
POST   /feedback/chat/sessions
       body: { mode: "capture" | "refine", feedback_id?: uuid,
               auto_context: {url, route, viewport, app_version, console_tail},
               screenshot: <file> }
       returns: { session_id, greeting }

POST   /feedback/chat/sessions/{sid}/messages            (SSE)
       body: { content: string, via: "text" | "voice" }
       Idempotency-Key: <uuid>
       SSE events: "delta" | "turn_done" | "synthesizing" |
                   "synthesis" | "error" | "provider_fallback"

POST   /feedback/chat/sessions/{sid}/voice               (multipart)
       body: audio file (webm/opus, ≤30s)
       returns: { transcript, lang }
       NOTE: audio descartado tras transcripción (D-013)

POST   /feedback/chat/sessions/{sid}/confirm
       body: { synthesis_override?: {...} }
       returns: { feedback_id, ticket_code }

POST   /feedback/chat/sessions/{sid}/abandon

GET    /feedback/chat/sessions/in-progress
       returns: [{session_id, last_message_preview, updated_at}, ...]
       used: reopen prompt UI (D-014)
```

## State machine del chat

```
idle → opening → awaiting_user → user_typing | recording
recording → transcribing → editable_preview → user confirms
awaiting_user → bot_thinking → (has_more_questions → awaiting_user)
                              → (enough_signal → synthesizing → confirming)
confirming → adjust → awaiting_user
confirming → confirm → finalizing → done
```

Cross-cutting: `error` con retry. `abandoned` desde cualquier estado.

## Risks acordados

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | LLM hace demasiadas preguntas | D-003 hard-cap 5 |
| R2 | Whisper traduce mal jerga | D-004 glossary biasing |
| R3 | Síntesis pobre en feedback trivial | D-003 early-exit covered≥0.7 |
| R4 | Coste LLM | gemini-flash + prompt caching ≈ $0.005/feedback |
| R5 | PII en audio | D-013 no persiste |
| R6 | Admin echa de menos 6 tipos | D-008 admin edita libremente |
| R7 | MediaRecorder browser support | Safari iOS 14.5+ fallback mp4 |
| R8 | Ticket_code visible al submitter | nunca (D-008 + chat UX) |
| R9 | GrillMe puede sonar invasivo | reflejo empático + hard-cap turno 5 |
| R10 | Backward compat hosts | D-001 legacy opt-in + D-020 bindings unchanged |

## Pending (no bloqueante, futuras grill sessions opcionales)

- Métricas / observability concretas (Prometheus counters, log structure).
- Error handling LLM JSON malformed (rep loops, fallback prompt).
- Test strategy (unit vs integration vs E2E playwright).
- Migration guide doc para sapphira / capellai-ai-crm.
- Bindings reduction concreta (diferida a v2.0.0 per D-020).

## Resume hint

> "Vamos a por F1 implementación del feedback-widget redesign — empieza con la migración Alembic + el endpoint POST /feedback/chat/sessions."

O para más grill:

> "Continuemos grill — observability y test strategy del feedback-widget chat."
