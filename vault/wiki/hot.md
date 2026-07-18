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
2026-07-18. Spec 001 (feedback email notifications) SHIPPED end-to-end: real email delivered
from admin@rl3.dev to omar.purefreight@gmail.com + r.novasvilla@gmail.com via the local CBP
stack. 14/14 tasks, evidence in `specs/001-feedback-email-notifications/quickstart.md` § C.

## Key Recent Facts
- The notification pipeline was ALREADY shipped in the widget (`enqueue_notification` +
  `build_feedback_email` + `FEEDBACK_NOTIFY_EMAILS` CSV) — spec 001 was config + verification,
  zero widget code changes.
- Delivery config (CBP local): `infrastructure/docker/docker-compose.gmail-smtp.override.yml`
  (smtp.gmail.com:587 TLS, user/from admin@rl3.dev — Google Workspace app password) +
  `docker-compose.fake-llm.override.yml` + `scripts/fetch-smtp-secret.sh` (Bitwarden
  notes-verbatim, rl3-infra-vps convention). Secret only in gitignored `.env`.
- CBP auth for API driving: cookie session (`/api/v1/login/access-token`) + CSRF double-submit
  (`POST /api/v1/csrf-token` → `X-CSRF-Token` header). Bearer alone gets 401.
- Sandbox real ports: backend :9200, frontend :9201, MailHog :8226, postgres :5440. No LLM keys
  → `FEEDBACK_ITER_PROVIDER=fake` (synthesizes on user turn 3).
- FIXED: hatchling ≥1.27 duplicate force-include broke the wheel build —
  `packages/feedback-backend/pyproject.toml` force-include block removed, wheel verified.
- Mail topology: nothing relays through vault.rl3.dev (it only STORES credentials). All apps
  auth directly to smtp.gmail.com: CBP feedback ✅ (admin@rl3.dev), VPS Vaultwarden mail ❌ and
  rl3.dev CONTACT FORM ❌ (shared rl3aiboutique app password, dead since 2026-05-30 account
  password change).
- Spec-kit installed (`.specify/` + 10 speckit skills, constitution v1.0.0) — kept UNTRACKED by
  owner decision, do not commit.
- Chat-first v1.0.0 shell-hybrid shipped earlier (S3F etc.) — see log.md 2026-05-13/14 entries.

## Decisión master
- [[2026-05-13_feedback-widget-v1-redesign]] — 22 decisiones grilled
- Spec 001 clarification: reuse existing SMTP config (superseded an initial OAuth answer)

## Active Threads
- rl3-infra-vps: branch `chore/omar-machado/vaultwarden-smtp-admin-rl3` pushed (template SMTP
  sender → admin@rl3.dev); PR pending creation/merge.
- capellai-ai-crm develop: commit `chore(infra): gmail smtp override...` made; PUSH PENDING
  (permission denied in-session — owner runs `git push origin develop`).
- VPS fix pending: mint `vaultwarden` app password under admin@rl3.dev → Bitwarden item notes
  (name unchanged) → apply env to Vaultwarden + website services (Coolify panel or operator
  onboarding; this machine is NOT onboarded: no SSH key, no team env vars, no client .env).
- CBP LLM keys dead (Gemini 400 / OpenAI 401) — rotate to restore real chat; fake provider
  meanwhile.
- Chip filed: sandbox-host log visibility (PYTHONUNBUFFERED) + mailer SMTP timeout.

## Resume hints
- "Push capellai develop + open the infra PR" — finishes the commit thread.
- "Fix the rl3.dev contact form + Vaultwarden mail" — needs the new app password + apply path.
- Spec 001 evidence: `specs/001-feedback-email-notifications/` (spec, plan, tasks, quickstart).
