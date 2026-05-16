# Capability Index — feedback-widget

Human-readable map of every skill, agent, and slash command installed in this repo's `.claude/`. The agent already has every `SKILL.md` description loaded via the system reminder — this file exists so developers (and operators of the agent) can skim the ecosystem in 30 seconds.

The rule that forces the agent to USE these capabilities proactively lives at `.claude/rules/agent-capability-discovery.md`, reinforced every turn by `.claude/hooks/inject-capability-prompt.sh`.

Total: **39 skills · 2 agents · 5 slash commands**.

---

## Intent → skill cheatsheet

| When the user says... | Reach for | Combine with |
|---|---|---|
| "audita / revisa / inspecciona X" | `improve-codebase-architecture` (if architecture) · `wiki-lint` (if vault) | `grill-with-docs`, `prototype` |
| "diagnostica / debuggea / esto rompe" | `diagnose` | `tdd` (for regression test) |
| "escribe tests / TDD / red-green" | `tdd` | `diagnose` |
| "rediseña / refactoriza / consolida" | `improve-codebase-architecture` | `prototype`, `grill-with-docs` |
| "spec / PRD / requirements" | `to-prd` | `to-issues`, `grill-with-docs` |
| "rompe esto en issues / tickets" | `to-issues` | `triage` |
| "triage / clasifica issues" | `triage` | `to-issues` |
| "prototipa / pruébame / explora" | `prototype` | `grill-with-docs` |
| "hazme preguntas / grill me / challenge me" | `grill-me` (greenfield) **or** `grill-with-docs` (project tiene CONTEXT.md/ADRs) | — |
| "summarise para próxima sesión / handoff" | `handoff` | — |
| "zoom out / map this / dame contexto" | `zoom-out` | — |
| "guarda esta conversación al wiki" | `save` | — |
| "ingresa esto al wiki" | `wiki-ingest` | `defuddle` (if URL) |
| "investiga / deep dive en X" | `autoresearch` | — |
| "qué hay sobre X en el wiki" | `wiki-query` | — |
| "lint / health-check del wiki" | `wiki-lint` | — |
| "fold log / rollup wiki" | `wiki-fold` | — |
| "limpia esta URL antes de ingresar" | `defuddle` | `wiki-ingest` |
| "nueva canvas / añade a canvas" | `canvas` | — |
| "escribe en obsidian markdown" | `obsidian-markdown` | `obsidian-bases` |
| "crea una base obsidian" | `obsidian-bases` | — |
| "crea un skill / agent / rule" | `codi-skill-creator` · `codi-agent-creator` · `codi-rule-creator` | `codi-artifact-contributor` |
| "configura codi / añade rule / preset" | `codi-dev-operations` | — |
| "diff vs upstream codi" | `codi-compare-preset` | — |
| "crea preset" | `codi-preset-creator` | — |
| "compárteme / contribuye al upstream" | `codi-artifact-contributor` | — |
| "review feedback acumulado" | `codi-refine-rules` | — |
| "instala pre-commit / husky" | `setup-pre-commit` | — |
| "guardrails de git" | `git-guardrails-claude-code` | — |
| "edita / mejora un artículo" | `edit-article` | — |
| "scaffold ejercicios" | `scaffold-exercises` | — |
| "migrate to shoehorn" | `migrate-to-shoehorn` | — |
| "modo caveman / sé breve" | `caveman` (mode) | — |

When two skills could fire, prefer the more specific one. When the intent is ambiguous, ask one tight clarifying question — do not run two skills speculatively.

---

## Catalogue by domain (40 skills)

### Vault / knowledge (11)
`wiki`, `wiki-ingest`, `wiki-query`, `wiki-lint`, `wiki-fold`, `save`, `autoresearch`, `canvas`, `defuddle`, `obsidian-markdown`, `obsidian-bases`

### Engineering workflow (12)
`improve-codebase-architecture`, `to-prd`, `to-issues`, `triage`, `tdd`, `diagnose`, `prototype`, `zoom-out`, `handoff`, `simplify`, `grill-me`, `grill-with-docs`

### Codi operations (10)
`codi-dev-operations`, `codi-skill-creator`, `codi-rule-creator`, `codi-agent-creator`, `codi-artifact-contributor`, `codi-preset-creator`, `codi-compare-preset`, `codi-dev-docs-manager`, `codi-rule-feedback`, `codi-refine-rules`

### Setup / chores (5)
`setup-pre-commit`, `git-guardrails-claude-code`, `migrate-to-shoehorn`, `scaffold-exercises`, `edit-article`

### Browser / UI testing (1)
`agent-eyes-browser` — routing entre agent-browser (ojos del agente) y Playwright (E2E) en feedback-widget

### Communication mode (1)
`caveman`

### Built-in (mode-flagged) (provided by Claude Code itself, not under .claude/skills/)
`init`, `review`, `security-review`, `loop`, `schedule`, `update-config`, `keybindings-help`, `fewer-permission-prompts`, `claude-api`

---

## Agents (2)

Both are execution layers triggered from skills/commands, not orchestrators.

| Agent | Role |
|---|---|
| `wiki-lint` | Wiki health audit (orphans, dead links, stale claims) |
| `wiki-ingest` | Parallel batch ingestion of multiple sources |

---

## Slash commands (5)

All 1:1 routes to namesake skill. No discoverability issue.

| Command | Routes to |
|---|---|
| `/wiki` | `wiki` |
| `/canvas` | `canvas` |
| `/save` | `save` |
| `/wiki-query` | `wiki-query` |
| `/autoresearch` | `autoresearch` |

---

## Known overlaps and how to disambiguate

| Pair | Disambiguation rule |
|---|---|
| `grill-me` ↔ `grill-with-docs` | `grill-with-docs` when CONTEXT.md / ADRs exist; `grill-me` for greenfield (no documented domain model) |
| `to-prd` ↔ `to-issues` ↔ `triage` | `to-prd` for full product spec · `to-issues` for breaking a spec into vertical slices · `triage` for managing inbound issues |
| `codi-skill-creator` (was duplicated by `write-a-skill` — removed) | Canonical skill author is `codi-skill-creator` only |
| `wiki-ingest` ↔ `save` ↔ `autoresearch` | `save` for current conversation · `wiki-ingest` for external sources · `autoresearch` for iterative web research |
| `improve-codebase-architecture` ↔ `simplify` | `improve-codebase-architecture` is structural / depth-of-modules · `simplify` reviews changed code for quality |
| `obsidian-markdown` ↔ `obsidian-bases` | `obsidian-markdown` for prose/syntax · `obsidian-bases` for dynamic database views over notes |

---

## Maintenance

- Adding a new skill → use `codi-skill-creator`. Update this file's intent cheatsheet and domain catalogue.
- Removing a skill → grep references in `.claude/`, `.codi/`, `docs/`, `vault/`; update this file; explain in the commit.
- Refining triggers → bump version in the skill's frontmatter when editing the source template; for direct `.claude/skills/<name>/SKILL.md` edits no version bump needed.
- Evals → at minimum, the 10 most-used skills should ship `evals/evals.json` with trigger-positive + trigger-negative cases. Tracked under `.codi/feedback/` once present.

## Output tone

Project default is **caveman** (Iron Law 8 + UserPromptSubmit hook injection). Three escape mechanisms:

| Mechanism | Scope |
|---|---|
| Type `?` at start of prompt | This turn only |
| Natural language (`modo normal`, `no caveman`, `disable caveman`, etc.) | This turn only |
| `echo "normal" > .claude/output-mode.local` | Entire checkout, persistent (`rm` to revert) |

Full policy: `.claude/rules/output-tone-policy.md`.

## See also

- `.claude/rules/agent-capability-discovery.md` — behavioural mandate
- `.claude/rules/output-tone-policy.md` — caveman default + escape mechanisms
- `.claude/hooks/inject-capability-prompt.sh` — per-turn reinforcement + tone override
- `.claude/rules/dev-vault-discipline.md` — one-skill-per-capability policy, vault landing table
- `.claude/rules/codi-improvement-dev.md` — how to flag overlaps via OBSERVATION captures
- `vault/wiki/hot.md` — recent-context cache (read at every session start)
