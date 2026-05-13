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

## 2026-05-13 — S1 implemented (chat-first redesign foundation)

- Migration 0007_chat_first_schema applied: 3 enums (chat_session_mode, chat_session_status, feedback_severity) + feedback_chat_session table (14 cols) + ALTER feedback for synthesis_json/severity/chat_session_id.
- 6 new src files: chat_models.py, chat_schemas.py, chat_service.py, chat_router.py + helper functions.
- 3 new test files: test_chat_models.py (3 unit), test_chat_service.py (7 integration), test_chat_sessions.py (4 integration).
- Wiring: __init__.py exports register_feedback_chat_router; integration.py mounts both routers; conftest app fixture mounts both; sandbox-host main.py mounts both.
- Conftest TRUNCATE extended for feedback_chat_session.
- Code review found 5 Important issues — all fixed inline: _message_preview helper (defensive against non-dict messages), _PREVIEW_MAX_LEN constant, _IN_PROGRESS_LIMIT (10 cap), exclude_id dead param removed, +3 tests (ordering + truncation + empty messages).
- Migration tenant_id corrected: nullable=True (was False) to match feedback table convention for single-tenant hosts.
- 1231 LOC staged. Single S1 commit pending user `ok`.

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
