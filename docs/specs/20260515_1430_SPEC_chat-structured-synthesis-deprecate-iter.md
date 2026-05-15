# Sprint C — Structured synthesis + audit table + admin visibility + iter deprecation
- **Date**: 2026-05-15 14:30
- **Document**: 20260515_1430_SPEC_chat-structured-synthesis-deprecate-iter.md
- **Category**: SPEC
- **Status**: APPROVED — ready to execute

## Decisiones Q1-Q8

| Q | Decisión |
|---|---|
| Q1 | `ChatSynthesis` Pydantic typed; `extra="ignore"` (forward compat); required base + optional Sprint B fields validated as typed lists/objects |
| Q2 | `feedback_chat_call` audit table — paridad observability con `feedback_iter_call` |
| Q3 | NO assumption table — mantener inline en `synthesis.assumptions: list[str]` |
| Q4 | NO versioning chat (one-shot por diseño) |
| Q5 | Admin endpoint `GET /api/v1/feedback/{id}/chat` que devuelve conversación + synthesis estructurada |
| Q6 | `FeedbackRead` extiende con `synthesis_json`, `chat_session_id`, `severity` |
| Q7 | Deprecar iter legacy completo — borrar código + tablas (~3500 LOC) |
| Q8 | NO package ZIP |

## Phases

### Phase 1 — `ChatSynthesis` Pydantic strict
Files: `chat_schemas.py` (new model), `chat_turn_parser.py` (validate + repair-loop)

- New `class ChatSynthesisPersona`, `ChatSynthesis(BaseModel, model_config=ConfigDict(extra="ignore"))`
- Required: title, summary, user_story, context, user_need, acceptance_criteria, open_questions
- Optional typed: personas, user_stories, assumptions, diagram (all validated)
- `parse_turn_response` validates synthesis via `ChatSynthesis.model_validate` when present
- Repair-hint loop on Pydantic ValidationError (mirror iter parser)

### Phase 2 — `feedback_chat_call` audit table
Files:
- new migration `0008_feedback_chat_call.py` (CREATE TABLE)
- new model in `chat_models.py` (`FeedbackChatCall`)
- `chat_service.run_turn` writes a row after each LLM stream (success or failure)
- Captures: model_id, provider, input_tokens, output_tokens, latency_ms, status, attempt_number, prompt_sha256, error_message, created_at

### Phase 3 — Admin endpoint + `FeedbackRead` extension
Files:
- `schemas.py` — `FeedbackRead` adds optional `synthesis_json`, `chat_session_id`, `severity`
- `router.py` — new `GET /api/v1/feedback/{id}/chat` returns `ChatSessionDetailResponse` (admin-only)
- `service.py` — `to_read` populates new fields

### Phase 4 — Deprecate iter module
Files removed (back end):
- `iter_router.py`, `iter_service.py`, `iter_schemas.py`, `iter_parser.py`, `iter_models.py`,
  `iter_prompts/`, `iter_scrubber.py`, `iter_packager.py`, `iter_differ.py`,
  `iter_llm/protocol.py` callsites used only by iter
- `register_feedback_iter_router` removed from `__init__.py` + sandbox-host `main.py`
- `tests/unit/test_iter_*.py`, `tests/integration/test_iter_*.py`
- `ITER_*` settings removed EXCEPT `ITER_PROVIDER`, `ITER_*_MODEL`, `ITER_*_API_KEY`, `ITER_GLOSSARY`, `ITER_FORBIDDEN_WORDS` (chat reuses them); rename grouping comment to "LLM provider config"

Files removed (frontend):
- `src/iter/IterWorkspace.tsx`, `src/client/iter.ts`, `src/iter/**`

New migration `0009_drop_iter_tables.py`:
- DROP `feedback_iter_package`, `feedback_iter_assumption`, `feedback_iter_call`,
  `feedback_iter_version`, `feedback_iter_session` (CASCADE order)
- DROP enums: `feedback_iter_session_status`, `feedback_iter_call_status`,
  `feedback_iter_assumption_kind`, `feedback_iter_assumption_status`

### Phase 5 — Stale cleanup
- Remove "Batch B" / "Batch C" placeholder comments from `chat_router.py`, `chat_service.py`,
  `useFeedbackChat.ts` headers
- Inspect `_load_screenshot_attachment` for hardcoded null path that became unreachable
  after Sprint A
- Remove `screenshot_attachment_id` from `auto_context` builder if dead (already done
  Sprint A — verify)
- Update `vault/wiki/hot.md` Active Threads to reflect post-Sprint-C state

### Phase 6 — Tests + dist rebuild + commit + redeploy CBP
- All previous tests pass + new parity tests for ChatSynthesis validation, chat_call row
  creation, admin chat endpoint, FeedbackRead extension
- Rebuild widget dist (FE consumer ships)
- Single conventional commit
- CBP repin + docker rebuild + smoke verify

## Anti-zombie

- Phase 4 deletes code AND migrates tables in same commit — no half-deprecated state
- No feature flag for iter (already gated false, just remove)
- Migration 0009 is one-way (no `downgrade()` restore for iter — accepted per Q7
  "deprecate completely")

## Risks

| Risk | Mitigation |
|---|---|
| LLM emits invalid synthesis → confirm fails | repair-hint loop in turn parser; if final repair fails, persist synthesis as null and surface error to user |
| Existing iter sessions in CBP local DB | none — `FEEDBACK_ITER_ENABLED=false` is default; CBP never enabled |
| `ChatSynthesis` extra="ignore" hides bugs | log dropped fields at parse time |
| Stale frontend iter/ deletion breaks CBP admin | grep `iter` in CBP frontend; if no refs, safe |
| Tokens not exposed by LLM provider | optional fields in `FeedbackChatCall`; if provider returns None, columns stay NULL |

## Rollback

- Phases 1-3 + 5: small, revertible via `git revert`
- Phase 4 deletion: needs `git revert` AND restore tables (migration 0009 has no
  automatic downgrade — drops are irreversible). Accept this risk per Q7.
