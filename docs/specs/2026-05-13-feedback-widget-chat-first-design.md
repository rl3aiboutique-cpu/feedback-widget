# Feedback Widget v1.0.0 — chat-first redesign

- **Date**: 2026-05-13
- **Document**: 2026-05-13-feedback-widget-chat-first-design.md
- **Category**: SPEC
- **Status**: Approved (brainstorming complete)
- **Source**: 22 grilled decisions in [`vault/wiki/captures/decision/2026-05-13_feedback-widget-v1-redesign.md`](../../vault/wiki/captures/decision/2026-05-13_feedback-widget-v1-redesign.md)

## Overview

Reemplazar la experiencia form-based del Feedback Widget (5-8 clics + 3 campos obligatorios) por una **única Sheet conversacional** estilo grill-me. El LLM entrevista al submitter (modo `capture`), graba voz vía Whisper backend-proxy, y sintetiza el feedback en user story estructurada. El admin tiene un modo `refine` separado que reabre el mismo chat sobre tickets existentes. Bump a **v1.0.0** en un único PR big-bang.

**Implementation principle:** Reusar al máximo el código existente; optimizar solo lo que esté mal. Ver [`vault/wiki/captures/rule/reuse-existing-code.md`](../../vault/wiki/captures/rule/reuse-existing-code.md).

## Architecture

```
                    ┌─ Host app ─────────────────────────────────┐
                    │                                            │
   click 💬 ────────┼───► <FeedbackChatSheet/>                   │
                    │       ├─ Composer (text + mic)             │
                    │       ├─ ChatTimeline (bubbles + synth)    │
                    │       └─ state machine via useFeedbackChat │
                    │                │                           │
                    │                ▼ HTTP/SSE                  │
   /api/v1/feedback/chat/* ◄────────┘                            │
                    │                │                           │
                    │     chat_service.py (was iter_service.py)  │
                    │       ├─ build prompt (capture | refine)   │
                    │       ├─ LLM provider chain (existing)     │
                    │       ├─ parser + scrubber (existing)      │
                    │       └─ persist messages JSONB            │
                    │                │                           │
                    │   Postgres: feedback_chat_session + RLS    │
                    │   Whisper proxy → OpenAI (no audio persist)│
                    └────────────────────────────────────────────┘
```

**Reused as-is:**
- SSE streaming machinery (`iter_service.py`)
- LLM provider chain with fallback (`iter_llm/`) — Gemini, Claude, OpenAI, Fake
- Idempotency-Key cache (1h TTL)
- Glossary scrubber (`iter_scrubber.py`)
- Output parser with repair-hint loop (`iter_parser.py`)
- Server-side redaction (`redaction.py`)
- Screenshot pipeline (`capture/screenshot.ts` + html-to-image + redaction overlay)
- Metadata capture (`capture/metadata.ts`)
- FeedbackProvider + adapter contract (`FeedbackProvider.tsx`, `adapter.ts`)
- Multi-tenancy with RLS (`tenant_id` mirroring)

**New code:**
- `<FeedbackChatSheet/>` + Composer + VoiceRecorder + TranscriptionPreview + SynthesisCard + state machine (~600 LOC frontend)
- Whisper proxy endpoint (~100 LOC backend)
- New Alembic migration: `feedback_chat_session` table + `feedback.synthesis_json` + `feedback.severity`
- Refine-mode system prompt (~80 LOC text)

**Discarded:**
- `Compose.tsx`, `Canvas.tsx`, `FeedbackPanel.tsx`, `forms/FeedbackForm.tsx`, `forms/AttachmentsField.tsx`, `ElementSelector.tsx`, `MyTicketsPanel.tsx`
- `iter/*` workspace UI (12 components, ~4.5k LOC)
- 6 `FeedbackType` enum values stay in DB but UI never exposes them

## Data model

```sql
-- Migration: non-destructive, appended to widget's Alembic chain (ADR-004).

CREATE TYPE chat_session_mode AS ENUM ('capture', 'refine');
CREATE TYPE chat_session_status AS ENUM (
    'open', 'in_progress', 'synthesizing', 'awaiting_confirm',
    'confirmed', 'abandoned'
);
CREATE TYPE feedback_severity AS ENUM ('blocker', 'major', 'minor', 'idea');

CREATE TABLE feedback_chat_session (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL,
    user_id             UUID NOT NULL,
    mode                chat_session_mode NOT NULL DEFAULT 'capture',
    status              chat_session_status NOT NULL DEFAULT 'open',
    messages            JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- shape: [{role: "user"|"assistant", ts, text, via?: "text"|"voice",
    --          mode?: "discover"|"synthesize", covered?: {...},
    --          active_branch?: "1..6|leaf", inferred?: {...}}]
    synthesis_json      JSONB,
    auto_context        JSONB NOT NULL,
    -- shape: {url, route, viewport, app_version, console_tail,
    --         screenshot_attachment_id, user_role, git_commit_sha}
    feedback_id         UUID REFERENCES feedback(id) ON DELETE CASCADE,
    glossary_snapshot   JSONB,
    detected_language   VARCHAR(8),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at        TIMESTAMPTZ,
    abandoned_at        TIMESTAMPTZ
);

CREATE INDEX ON feedback_chat_session (tenant_id, user_id, status);
CREATE INDEX ON feedback_chat_session (feedback_id) WHERE feedback_id IS NOT NULL;

ALTER TABLE feedback ADD COLUMN chat_session_id UUID REFERENCES feedback_chat_session(id);
ALTER TABLE feedback ADD COLUMN synthesis_json JSONB;
ALTER TABLE feedback ADD COLUMN severity feedback_severity;

-- RLS: gemela a la policy existente de feedback table, filtra por tenant_id.
```

### `synthesis_json` shape

```jsonc
{
  "title": "<≤80 chars, idioma del usuario>",
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
    "voice_transcripts": ["..."],
    "transcript_lang": "es"
  }
}
```

## API endpoints

```
POST   /api/v1/feedback/chat/sessions
       body: { mode: "capture" | "refine", feedback_id?: uuid,
               auto_context: {url, route, viewport, app_version, console_tail},
               screenshot?: <multipart file> }
       returns: { session_id, greeting, resume_available?: bool }

POST   /api/v1/feedback/chat/sessions/{sid}/messages          (SSE)
       body: { content: string, via: "text" | "voice" }
       Idempotency-Key: <uuid>
       SSE events: "delta" | "turn_done" | "synthesizing" |
                   "synthesis" | "error" | "provider_fallback"

POST   /api/v1/feedback/chat/sessions/{sid}/voice              (multipart)
       body: audio file (webm/opus, ≤30s)
       returns: { transcript, lang }
       NOTE: audio is discarded after transcription (D-013)

POST   /api/v1/feedback/chat/sessions/{sid}/confirm
       body: { synthesis_override?: {...} }
       returns: { feedback_id, ticket_code }

POST   /api/v1/feedback/chat/sessions/{sid}/abandon

GET    /api/v1/feedback/chat/sessions/in-progress
       returns: [{session_id, last_message_preview, updated_at}, ...]
```

## State machine (frontend)

```
idle ──click 💬──► opening ──capture screenshot+metadata──► awaiting_user
awaiting_user ──text typed──► user_typing ──send──► bot_thinking
awaiting_user ──mic toggle──► recording ──toggle──► transcribing
                                                       │
transcribing ──Whisper resp──► editable_preview ──send──► bot_thinking
bot_thinking ──SSE deltas──► (more_qs → awaiting_user) | (enough → synthesizing)
synthesizing ──synth ready──► confirming
confirming ──[✓ Confirmar]──► finalizing ──feedback_id──► done
confirming ──[✎ Ajustar]──► awaiting_user (bot pregunta "¿qué cambiarías?")
Cross-cutting: error (retry), abandoned (close).
```

## Components

### Frontend (`packages/feedback-frontend/src/chat/`)

| Component | Role | Status |
|---|---|---|
| `FeedbackChatSheet.tsx` | Sheet root + state machine | NEW |
| `ChatTimeline.tsx` | Bubble list + synthesis card slot | NEW |
| `Composer.tsx` | Textarea + mic toggle + send button | NEW |
| `VoiceRecorder.tsx` | MediaRecorder + waveform + timer | NEW |
| `TranscriptionPreview.tsx` | Editable text post-Whisper before send | NEW |
| `SynthesisCard.tsx` | Title + summary + user_story + [✓/✎] | NEW |
| `useFeedbackChat.ts` | State machine hook + SSE consumer | NEW |
| `useVoiceCapture.ts` | MediaRecorder + permission gate | NEW |
| `useChatRunStream.ts` | SSE parser | RENAMED from `useIterRunStream` |
| `ChatBubble.tsx` | Single message render | REUSED (moved from `iter/`) |
| `markdownView.tsx` | Lazy markdown-it render | REUSED (moved from `iter/`) |
| `forbiddenWords.ts` | Word filter | REUSED (moved from `iter/`) |

Reused untouched: `capture/screenshot.ts`, `capture/metadata.ts`, `redactors.ts`, `FeedbackProvider.tsx`, `adapter.ts`.

### Backend (`packages/feedback-backend/src/feedback_widget/`)

| Module | Role | Status |
|---|---|---|
| `chat_service.py` | Session state, prompt building, LLM orchestration | RENAMED + simplified from `iter_service.py` |
| `chat_router.py` | FastAPI router factory | RENAMED from `iter_router.py` |
| `chat_models.py` | SQLModel for `feedback_chat_session` | NEW (replaces `iter_models.py`) |
| `chat_prompts/` | `capture_prompt.py`, `refine_prompt.py`, `user_builder.py` | NEW dir (replaces `iter_prompts/`) |
| `iter_llm/` → `chat_llm/` | LLM provider abstraction | RENAMED |
| `iter_scrubber.py` → `chat_scrubber.py` | Glossary + forbidden words | RENAMED |
| `iter_parser.py` → `chat_parser.py` | JSON parsing + repair-hint loop | RENAMED |
| Whisper helper inside `chat_llm/openai.py` | `transcribe_audio()` function | NEW (~50 LOC) |

Reused untouched: `models.py` (Feedback table), `service.py` (CRUD), `router.py` (existing endpoints stay for admin Triage), `auth.py`, `redaction.py`, `storage/`, `email/`, `integration.py`.

Deleted: `iter_router.py`, `iter_packager.py`, `iter_differ.py`, `iter_render.py`, `iter_sse.py`, `iter_rate_limit.py`, `iter_models.py`, `iter_schemas.py`, all `iter_prompts/*`.

## System prompts

### Capture mode (submitter)

Source of truth: D-015 in master decisions doc. Full text in `chat_prompts/capture_prompt.py`.

```
Eres un entrevistador de producto entrenado en el método "grill-me":
caminas las ramas del árbol de descubrimiento UNA por UNA, resolviendo
dependencias antes de avanzar, y para cada pregunta PROPONES una respuesta
candidata para que el usuario solo tenga que confirmar o corregir.
[... full prompt in capture_prompt.py ...]
```

### Refine mode (admin)

Source of truth: D-017. Skeleton in `chat_prompts/refine_prompt.py`.

```
Eres un asistente que ayuda a un admin de producto a refinar
una síntesis de feedback existente.
CONTEXTO:
  synthesis_actual = { ... }
  chat_original_completo = [ ... ]  # D-019: full messages[]
REGLAS:
  1. Primer turno: muestra title + user_story actuales, pregunta "¿qué quieres ajustar?".
  2. Jerga técnica OK.
  3. Una pregunta por turno cuando necesites info. Si el cambio es evidente, ejecuta.
  4. Salida JSON con synthesis_new + diff_summary.
```

## Implementation slices (vertical)

| Slice | Sem | Backend deliverable | Frontend deliverable | Demo gate |
|---|---|---|---|---|
| **S1 Schema + sessions** | 0.5 | Alembic migration; `POST /chat/sessions` with hardcoded greeting | — | `curl POST /chat/sessions` returns valid session_id |
| **S2 LLM messages SSE** | 1.0 | `POST /messages` SSE; reuse iter_service renamed to chat_service; capture prompt v2; turn cap 5; idempotency-key replay | — | Curl chat text E2E with real LLM, JSON synthesis output |
| **S3 Frontend text chat** | 1.0 | (none new) | `<FeedbackChatSheet/>` + Composer text-only + ChatTimeline + useFeedbackChat; auto-screenshot at open | UI usable in sandbox-host, no voice, synthesis renders |
| **S4 Voice** | 0.5 | `POST /voice` Whisper proxy; discard audio (D-013) | VoiceRecorder + TranscriptionPreview in Composer | UI with voice E2E, editable transcript |
| **S5 Confirm + Feedback row** | 0.5 | `POST /confirm` creates `feedback` row with synthesis copied; `feedback.severity` populated | SynthesisCard + Ajustar flow (returns to chat with bot question) | Triage page shows newly confirmed feedback |
| **S6 Refine mode** | 0.5 | `mode='refine'` route; refine prompt; context inject = synthesis + full capture messages (D-019) | `[Refinar con AI]` button on Triage detail top bar | Admin reopens chat over existing feedback, regenerates synthesis |
| **S7 Cleanup + release** | 1.0 | Delete `iter_*` dead modules; bump version to 1.0.0; CHANGELOG with migration guide; ADR-007 written | Delete `forms/`, `Compose.tsx`, `Canvas.tsx`, `ElementSelector.tsx`, `MyTicketsPanel.tsx`, all `iter/` UI; export `<FeedbackComposeLegacy/>` with console.warn | v1.0.0 ship-ready |

**Total: ~5 sem** matching D-010 big-bang plan.

**Dependencies:** S1 → S2 → S3 → S4 → S5 strict. S6 depends on S5. S7 last.

## Error handling

| Failure mode | Mitigation |
|---|---|
| LLM JSON malformed | Reuse `chat_parser` repair-hint loop, 2 retries, fallback to free-form reply + new turn |
| LLM provider 503 / saturation | Reuse fallback chain `gemini-flash-latest → gemma-3-12b-it`; emit SSE `provider_fallback` event; frontend shows amber banner "Cambio de modelo en vuelo" |
| LLM stuck >5 turns | Backend forces `mode='synthesize'` with partial data (D-003) |
| Whisper API timeout / error | Toast "No pude transcribir. Inténtalo de nuevo o escríbelo." Chat continues text-only |
| Microphone permission denied | Mic icon disabled with tooltip "Permite el micrófono en ajustes del navegador"; chat 100% text |
| MediaRecorder unsupported (Safari iOS <14.5) | Fallback to `audio/mp4`; if still unsupported, hide mic entirely |
| SSE network drop mid-stream | Browser EventSource auto-retry ~3s; backend re-emits from last persisted chunk (D-021) |
| Idempotency-Key collision | Replay cached response, 1h TTL (D-021) |
| Screenshot capture fails (CORS, iframe) | Silent failure; chat continues without visual context |
| Session abandoned >5min no activity | Backend GC marks `status='in_progress'` (D-014); user can resume |
| Rate-limit exceeded | Reuse `FEEDBACK_RATE_LIMIT_PER_HOUR`; toast "Hoy has compartido bastante feedback, ¡gracias!" |
| Browser closes tab mid-stream | EventSource dies; session stays `open` → 5min GC → `in_progress` |

## Testing strategy

| Layer | Tool | New coverage |
|---|---|---|
| Unit backend | pytest (existing) | chat_service, capture prompt builder, chat_parser, Whisper proxy mock |
| Unit frontend | vitest (existing) | useFeedbackChat state machine, useVoiceCapture, redactors |
| Integration backend | pytest + Testcontainers Postgres (existing) | Full chat flow with `FakeLLMProvider`, idempotency replay, SSE recovery, RLS multi-tenant isolation |
| Component frontend | React Testing Library (existing) | Composer states, SynthesisCard, ChatTimeline scroll |
| E2E | Playwright (existing in sandbox-host) | Submit feedback E2E text path; Admin refine path; Resume in_progress prompt |
| Manual QA | sandbox-host browser | Voice happy path with real Whisper; LLM real provider chain; Safari iOS mic |

**Reuse maximally:** test infra exists. No new frameworks.

**LLM testing:** `chat_llm/fake.py` (renamed from `iter_llm/fake.py`) provides deterministic responses for unit + integration tests without burning tokens. Extend with fixtures for grill-me-style multi-turn flows.

**E2E voice:** MediaRecorder mocking is fragile; voice E2E covered by manual QA gate before merge, not automated.

## Risks (acknowledged, mitigated)

| # | Risk | Mitigation |
|---|---|---|
| R1 | LLM asks too many questions | Hard-cap 5 in code (D-003) |
| R2 | Whisper mistranscribes product jargon | Glossary biasing via Whisper `prompt=` param (D-004) |
| R3 | Synthesis poor on trivial feedback | Early-exit on covered ≥ 0.7 (D-003) |
| R4 | LLM cost | gemini-flash-latest + prompt caching ≈ $0.005/feedback |
| R5 | PII in audio | Not persisted (D-013) |
| R6 | Admin misses 6 type chips | Admin edits inferred type/severity in Triage (D-008) |
| R7 | MediaRecorder browser compat | Safari iOS 14.5+; mp4 fallback; mic hidden if unsupported |
| R8 | Ticket_code shown to submitter | Never exposed in chat UI (D-008) |
| R9 | GrillMe feels invasive | Empathetic reflection + hard-cap turn 5 (D-009 prompt) |
| R10 | Backward compat with hosts | Legacy `<FeedbackComposeLegacy/>` opt-in 1 release (D-001) + bindings unchanged (D-020) |

## Out of scope (v1.0.0)

- Bindings reduction (D-020 — deferred to v2.0.0)
- Magic-link for submitter chat resume (D-022 — admin email magic-link stays unchanged)
- Multi-screenshot during chat ("here's another problem")
- Element-mode picker exposed in chat UI (`ElementSelector.tsx` kept as helper, no UI)
- Inline edit of synthesis fields in SynthesisCard (D-012 — Ajustar always returns to chat)
- Configurable persona name (D-011 — neutral voice locked v1.0.0)
- Observability spec details (Prometheus counters, log structure)
- Migration guide for sapphira / capellai-ai-crm (separate doc post-spec approval)

## Resume hint for writing-plans

> "Plan implementation of feedback-widget v1.0.0 chat-first redesign following the 7 vertical slices (S1-S7) defined in section 'Implementation slices' of this spec."
