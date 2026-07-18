---
type: meta
title: "Operations Log"
created: 2026-05-13
updated: 2026-05-13
tags:
  - meta
  - log
status: evergreen
---

# Operations Log

Append-only. New entries at the TOP.

---

## 2026-07-18 (later) — Spec 001 SHIPPED: real email live from admin@rl3.dev

- CBP full stack run locally (backend :8002, frontend :3001); login + widget chat + confirm
  driven via UI and API (cookie auth + CSRF double-submit + fake LLM provider — both CBP LLM
  keys are dead: Gemini 400, OpenAI 401 → rotate).
- Credential saga: vault app password dead (Google acct password changed May 30 revokes app
  passwords) → new one minted for admin@rl3.dev (Workspace mailbox!) → SMTP AUTH OK →
  FB-2026-0005 email DELIVERED to omar.purefreight@gmail.com + r.novasvilla@gmail.com, From
  admin@rl3.dev. Spec FR-003 satisfied literally.
- FR-011 proven 3× on real host: 535 BadCredentials logged distinguishably, submissions never
  affected.
- bw CLI convention learned from rl3-infra-vps: item value = notes verbatim, org-scoped, exact
  name (`vault_pull_env.sh`); CBP `scripts/fetch-smtp-secret.sh` now follows it.
- Local artifacts in capellai-ai-crm (uncommitted): gmail-smtp + fake-llm compose overrides,
  fetch-smtp-secret.sh.
- OPEN: store admin@rl3.dev app password in a properly-named vault item; VPS Vaultwarden mail
  still broken (rl3aiboutique app password dead); CBP LLM keys rotation.

## 2026-07-18 — Spec-kit installed + spec 001 (email notifications) verified

- Spec-kit init (`.specify/` + speckit-* skills); constitution v1.0.0 ratified (non-regression,
  host-CRM alignment).
- Spec 001 feedback-email-notifications: full speckit flow (specify → clarify → plan → tasks →
  implement). Finding: notification pipeline already shipped — zero code changes, config-only.
- Sandbox e2e green: 1 confirm = 1 MailHog email (contract match, screenshot attached); mail-down
  submission unaffected (FB-2026-0002); empty NOTIFY_EMAILS no-op (FB-2026-0003); env re-address
  (FB-2026-0004). Compose defaults restored.
- Fixed: hatchling ≥1.27 duplicate force-include wheel break → [[2026-07-18_hatchling-duplicate-force-include]].
- Open chip: sandbox log visibility + mailer SMTP timeout → [[2026-07-18_sandbox-log-visibility-smtp-timeout]].
- Pending operator: rl3.dev mail relay + CBP env block + prod smoke (T005-T007).

## 2026-05-13 — S1 implemented (chat-first redesign foundation)

- Migration 0007_chat_first_schema applied: 3 enums (chat_session_mode, chat_session_status, feedback_severity) + feedback_chat_session table (14 cols) + ALTER feedback for synthesis_json/severity/chat_session_id.
- 6 new src files: chat_models.py, chat_schemas.py, chat_service.py, chat_router.py + helper functions.
- 3 new test files: test_chat_models.py (3 unit), test_chat_service.py (7 integration), test_chat_sessions.py (4 integration).
- Wiring: __init__.py exports register_feedback_chat_router; integration.py mounts both routers; conftest app fixture mounts both; sandbox-host main.py mounts both.
- Conftest TRUNCATE extended for feedback_chat_session.
- Code review found 5 Important issues — all fixed inline: _message_preview helper (defensive against non-dict messages), _PREVIEW_MAX_LEN constant, _IN_PROGRESS_LIMIT (10 cap), exclude_id dead param removed, +3 tests (ordering + truncation + empty messages).
- Migration tenant_id corrected: nullable=True (was False) to match feedback table convention for single-tenant hosts.
- 1231 LOC staged. Single S1 commit pending user `ok`.

## 2026-05-14 — S3F shell-hybrid shipped + deployed CBP

- Refactor FeedbackChatSheet: OLD chrome (header + tabs + CAPTURE picker + footer) preserved; only form-fields zone replaced by chat.
- 4 new components: `chat/CapturePicker`, `chat/FeedbackTabs`, `chat/MineFeedTab`, `chat/FooterActions` (+ 8 vitest passing).
- Bottom buttons state-driven via `FooterActions`. Hidden during discovery, `[↺ Sigamos iterando]` + `[✓ Confirmar]` during synthesis.
- `useFeedbackChat` extended with `captureMode`, `lockedElement`, `activeTab` + handlers.
- `SynthesisCard` adelgazado (buttons movieron al footer).
- `VITE_FEEDBACK_CHAT_FIRST` flag removido — chat sheet ahora es el único path.
- Commit `ed85564`, branch `feedback/lehidalgo/feedback-optimizations`, pushed.
- CBP repinned + rebuilt frontend. Browser smoke via agent-browser ✅ en :3001.
- Spec: docs/specs/2026-05-14-feedback-widget-shell-hybrid-design.md
- Plan: docs/superpowers/plans/2026-05-14-feedback-widget-shell-hybrid.md
- LLM architecture: single call per turn confirmed for v1.0.0. LangGraph deferred to v1.1+ pending metrics.

## 2026-05-13 — Decisions consolidated into single master doc

- Las 13 páginas (9 individuales + 2 consolidated per-sesión + ... = 11 totales) fusionadas en [[2026-05-13_feedback-widget-v1-redesign]].
- Vault más limpio. Una sola fuente de verdad para v1.0.0 redesign.
- Hot.md actualizado.

## 2026-05-13 — /grill-me session 2 closed

- 7 decisiones (D-016..D-022) sobre pending táctico de s1.
- Combined index s1+s2 = 22 decisiones totales.

## 2026-05-13 — /grill-me session 1 closed

- 15 decisiones (D-001..D-015) resueltas.
- Mid-session: `dev-vault-discipline.md` actualizada para forzar 1 doc consolidado por grill.

## 2026-05-13 — Vault scaffolded

- Mode: B + C + D (Repo + Project + Second Brain).
- Created folder skeleton: 14 wiki/ subdirs + 11 captures/ subdirs + _templates/ + .obsidian/.
- Created index.md, log.md, hot.md, overview.md, CLAUDE.md.
- Created _index.md per domain folder.
- Trigger: "inicial al vault /wiki hagamos un proceso de /grill-me".
