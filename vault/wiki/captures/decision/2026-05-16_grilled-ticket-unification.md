---
type: decision
title: "Plan de implementación tickets conversacionales — unificación schema + ship en un solo commit"
created: 2026-05-16
author: claude-code
tags:
  - decision
  - feedback-widget
  - tickets
  - architecture
  - grill-me
status: closed
---

# Plan summary

Grill session que resuelve cómo implementar los gaps P0-P2 del sistema de tickets conversacionales del feedback-widget, bajo la restricción dura **"no versionar"** (no `_v2`, no flags `TICKETS_V2`, no DTOs paralelos). El plan unifica `feedback` + `feedback_chat_session` en una sola tabla `feedback_ticket`, mantiene `FeedbackRead` como DTO público adaptándolo in-place, y todo aterriza en un único commit atómico.

# Resolved branches

### 1. Estrategia de schema — `feedback` vs `feedback_chat_session`

**Answer:** C — Borrar `feedback`. Mover sus columnas (`title`, `ticket_code`, `status`, `description`, etc.) a `feedback_chat_session`, que se renombra a `feedback_ticket`.

**Rationale:** Una sola tabla unificada cumple "borrar lo que no aplica". `feedback_chat_session` ya contenía la conversación entera; absorber el header del ticket evita la dualidad de filas.

### 2. Naming (tabla + modelo + DTO)

**Answer:** A2 + B2 + C1. Tabla `feedback_ticket`, SQLModel `FeedbackTicket`, DTO público `FeedbackRead` mantiene nombre (adapt fields in-place).

**Rationale:** Limpia internamente sin romper API pública. Hosts (CBP/sapphira) repinan + regen types pero no cambian imports.

### 3. Legacy `POST /feedback` multipart

**Answer:** A — DELETE el endpoint. Funcionalidad redistribuida en chat-first endpoints existentes. Permitir confirm tras 1 turn si user dice "eso es todo".

**Rationale:** Cumple "borrar lo que no aplica". Mapeo verificado: title/desc/severity → derivados de synthesis; screenshot → S10; attachments → S9; email/rate-limit ya existen. Ticket sin chat contradice target conversacional.

### 4. Status enum

**Answer:** B — Rename values + extend. Set final: `open` (renombrado de `new`), `in_review` (renombrado de `triaged`), `in_progress` (mantenido), `waiting_for_user` (nuevo), `resolved` (renombrado de `done`), `wont_fix` (mantenido), `closed` (nuevo). Total 7 estados.

**Rationale:** SoT único — internal values = visible labels. Postgres `ALTER TYPE RENAME VALUE` es tx-safe Pg 10+. Cumple "adapt in place".

### 5. Dónde vive el mensaje admin

**Answer:** A — DELETE tabla `feedback_comment`. Admin escribe en `messages` JSONB con `role="admin"`. SoT único. Backfill rows existentes → `messages` JSONB. Nueva tabla `feedback_admin_action` para audit forense estructurado (kind, from_status, to_status, message_text, admin_user_id, created_at).

**Rationale:** `messages` JSONB ya es la fuente. Espejar a `feedback_comment` sería duplicación = soft versioning. Audit tabular separado cubre lo forense sin contaminar timeline.

### 6. User itera post-admin

**Answer:** 6A=C (terminal bloquea, resto permite), 6B=B (auto-flip `waiting_for_user` → `in_review` cuando user manda turn), 6C=A (reusar `POST /chat/sessions/{sid}/messages`, solo relajar guard), 6D=A (terminal definitivo — re-open vía admin-action `to_status=open`).

**Rationale:** Adapt in place. Mismo endpoint SSE. Auto-flip a `in_review` señala "admin, mira esto" — flujo natural Jira/GitHub. Terminal definitivo evita ambigüedad.

### 7. Tokens reales + context bar

**Answer:** 7A=A denormalizado en `feedback_ticket.total_input_tokens/total_output_tokens`; 7B=C `llm/limits.py` SoT + property en provider; 7C umbrales 80/90/95 configurables vía settings; 7D=A hard block pre-S16; 7E=A ignorar prompt caching.

**Rationale:** Fix bug existente (`chat_service.py:344-347` hardcodea 0). Denorm habilita lectura O(1) para barra UI. Nightly drift audit mitiga riesgo. Compaction S16 sustituirá hard-block transparente cuando aterrice.

### 8. Soft-delete + hard-delete + user-ZIP

**Answer:** 8A user soft-delete (columnas `deleted_at`, `deleted_by_user_id`, `deleted_by_role`; endpoint `DELETE /chat/sessions/{sid}`; permitido todo status con warning si `user_action_required`); 8B admin hard-delete usa `DELETE /feedback/{id}` existente, acepta soft-deletados (papelera), `include_deleted=true` query param; 8C **INVERTIDO — KEEP user-ZIP** (resilience fallback); 8D filter implícito via `list_mine`; 8E audit admin actions en `feedback_admin_action` (no user soft-delete); 8F=A (user ZIP full bundle, mismo scope que admin); path mantenido `/feedback/mine/{id}/download`.

**Rationale:** User mantiene control sobre su data. Soft-delete reversible vía admin restore. Hard-delete admin-only con audit. User-ZIP es seguro operacional (si falla la UI, user puede descargar y operar con su data).

### 9. Pre-confirm uploads (attachments + screenshot)

**Answer:** 9A rename `feedback_attachment.feedback_id` → `ticket_id`; 9B `POST /chat/sessions/{sid}/attachments` single-file per request; 9C reusar mismo endpoint con `kind=screenshot` (nuevo enum `attachment_kind`); 9D límites legacy preservados (5 user_uploads + 1 screenshot, 10MB, MIME allowlist); 9E nightly cleanup tras 24h en status `abandoned`.

**Rationale:** Adapt in place. Endpoint único cubre ambos casos via discriminador. Cleanup nightly evita storage growth sin bloquear hot path.

### 10. PR boundaries + execution

**Answer:** 10A=A — **single commit** (mega-PR) que incluye TODO el P0-P2 (S1-S16). Migración en pasos atómicos dentro del mismo PR. Dump pre-mig obligatorio. Test en sandbox antes de merge. Coordinación pre-anunciada a CBP + sapphira owners para repin lockfile post-merge.

**Rationale:** Bajo "no versionar" no hay feature flag → cada estado intermedio sería un sistema roto. Single commit deja repo siempre funcional (en el sentido "antes" vs "después", nunca "a medias"). Trade-off: review pesado, risk concentrado, rollback completo si peta.

# Pending

No quedan ramas no resueltas. Decisiones técnicas restantes son detalles de implementación (filename convention migraciones, signatura helper `bundle.build_feedback_bundle(audience=...)`, etc.) que se resuelven on-the-fly durante coding.

# Next session resume hint

"Continúa la implementación del plan grilled en `2026-05-16_grilled-ticket-unification.md`. Empieza por la migración alembic atómica que unifica `feedback` + `feedback_chat_session` → `feedback_ticket`."

# Cross-refs

- [[../decision/2026-05-13_feedback-widget-v1-redesign]] — decisiones master v1.0.0
- [[../../docs/specs/2026-05-15_1500_REPORT_legacy-iter-vs-chat-experience]] — audit previo
- [[../../docs/specs/2026-05-15_1530_REPORT_chat-experience-parity-checklist]] — parity checklist
