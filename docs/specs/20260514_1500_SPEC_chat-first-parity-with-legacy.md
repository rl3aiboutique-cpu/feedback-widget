# Sprint A — Chat-first confirm() paridad con legacy POST /feedback
- **Date**: 2026-05-14 15:00
- **Document**: 20260514_1500_SPEC_chat-first-parity-with-legacy.md
- **Category**: SPEC
- **Scope**: `packages/feedback-backend/src/feedback_widget/` + `packages/feedback-frontend/src/chat/`
- **Owner**: lehidalgo
- **Status**: APPROVED — ready to execute

## Contexto

Auditoría 2026-05-14 (validada contra `origin/feat/v0.4.0-canvas-and-converging-iter` via git diff) detectó que `POST /chat/sessions/{sid}/confirm` crea la fila `feedback` PERO no ejecuta los side-effects que el endpoint legacy `POST /feedback` siempre disparaba: server-side redaction, email notification, S3 screenshot upload + FeedbackAttachment row, rate-limit check, persistencia de columnas element_*. Resultado: rows chat-first quedan "incompletas" desde el punto de vista del admin (sin screenshot visible, sin email entrante, con PII potencial sin redactar).

Backend legacy (`router.py`, `service.py`, `helpers.py`, `redaction.py`) está intacto entre rama original y HEAD (0 líneas de diff). Esta spec define el plan para **reusar** esos helpers desde el chat path, NO reescribirlos.

## Decisiones (Q1-Q5)

| # | Pregunta | Decisión |
|---|---|---|
| Q1 | Screenshot wire: base64 inline vs multipart | base64 inline en JSON body — schema simple, payload <1MB típico |
| Q2 | Rate limit: confirm() vs start_session() | confirm() solo — unidad rate-limited es "feedback row created" |
| Q3 | Phase 6 (email con screenshot inline) en Sprint A | incluir — sin esto la paridad email queda visualmente incompleta |
| Q4 | `screenshot_b64` opcional (puede ser null) | sí — fail-soft, mejor confirm sin screenshot que confirm fallido |
| Q5 | Source-of-truth ticket_code | `service.py` canonical, `chat_service.py` importa |

## Phases

Cada phase es atómica: tests verdes antes de pasar a la siguiente. Sin feature flags. Sin commits intermedios — UN commit al final del Sprint A.

### Phase 0 — Refactor base (no behavior change)

Goal: extraer helpers públicos sin tocar el chat path. Tests legacy + chat existentes deben seguir verdes.

| Step | Action | Files |
|---|---|---|
| 0.1 | Extract `upload_feedback_attachment(session, storage, *, feedback_id, tenant_id, content, content_type, filename, kind, width, height) -> FeedbackAttachment` desde `service.py:190-236` inline a función pública en `service.py` | `service.py` |
| 0.2 | Refactor `FeedbackService.create()` para usar `upload_feedback_attachment()` — verifica que tests legacy `test_router_smoke.py` siguen verdes | `service.py` |
| 0.3 | Extract `check_user_rate_limit(session, *, user_id, tenant_id, settings) -> None` desde `FeedbackService.check_rate_limit()`. Raise `FeedbackRateLimitExceededError` igual que antes. Refactor método existente para delegar al standalone | `service.py` |
| 0.4 | Mover `generate_ticket_code(session, *, tenant_id) -> str` (canonical) a `service.py` como función pública. Borrar `_generate_ticket_code_for_tenant` de `chat_service.py:626-661`. Update `chat_service` para importar de `service`. Update `FeedbackService._generate_ticket_code` para delegar al public | `service.py`, `chat_service.py` |
| 0.5 | Run `uv run pytest tests/` — verde verde verde. Run `pnpm test --filter feedback-frontend` — verde | — |

Done criterion: `pytest -x` exits 0, no diff de comportamiento detectable.

### Phase 1 — A1 server-side redaction

Goal: chat confirm aplica `redact_string`/`redact_bundle` igual que legacy.

| Step | Action | Files |
|---|---|---|
| 1.1 | En `chat_service.confirm_session`, importar `from .redaction import redact_string, redact_bundle` | `chat_service.py` |
| 1.2 | Antes del `Feedback(...)` constructor, redactar: `title`, `description`, `expected_outcome`, `metadata_bundle`, `synthesis_json` | `chat_service.py` |
| 1.3 | Test `test_chat_confirm_redacts_jwt_bearer_in_title_and_description` en `tests/integration/test_chat_confirm_parity.py` (archivo nuevo) | `tests/integration/test_chat_confirm_parity.py` |

Done criterion: confirm() con synthesis que contiene `Bearer abc123.def456.ghi789` → DB row guarda `[REDACTED]`.

### Phase 2 — A4 element columns

Goal: copiar `auto_context.element_*` a las columnas dedicadas `feedback.element_selector/xpath/bounding_box`.

| Step | Action | Files |
|---|---|---|
| 2.1 | En `chat_service.confirm_session`, después de extraer `auto_context`, mapear `element_selector` (max 1024), `element_xpath` (max 2048), `element_bounding_box` (JSONB) a columnas dedicadas | `chat_service.py` |
| 2.2 | Test `test_confirm_persists_element_metadata_to_columns` | `tests/integration/test_chat_confirm_parity.py` |

Done criterion: confirm() con `auto_context.element_selector="#submit"` → `feedback.element_selector == "#submit"` Y `feedback.metadata_bundle["element_selector"] == "#submit"` (preservar también en bundle para compatibilidad).

### Phase 3 — A5 rate limit

Goal: chat confirm enforces el mismo rate limit que legacy (`FEEDBACK_RATE_LIMIT_PER_HOUR`).

| Step | Action | Files |
|---|---|---|
| 3.1 | En `chat_service.confirm_session` (al inicio, antes de validar synthesis), llamar `check_user_rate_limit(db, user_id=user_id, tenant_id=tenant_id, settings=settings)` | `chat_service.py` |
| 3.2 | En `chat_router.confirm_chat_session`, catch `FeedbackRateLimitExceededError` y devolver 429 con header `Retry-After` (mismo patrón que `router.py` legacy) | `chat_router.py` |
| 3.3 | Test `test_confirm_429_when_rate_limit_exceeded` — seed N rows past hour, confirm, expect 429 | `tests/integration/test_chat_confirm_parity.py` |

Done criterion: confirm() después de N feedback rows del mismo user en última hora → HTTP 429 con `Retry-After`.

### Phase 4 — A2 email notification (sin screenshot inline aún)

Goal: chat confirm encola email a `FEEDBACK_NOTIFY_EMAILS`.

| Step | Action | Files |
|---|---|---|
| 4.1 | `chat_router.confirm_chat_session`: inyectar `BackgroundTasks` dep | `chat_router.py` |
| 4.2 | Después de `service.confirm_session()` retornar `(feedback_id, ticket_code)`, releer `feedback = db.get(Feedback, feedback_id)` | `chat_router.py` |
| 4.3 | Llamar `(subject, html, text) = build_feedback_email(feedback=feedback, submitter_email=user.email, presigned_url=None, settings=settings)` | `chat_router.py` |
| 4.4 | Llamar `enqueue_notification(background, feedback_id=feedback_id, feedback_snapshot_subject=subject, html=html, text=text, screenshot_bytes=None, screenshot_content_type=None, settings=settings)` | `chat_router.py` |
| 4.5 | Test `test_confirm_enqueues_email_notification` — monkeypatch `send_email` AsyncMock, confirm session, assert called once con subject pattern | `tests/integration/test_chat_confirm_parity.py` |

Done criterion: confirm() → MailHog (manual) recibe email con subject `[RL3] [Bug] <title>`. No-op si `FEEDBACK_NOTIFY_EMAILS` vacío.

### Phase 5 — A3 screenshot upload

Goal: blob capturado en openSheet llega al backend y se sube a S3 + FeedbackAttachment row.

**Frontend:**

| Step | Action | Files |
|---|---|---|
| 5.1 | En `useFeedbackChat.ts:262-273`, sustituir el await silencioso por `const result = await capturePageScreenshot(...); if (result?.blob) setScreenshotBlob(result.blob);` | `useFeedbackChat.ts` |
| 5.2 | Añadir state `const [screenshotBlob, setScreenshotBlob] = useState<Blob \| null>(null)` | `useFeedbackChat.ts` |
| 5.3 | En `closeSheet()` y `newConversation()`, `setScreenshotBlob(null)` (cleanup) | `useFeedbackChat.ts` |
| 5.4 | En `confirmSynthesis()`, convertir blob a base64: `const b64 = screenshotBlob ? await blobToBase64(screenshotBlob) : null` (helper utility) | `useFeedbackChat.ts` |
| 5.5 | Cambiar POST /confirm body a `{ synthesis_override: null, screenshot_b64: b64, screenshot_content_type: b64 ? "image/png" : null }` | `useFeedbackChat.ts` |
| 5.6 | **Borrar el comentario zombie "Batch B will upload it"** en `useFeedbackChat.ts` | `useFeedbackChat.ts` |
| 5.7 | **Borrar línea `screenshot_attachment_id: null` hardcoded en `_buildAutoContext`** — ya no se setea client-side, lo setea backend después del upload | `useFeedbackChat.ts` |

**Backend:**

| Step | Action | Files |
|---|---|---|
| 5.8 | `chat_schemas.ConfirmChatSessionRequest`: añadir `screenshot_b64: str \| None = None` + `screenshot_content_type: str \| None = None` con validator size <10MB decoded | `chat_schemas.py` |
| 5.9 | `chat_router.confirm_chat_session`: pasar `screenshot_b64`/`content_type` desde request a `service.confirm_session()` (extender firma) | `chat_router.py` |
| 5.10 | `chat_service.confirm_session`: después de `session.flush()` (necesitamos `feedback.id`), si `screenshot_b64` no-null → decode base64 + magic byte sniff (reuse helper legacy) + `upload_feedback_attachment(session, storage, feedback_id=feedback.id, tenant_id=tenant_id, content=decoded, content_type="image/png", filename=None, kind=FeedbackAttachmentKind.SCREENSHOT, width=None, height=None)` | `chat_service.py` |
| 5.11 | Actualizar `feedback.metadata_bundle["screenshot_attachment_id"] = str(attachment.id)` tras upload | `chat_service.py` |
| 5.12 | Test backend `test_confirm_uploads_screenshot_to_s3_and_creates_attachment_row` — FakeStorage assert objeto, FeedbackAttachment row assert | `tests/integration/test_chat_confirm_parity.py` |
| 5.13 | Test frontend vitest `useFeedbackChat captures and forwards screenshot` — mock fetch, assert body has screenshot_b64 | `tests/feedback-frontend/useFeedbackChat.test.tsx` |

Done criterion: confirm() en :3001 → MinIO `cbp-minio` tiene objeto bajo `feedback/YYYY/MM/DD/{fid}/<uuid>.png` + admin UI muestra screenshot inline.

### Phase 6 — Inline screenshot en email

Goal: paridad total con legacy email — screenshot inline como attachment.

| Step | Action | Files |
|---|---|---|
| 6.1 | En `chat_router.confirm_chat_session`, después del `service.confirm_session()` que ahora retorna attachment_id: releer screenshot bytes desde `storage.download(object_key)` | `chat_router.py` |
| 6.2 | Pasar `screenshot_bytes=bytes` y `screenshot_content_type="image/png"` a `enqueue_notification(...)` | `chat_router.py` |
| 6.3 | Extender test Phase 4 — assert `send_email` recibe `attachments` con uno de tipo `image/png` | `tests/integration/test_chat_confirm_parity.py` |

Done criterion: MailHog recibe email con imagen visible inline.

## Anti-zombie checklist (per-phase verify)

Antes de cerrar cada phase, validar:

- [ ] Ninguna implementación dual viva (Phase 0 borra duplicates en el mismo step)
- [ ] Ningún comentario "Batch B/C" placeholder en código tocado (Phase 5)
- [ ] Ningún campo hardcoded `null` que ya debería conectarse (Phase 5)
- [ ] Tests legacy `test_router_smoke.py` siguen verdes (Phase 0)
- [ ] Tests chat existentes `test_chat_confirm_abandon.py` siguen verdes
- [ ] Sin nuevos warnings ruff/pyright
- [ ] Sin feature flags introducidos

## Test infra (reuso)

- `FakeStorage` fixture (`tests/integration/conftest.py:145-182`) — reusar tal cual
- AsyncMock para SMTP — patrón nuevo, monkeypatch `email.mailer.send_email` en test
- Helper `seed_chat_session_with_synthesis(db, user_id, tenant_id, synthesis_dict)` — extraer si se usa en >1 test (DRY)
- Archivo único `tests/integration/test_chat_confirm_parity.py` agrupa A1-A5

## Rollback plan

Cada phase es revertible aisladamente:
- Phase 0: refactor — `git revert <sha>` restaura inline original
- Phase 1: borra import + 5 líneas en confirm_session
- Phase 2: borra 3 líneas asignación
- Phase 3: borra 1 línea + handler catch
- Phase 4: borra 4 líneas router
- Phase 5: borra schema fields + decode block + frontend state. **Si la POST falla por payload size**, frontend tiene fallback null-screenshot
- Phase 6: revert llamada storage.download — email vuelve a plain

## Commit final

Tras todas las phases verdes:

```
feat(v1.0.0): chat confirm paridad legacy — redact + element + rate-limit + email + screenshot

- Phase 0: extract upload_feedback_attachment + check_user_rate_limit + unify generate_ticket_code
- Phase 1: apply redact_string/bundle to title/description/expected_outcome/metadata_bundle/synthesis_json
- Phase 2: persist auto_context.element_* to dedicated feedback columns
- Phase 3: enforce FEEDBACK_RATE_LIMIT_PER_HOUR on /chat/sessions/{sid}/confirm
- Phase 4: enqueue email notification via BackgroundTasks (build_feedback_email + enqueue_notification)
- Phase 5: wire screenshot blob FE→BE via base64 inline, upload to S3, create FeedbackAttachment row
- Phase 6: inline screenshot as image/png attachment in notification email

Tests added: tests/integration/test_chat_confirm_parity.py (5 cases)
```

## Done criteria global

- [ ] Phases 0-6 todas verdes
- [ ] `uv run pytest tests/` 100% pass
- [ ] `pnpm test --filter feedback-frontend` 100% pass
- [ ] Manual smoke en :3001: confirm chat-first → MailHog recibe email con screenshot inline → admin UI muestra row con screenshot + metadata completo + element columns rellenas si en element-mode
- [ ] No comentarios "Batch B"/"Batch C" en código del repo
- [ ] No duplicación `_generate_ticket_code*`
