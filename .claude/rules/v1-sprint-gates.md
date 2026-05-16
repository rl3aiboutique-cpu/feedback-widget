---
name: v1-sprint-gates
description: V1 launch CI + pre-commit enforcement gates. Must pass for any V1 cohort story to merge.
priority: high
alwaysApply: true
managed_by: user
---

# V1 Sprint Gates

V1 launch hardening gates from `SECURITY_TESTING_PLAN.md` C6 + verticals re-audit R8. Document what must change — do NOT modify `.github/workflows/ci.yml` from this rule. Land all CI changes in ONE PR: `feat(ci): V1 sprint gates`.

## CI workflow — `.github/workflows/ci.yml` (rl3-ci@v0.5.4)

Verified current values (read at gate-creation time):

| Setting | Current | V1 required | Land in |
|---|---|---|---|
| backend `run_bandit` | `false` | `true` | v1-gate PR |
| backend `coverage_min` | `0` | `80` (matches pyproject `--cov-fail-under=80`) | v1-gate PR |
| frontend `run_tests` | `false` | `true` | ST-002 |
| frontend `run_secretlint` | `false` | `true` | v1-gate PR |
| security `osv_fail_on_findings` | `false` | `true` | v1-gate PR |
| security `run_trufflehog` | `false` | `true` | v1-gate PR |

`mypy_strict: true` + `run_alembic: true` already correct — leave as-is.

## Ruff `S` family (flake8-bandit) — `backend/pyproject.toml`

Current `[tool.ruff.lint] select`: `E, W, F, I, N, UP, B, C4, SIM, RUF, ARG001`. No `S` rules.

V1 required: add `S` to `select`. Minimum S-rules in scope:

- `S101` assert-used (already in bandit `skips` for runtime guards — mirror via `per-file-ignores` if kept)
- `S105 / S106 / S107` hardcoded passwords
- `S301 / S307` pickle / `eval`
- `S501` SSL `verify=False`
- `S608` SQL-injection (bandit skips `B608` historically — re-evaluate)

Any rule excluded must justify via `[tool.ruff.lint.per-file-ignores]` with comment. Bandit `skips = ["B101", "B104", "B311", "B608"]` must stay aligned with the ruff ignore set — single source of truth, no drift.

## Pre-commit hooks — `.pre-commit-config.yaml`

Verified installed (no changes needed for V1):

- `ruff` + `ruff-format` (block 4)
- `pyright` (local, mirrors mypy)
- `gitleaks` v8.30.0 (block 2) + duplicate codi-managed v8.21.0 — dedupe to one version
- `bandit` — NOT installed as pre-commit hook (only listed in `dev-dependencies`). V1: add hook in block 4 invoking `uv run bandit -c pyproject.toml -r app/`.
- `pip-audit` — same story. V1: add hook in block 4 (stage `pre-push`).
- `biome` (block 5), `commitlint` (block 7), `conventional-pre-commit` (block 7) — present.

## Validator stubs (V2-V7) — per `08_subagents.md`

V1 implementation: each validator is a separate CI job in `ci.yml` invoking a `claude` subagent. Initial state = pass-through stub returning green. Ratchet to actual checks during Wave 4 per `_v2_execution_playbook.md`.

- V2 acronym-validator
- V3 compliance-domain-validator (PDPL + RLS + audit-trail integrity)
- V4 prompt-discipline-validator (No-Fabrication + citation completeness)
- V5 data-model-validator (aggregate boundaries + `tenant_id` discipline)
- V6 integration-contract-validator (JSON contracts + OpenAPI drift)
- V7 test-coverage-validator (threshold enforcement)

V2-V7 stubs MUST land before V1 sprint 1 — tracked under ST-002.

## Per-PR DoD gates (V1 cohort)

Every PR in V1 cohort:

1. CI green: lint + types + tests + coverage ≥ 80 + bandit + osv + trufflehog + gitleaks
2. Multi-tenancy isolation regression (ST-207) GREEN — required job
3. Pillar invariants preserved per `CORE_ARCHITECTURE.md` §6 Decision Checklist
4. ≥ 1 reviewer approval (2 for Pillar-touching stories)
5. Conventional commit format (commitlint enforced)
6. DoD checklist per layer touched (`07_definitions_of_done.md`)

## Per-sprint gates

End of sprint:

- All sprint stories merged (carryover only with deferred-with-reason note)
- No new P0/P1 incidents
- Coverage not regressed (sprint-over-sprint delta ≥ 0)
- Demo + retro held

## V1 ship gate (sprint 8 or cohort end)

Per `07_definitions_of_done.md` V1 ship checklist:

- All MUST-V1 stories merged + DoD satisfied
- External pen-test pass (qualified team)
- Q-CAP-3 + Q-CAP-18 ratified by Isaac
- Q-OUT placeholders + admin upload UI shipped
- Risk register R1-R5 mitigations in place
- MLRO smoke-test pass

## Enforcement

- Block any V1 story merge whose CI workflow lacks required jobs.
- The v1-gate PR is the ONLY place `ci.yml` settings flip — do not flip per-story.
- Rule `managed_by: user`; do NOT overwrite with `codi generate`.

## See also

- `../../docs/master-plan/CORE_ARCHITECTURE.md` §6 Decision Checklist
- `../../docs/master-plan/07_definitions_of_done.md` — DoD
- `../../docs/master-plan/08_subagents.md` — V2-V7 validator specs
- `../../docs/master-plan/TESTING_STRATEGY.md` — test gates
- `../../docs/master-plan/SECURITY_TESTING_PLAN.md` — security gates
- `../../docs/master-plan/_operational/SPRINT_TEMPLATE.md` — sprint structure
- `../../docs/master-plan/_operational/DEVELOPMENT_PROCESS.md` — process
- `../../docs/master-plan/_operational/_v2_execution_playbook.md` — Wave 4 ratchet plan
- Codi rules: `codi-git-workflow`, `codi-security`, `codi-testing`, `codi-production-mindset`
