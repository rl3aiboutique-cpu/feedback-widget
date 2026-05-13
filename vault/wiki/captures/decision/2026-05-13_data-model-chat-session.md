---
type: decision
title: "Data model: feedback_chat_session + feedback at confirm"
created: 2026-05-13
updated: 2026-05-13
author: claude-code
source: grill-me-session-1
tags:
  - decision
  - data-model
  - schema
  - migration
status: developing
priority: 1
date: 2026-05-13
owner: lehidalgo
related:
  - "[[2026-05-13_kill-iter-refine-via-chat]]"
---

# D-006: Data model — feedback_chat_session is source of truth; feedback row at confirm

## Status
Accepted (2026-05-13, /grill-me session 1).

## Context
Hoy `feedback` row se crea en el primer POST. Si el usuario abandona, queda basura en la triage list. Con un flujo conversacional la probabilidad de abandono es mayor (5 turnos vs 1 form submit).

## Decision

### Nueva tabla principal

```sql
CREATE TABLE feedback_chat_session (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    user_id         UUID NOT NULL,

    status          feedback_chat_session_status NOT NULL DEFAULT 'open',
                    -- open | synthesizing | awaiting_confirm | confirmed | abandoned

    messages        JSONB NOT NULL DEFAULT '[]'::jsonb,
                    -- [{role, ts, text, via, audio_attachment_id?, mode?, covered?}]

    synthesis_json  JSONB,                    -- null hasta synthesize
    auto_context    JSONB NOT NULL,           -- url, route, viewport, app_version, console_tail, screenshot_attachment_id

    feedback_id     UUID REFERENCES feedback(id) ON DELETE CASCADE, -- null hasta confirm
    glossary_snapshot JSONB,                  -- glossary del host al iniciar

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at    TIMESTAMPTZ,
    abandoned_at    TIMESTAMPTZ
);

CREATE INDEX ON feedback_chat_session (tenant_id, user_id, status);
CREATE INDEX ON feedback_chat_session (feedback_id) WHERE feedback_id IS NOT NULL;
```

### `feedback` cambia mínimamente

```sql
ALTER TABLE feedback ADD COLUMN chat_session_id UUID REFERENCES feedback_chat_session(id);
ALTER TABLE feedback ADD COLUMN synthesis_json JSONB;
-- title, description, expected_outcome se rellenan al confirm desde synthesis_json
```

### Audio attachments

```sql
ALTER TYPE feedback_attachment_kind ADD VALUE 'voice_clip';
ALTER TABLE feedback_attachment ADD COLUMN chat_session_id UUID REFERENCES feedback_chat_session(id);
-- feedback_id queda NULL hasta confirm; chat_session_id es la FK durante la conversación.
```

### Flujo

1. Abre chat → INSERT `feedback_chat_session(status='open')`.
2. Cada turno → `UPDATE … SET messages = messages || $turn`.
3. Voz → INSERT `feedback_attachment(kind='voice_clip', chat_session_id=…)`.
4. Síntesis lista → `UPDATE … SET status='awaiting_confirm', synthesis_json=$syn`.
5. Confirm → INSERT `feedback` con FK + COPY del synthesis a `feedback.title/description/expected_outcome/synthesis_json`.
6. Abandon → `UPDATE … SET status='abandoned', abandoned_at=now()`. GC job borra a 30d.

## Alternatives considered
- **B — Extender `feedback`**: drafts contaminan triage. Rechazado.
- **C — Renombrar `feedback_iter_*`**: legacy fields innecesarios. Rechazado por higiene.
- **D — Ephemeral en Redis**: sin recover de network drop. Rechazado.

## Consequences
- Migración Alembic NUEVA en el chain del paquete (sigue ADR-004).
- Tablas viejas `feedback_iter_*` → drop migration en una fase tardía (D-002 ya las marca para borrado).
- Triage page sigue leyendo `feedback` (filtra por chat_session_id NOT NULL si quiere "chat-origen").
- GC job para abandoned: cron diario, borra > 30d (D-XXX TTL).
- Multi-tenancy: `tenant_id` mirroreado igual que en `feedback` → RLS policy gemela.

## Evidence
- Today's `feedback` table ya soporta `metadata_bundle JSONB` → JSONB es first-class en el host.
- Iter session machinery ya hace algo similar; solo simplificamos.
