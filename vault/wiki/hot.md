---
type: meta
title: "Hot Cache"
created: 2026-05-13
updated: 2026-05-13
tags:
  - meta
  - hot
status: developing
---

# Recent Context

## Last Updated
2026-05-13. Vault scaffolded. About to run `/grill-me` to interview the owner on the chat-first widget redesign.

## Key Recent Facts
- Repo: `rl3/feedback-widget` — currently v0.7.0, branch `feat/v0.4.0-canvas-and-converging-iter`.
- Widget today: form-based submit (3 fields min, 5-8 clicks). LLM (Iter) only runs post-submit for admins.
- New vision: ONE chat sheet, voice-first (Whisper), GrillMe-style discovery LLM turning ambiguous feedback into user stories.
- Audit verdict: ~80% of repo volume is the Iter workspace (~9k LOC) built for the wrong actor at the wrong moment.
- Reuse: SSE machinery, `iter_llm/` providers, `iter_scrubber`, redaction, `FeedbackProvider`. Discard: forms, Canvas, ElementSelector, IterFocusShell, EditableSpecPanel, tabs.

## Recent Changes
- Created: vault skeleton (this session).
- Pending: grill-me captures, ADR-007 (chat-first redesign), phase 1 deliverable page.

## Active Threads
- `/grill-me` about to start — discovery on the redesign vision.
- Open question: Whisper proxy via backend (Opt A) vs signed token (Opt B) — leaning A.
- Open question: bump to v1.0.0 vs v0.8.0 + legacy `<Compose/>` opt-in.
- Risk: backward compat with hosts already integrated (sapphira, capellai-ai-crm).
