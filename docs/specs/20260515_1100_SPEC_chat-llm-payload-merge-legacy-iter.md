# Sprint B — Chat-first LLM payload absorbs legacy iter functionality
- **Date**: 2026-05-15 11:00
- **Document**: 20260515_1100_SPEC_chat-llm-payload-merge-legacy-iter.md
- **Category**: SPEC
- **Status**: APPROVED — ready to execute

## Contexto

Sprint A cubrió la paridad backend persistence. Sprint B cubre la paridad LLM payload: el chat-first actual envía contexto minimalista en español; el legacy iter envía contexto rico en inglés. Hay que fusionarlos sin romper el grill-me discovery process.

## Decisiones Q1-Q9 (aprobadas)

| Q | Decisión |
|---|---|
| Q1 | System prompt en INGLÉS |
| Q2 | LLM responde en idioma del usuario (detectado o configurado) — system instructs "respond in user_language" |
| Q3 | Screenshot per-turn (paridad legacy iter) |
| Q4 | Synthesis enriquecido: personas + user_stories + acceptance_criteria + diagram + assumptions |
| Q5 | SynthesisCard frontend renderea rico (mermaid + listas) |
| Q6 | Glossary desde host config (`FEEDBACK_ITER_GLOSSARY` env var, reutiliza el del iter legacy) |
| Q7 | Frontend captura console_errors + network_errors + framework + element outer_html |
| Q8 | Assumptions solo en synthesis final (no per-turn) — preserva grill-me 1-question-per-turn |
| Q9 | Jargon scrubbing extendido con forbidden list legacy |

## Phases

Cada phase atómica con tests verdes antes de siguiente. Single commit final.

### Phase 1 — System prompt v3 (English + grill-me + glossary + jargon list)

Files: `chat_prompts/capture_prompt.py`

- Translate to English, keep grill-me discovery tree + 8-dim coverage
- Add `{LANGUAGE}` placeholder for "respond in <user_language>"
- Add forbidden jargon list (extend current 7 items with legacy ~30 items)
- Extend JSON output schema: synthesis includes `personas[]`, `user_stories[]`, `acceptance_criteria[]` (already there), `assumptions[]`, `diagram` (mermaid string optional)
- Bump version tag → `capture_v3`

### Phase 2 — User builder: expanded auto_context + per-turn screenshot

Files: `chat_prompts/user_builder.py`

- Auto_context JSON block expanded: `framework`, `console_errors_tail` (≤20), `network_errors_tail` (≤20), `element_outer_html`
- Screenshot included in EVERY user message (not only turn 1) for grill-me visual recall
- Multimodal content list when image present

### Phase 3 — Backend schema AutoContext extension

Files: `chat_schemas.py`

- Add optional fields: `framework: str | None`, `console_errors_tail: list[str]`, `network_errors_tail: list[str]`, `element_outer_html: str | None`
- Backward compat: defaults

### Phase 4 — Frontend capture diagnostics

Files:
- new `packages/feedback-frontend/src/capture/diagnostics.ts` (console.error + fetch/XHR network error hooks)
- `useFeedbackChat.ts` — wire diagnostics in `_buildAutoContext`
- Element capture: extend CapturePicker to grab `outerHTML` of locked element (truncate 4096 chars)

### Phase 5 — Output schema synthesis enriched

Files:
- `chat_prompts/capture_prompt.py` — update JSON spec in prompt body (already in Phase 1)
- `chat_turn_parser.py` — accept new optional fields tolerant (no validation break if missing)
- `chat_schemas.py` — extend synthesis_json type hints (TypedDict)

### Phase 6 — Frontend SynthesisCard rich render

Files: `packages/feedback-frontend/src/chat/SynthesisCard.tsx`

- Add sections: personas, user_stories, acceptance_criteria, assumptions, diagram (lazy mermaid render or text fallback)
- Keep collapsable / "Sigamos iterando" / "Confirmar" buttons

### Phase 7 — Glossary host config + jargon scrubber expansion

Files:
- `settings.py` — `ITER_GLOSSARY` already exists (verify) — reuse for chat
- `chat_service.py` — pass `settings.ITER_GLOSSARY` to `CAPTURE_SYSTEM_PROMPT` template
- `iter_scrubber.py` or `chat_turn_parser.py` — extend forbidden list (cookies/JWT/oauth/polling/etc per legacy)

### Phase 8 — Tests + commit + redeploy

- Update `tests/integration/test_chat_*.py` for new schema fields (tolerant — old assertions still pass)
- New tests for: forbidden jargon scrubbed in reply, synthesis includes personas
- Frontend vitest for SynthesisCard rich render
- Full suite green
- Rebuild widget `dist/`
- Commit single conventional
- Repin CBP + rebuild + smoke

## Anti-zombie

- Bump `CAPTURE_SYSTEM_PROMPT_VERSION` to `capture_v3`
- Delete previous prompt body — no commented fallback
- Update D-015 reference in vault → new prompt rationale

## Rollback

Each phase revertible. Phase 1 alone is biggest risk (prompt change) — A/B test by env var `FEEDBACK_ITER_CHAT_PROMPT_VERSION` if needed (defer to v1.1 if rollback complex).
