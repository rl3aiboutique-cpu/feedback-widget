---
type: meta
title: "Hot Cache"
created: 2026-05-13
updated: 2026-07-18
tags:
  - meta
  - hot
status: developing
---

# Recent Context

## Last Updated
2026-07-18. Spec 001 SHIPPED end-to-end: real notification email delivered from admin@rl3.dev
(Google Workspace app password) to both team inboxes via the local CBP stack. All 14 tasks done.

## Key Recent Facts
- Spec-kit (GitHub Specify) installed: `.specify/` + 10 `speckit-*` skills. Constitution v1.0.0
  ratified (`.specify/memory/constitution.md`) — Principle I: non-regression, shipped code wins.
- Spec 001 `specs/001-feedback-email-notifications/`: notify omar.purefreight@gmail.com +
  r.novasvilla@gmail.com from admin@rl3.dev on new feedback. Code scan: pipeline already shipped
  (`enqueue_notification` + `build_feedback_email` + `FEEDBACK_NOTIFY_EMAILS` CSV). Zero code
  changes; sandbox e2e verified (MailHog): 1 confirm = 1 email, mail-down never breaks
  submission, env-only enable/disable/re-address. Pending: prod config in CBP (provider SMTP
  relay for rl3.dev, API key as SMTP_PASSWORD) + smoke (T005-T007, T010).
- FIXED defect: hatchling ≥1.27 broke wheel build (duplicate force-include in
  `packages/feedback-backend/pyproject.toml`) — force-include block removed, wheel verified.
- OPEN defects (chip filed): sandbox-host docker logs swallow app output (no PYTHONUNBUFFERED);
  mailer `smtplib.SMTP()` has no timeout (outage hangs background thread ~2 min).
- Sandbox real ports: backend :9200, frontend :9201, MailHog :8226, postgres :5440. LLM keys
  absent → use `FEEDBACK_ITER_PROVIDER=fake` (synthesizes on user turn 3).

## Decisión master
- [[2026-05-13_feedback-widget-v1-redesign]] — 22 decisiones grilled
- Spec 001 clarification: reuse existing SMTP config (superseded OAuth/Gmail first answer)

## Active Threads
- Ship spec 001: operator provisions rl3.dev mail relay → env block in CBP → prod smoke
  (tasks T005-T007 + optional T010 in `specs/001-feedback-email-notifications/tasks.md`).
- Follow-up chip: sandbox log visibility + SMTP timeout hardening.
- Prior thread (S5/S3E/S4/S7 chat-first slices) unchanged.

## Resume hints
- "Ejecuta T005-T007 de spec 001" once the mail provider API key exists.
- Everything verified is evidenced in `specs/001-feedback-email-notifications/quickstart.md` § C.
