---
type: overview
title: "Vault Overview"
created: 2026-05-13
updated: 2026-05-13
tags:
  - meta
  - overview
status: developing
---

# Overview

## Project

**RL3 Feedback Widget** — installable `@rl3/feedback-widget` (JS) + `rl3-feedback-widget` (Python). Drop-in feedback module for FastAPI + React hosts. Today: form-based capture + admin triage + LLM-driven Iter workspace.

## Current state (v0.7.0)

- Two packages + sandbox-host + 6 ADRs.
- ~11k LOC backend Python, ~10k LOC frontend TS (sin shadcn vendoreado).
- Iter workspace = ~80% del volumen total.

## Active initiative — chat-first redesign

Reemplazar el flujo de submit form por una **única Sheet conversacional** con LLM entrevistador (GrillMe-style) + entrada por voz vía Whisper. Sintetiza feedback ambiguo en user story estructurada + criterios de aceptación.

See: [[decisions/_index|Decisions]] (próxima ADR-007), [[deliverables/_index|Deliverables]] (fases del rollout), [[flows/_index|Flows]] (chat journey).

## Reading order for newcomers

1. [[hot]] — qué pasa esta semana.
2. [[overview]] — tú estás aquí.
3. [[modules/_index]] — mapa del código actual.
4. [[flows/_index]] — journeys de usuario.
5. [[decisions/_index]] — por qué las cosas son como son.
