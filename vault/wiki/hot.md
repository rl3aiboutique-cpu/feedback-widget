---
type: meta
title: "Hot Cache"
created: 2026-05-13
updated: 2026-05-14
tags:
  - meta
  - hot
status: developing
---

# Recent Context

## Last Updated
2026-05-14. S3F shell-hybrid IMPLEMENTED + deployed to CBP. Visual smoke green via agent-browser.

## Key Recent Facts
- Redesign chat-first v1.0.0 — shell-hybrid: OLD chrome (header + tabs Nuevo/Mis feedbacks + CAPTURE picker + footer) preserved verbatim; form fields replaced by chat (ChatTimeline + Composer + SynthesisCard).
- Bottom buttons state-driven: hidden during discovery; [↺ Sigamos iterando] + [✓ Confirmar] when synthesis visible.
- LLM arquitectura: single call per turn (Gemini-flash). LangGraph diferido a v1.1+ solo si métricas breach.
- Workflow E2E: feedback-widget repo → git push branch → CBP repins lockfile → `make rebuild` → :3001 sirve nueva UI.

## Decisión master
- [[2026-05-13_feedback-widget-v1-redesign]] — 22 decisiones grilled
- [[../../docs/specs/2026-05-14-feedback-widget-shell-hybrid-design]] — spec shell-hybrid

## Stack dev
- `agent-browser` 0.27.0 global + Chrome 148 (ojos del agente, refs `@e1`)
- CBP local: backend :8002, frontend :3001
- CBP db: cbp-postgres :5433 user cbp_user db compliance_brain_dev
- Real Gemini wiring: `GEMINI_API_KEY` en `apps/sandbox-host/.env`; CBP backend ya tiene su key en infra `.env`

## Active Threads
- S3F shipped en commit `ed85564`, branch `feedback/lehidalgo/feedback-optimizations`, pushed remote.
- CBP frontend lockfile pin actualizado a ed85564, rebuild + redeploy hecho. Smoke browser ✅.
- Visual issues conocidos (no bloquean): greeting bubble se renderiza con estilo button; botón flotante "RL3 Feedback" sigue visible encima del Sheet abierto. Diferidos a polish slice.
- Next: S5 (backend confirm + abandon endpoints) → S5b (frontend wire confirm) → S3E (comments inline) → S4 (voice Whisper) → S7 (cleanup legacy + v1.0.0 ship).

## Resume hints
- Implementación: "Sigue con S5 — POST /chat/sessions/{sid}/confirm crea feedback row real + S5b wire frontend."
- Visual polish: "fix greeting bubble como assistant chat bubble no button, y ocultar floating button cuando Sheet abierto."
