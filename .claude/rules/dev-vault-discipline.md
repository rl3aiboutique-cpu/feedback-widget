---
name: dev-vault-discipline
description: Persist all Iron Law 9 markers and design decisions to the project Obsidian vault at vault/wiki so every developer and every agent shares the same brain
priority: high
alwaysApply: true
managed_by: user
---

# Dev Vault Discipline

The repo ships a shared Obsidian vault at `vault/` (root). It is the canonical, human-readable brain for every developer and every agent on this project. brain.db is the machine-readable mirror; the vault is the readable, reviewable surface.

## The mandate

Every Iron Law 9 marker the agent emits MUST also produce a vault page. Markers without a vault page are incomplete capture. The Codi Stop hook handles brain.db; the agent is responsible for the vault side.

| Marker type | Vault destination | Page shape |
|---|---|---|
| DECISION | `vault/wiki/captures/decision/YYYY-MM-DD_<slug>.md` | ADR-lite: context, options, choice, rationale |
| OBSERVATION | `vault/wiki/captures/observation/<artifact-or-area>.md` | append entry with date + verbatim |
| DEFECT | `vault/wiki/captures/defect/YYYY-MM-DD_<slug>.md` | file:line + symptom + fix hint |
| CORRECTION | `vault/wiki/captures/correction/<topic>.md` | append entry — what was wrong + correct version |
| INSIGHT | `vault/wiki/captures/insight/<topic>.md` | append entry — non-obvious fact + why it matters |
| PROMPT | `vault/wiki/captures/prompt/<slug>.md` | reusable wording + when to apply |
| RULE | `vault/wiki/captures/rule/<slug>.md` | the rule + scope + rationale |
| PROHIBITION | `vault/wiki/captures/prohibition/<slug>.md` | the prohibition + scope + reason |
| PREFERENCE | `vault/wiki/captures/preference/<slug>.md` | the preference + scope |
| FEEDBACK | `vault/wiki/captures/feedback/YYYY-MM-DD.md` | append daily journal entry |
| QUESTION | `vault/wiki/captures/question/<slug>.md` | the question + context + state (open/answered) |

Slugs: kebab-case, max 6 words. Append-mode pages must include a `## YYYY-MM-DD HH:MM` heading per entry so history is preserved.

## Frontmatter contract

Every vault page must start with:

```yaml
---
type: <marker-type-lowercase>
created: YYYY-MM-DD
author: claude-code
source: <session-id-or-task-id>
tags: [<area>, <topic>]
---
```

Append-mode pages keep the original frontmatter and add entries below.

## When to write

The agent writes to vault in the SAME turn the marker is emitted. Use the `/save` skill when the conversation contains a substantive answer worth filing whole. Use direct Write/Edit for atomic marker pages. Never defer "I will save this later" — the next session will not remember.

## Hot cache discipline

`vault/wiki/hot.md` is the entry point every session. After any non-trivial change to vault content, the agent updates `hot.md` to reflect:

- Last Updated (ISO timestamp)
- Key Recent Facts (≤ 5 bullets, ≤ 500 words total)
- Recent Changes (last 3 sessions)
- Active Threads (open QUESTIONS, pending DECISIONS)

The SessionStart hook reads `hot.md` automatically. The Stop hook reminds the agent when vault pages changed and `hot.md` is stale.

## Cross-references

Use Obsidian wikilinks (`[[page-name]]`) to connect markers across types. Example: a DECISION resolves an OBSERVATION → the decision page links `Resolves: [[observation/<page>]]`. The `wiki-lint` skill catches dead links and orphans.

## What NOT to write to the vault

- Conversational acknowledgements ("ok", "thanks", "got it") — already filtered by Iron Law 9 false-positive policy
- Approvals / rejections of proposed actions — control flow, not knowledge
- Restatements of the user prompt
- Ephemeral session state (current branch, current task) — workflow_runs and brain.db already cover this

If the marker would have been suppressed under `codi-capture-everything.md` § False-positive policy, do NOT write a vault page for it either.

## Multi-agent expectation

Cursor, Codex, Windsurf, and any other Claude Code session in this repo MUST read `vault/wiki/hot.md` at session start. The brain is shared, the vault is the substrate. Per-agent configurations live in their own dirs (`.cursor/`, `.codex/`, etc) but all point at the same `vault/`.

## Health checks

Every ~10-15 captures or weekly (whichever is sooner), run `lint the wiki` (skill: `wiki-lint`). The lint catches:

- Orphan pages with no inbound links
- Dead wikilinks
- Stale claims (no edits in 90+ days flagged for review)
- Missing frontmatter
- Empty sections

Fix orphans by adding inbound links from `hot.md` or topic indices. Fix dead links by either creating the target page or removing the broken link.

## Git workflow

Vault changes auto-commit via the PostToolUse hook (`vault: auto-commit <timestamp>`). The auto-commit is intentional: every session leaves a forensic trail. Do NOT amend or rewrite these commits in normal workflow. Squash only at PR merge if vault noise is excessive.

`vault/` is committed in full — notes, `.obsidian/` config, templates. Every developer who pulls gets the same Obsidian setup (graph view, colors, CSS) and the same shared brain.

## Skip when

- Time-critical incident response (P0 production bug): postpone capture until incident is closed, then file a single post-mortem `DECISION` page with the timeline
- Trivial typo / formatter-only commits: no marker, no vault page
- Generated artifact regenerations: `codi generate` output is not vault-worthy

## mattpocock skill outputs → vault

The repo ships the mattpocock/skills set under canonical (unprefixed) names: `triage`, `to-issues`, `to-prd`, `prototype`, `grill-with-docs`, `grill-me`, `handoff`, `setup-pre-commit`, `git-guardrails-claude-code`, `migrate-to-shoehorn`, `scaffold-exercises`, `edit-article`, `setup-matt-pocock-skills`, `tdd`, `diagnose`, `zoom-out`, `improve-codebase-architecture`, `caveman`. These skills do not emit Iron Law 9 markers themselves, but every completed run produces a durable artifact that MUST land in the vault.

For new-skill authorship use `codi-skill-creator` (canonical, codi-managed). The `write-a-skill` mattpocock variant was removed to keep one-skill-per-capability.

| Skill | Vault landing |
|---|---|
| `triage` / `to-issues` | `vault/wiki/captures/decision/<YYYY-MM-DD>_triage-<slug>.md` — issue/triage outcome with links to issue tracker |
| `to-prd` | `vault/wiki/captures/decision/<YYYY-MM-DD>_prd-<slug>.md` — PRD mirror with `Resolves: [[question/...]]` link |
| `prototype` | `vault/wiki/captures/insight/prototype-<slug>.md` — what was learned + promote/discard call |
| `grill-with-docs` / `grill-me` | `vault/wiki/captures/decision/<YYYY-MM-DD>_grilled-<slug>.md` — resolved branches of the decision tree |
| `handoff` | `vault/wiki/captures/insight/handoff-<YYYY-MM-DD>_<slug>.md` — compacted handoff so the next agent picks up |
| `tdd` / `diagnose` | `vault/wiki/captures/decision/<YYYY-MM-DD>_<tdd or diagnose>-<slug>.md` — green test added, bug root cause, regression guard |
| `improve-codebase-architecture` / `zoom-out` | `vault/wiki/captures/insight/<area>.md` — architectural deepening map or zoomed-out context |
| `codi-skill-creator` | `vault/wiki/captures/rule/skill-<slug>.md` — declares the new skill + when to trigger |
| `setup-pre-commit` / `git-guardrails-claude-code` / `setup-matt-pocock-skills` | `vault/wiki/captures/decision/<YYYY-MM-DD>_setup-<slug>.md` — config drift + rollback path |
| `migrate-to-shoehorn` / `scaffold-exercises` / `edit-article` | single `INSIGHT` page summarising change + scope |
| `caveman` | no vault write — communication mode, not a producer |

Skip the vault write only when the skill produced no durable artifact (user aborted, dry-run only). Otherwise: skill output → vault page, every time.

### Grill sessions — ONE consolidated doc per session

`grill-me` and `grill-with-docs` are the canonical exception to the "marker → page" rule. A grill is a multi-turn interview that resolves a decision tree. Filing one page per turn (or one per Iron Law 9 marker) scatters the tree across N tiny files and defeats the point.

Policy:

- During an active grill, **suppress Iron Law 9 emission for `DECISION`, `QUESTION`, `OBSERVATION`, `INSIGHT`, `PREFERENCE`, `PROMPT`**. Hold them in working memory instead.
- `CORRECTION` markers still fire individually (always high-severity, always durable). `DEFECT` markers still fire if real code bugs are found during exploration.
- When the user signals close (natural conclusion or explicit "ok ya está" / "pausemos" / "hemos terminado"), write ONE doc to `vault/wiki/captures/decision/<YYYY-MM-DD>_grilled-<slug>.md` that consolidates the resolved tree, with a "Pending" section for paused branches and a "Resume hint" for the next session.
- `grill-with-docs` continues to update `CONTEXT.md` and `docs/adr/` INLINE as terms crystallise — those are repo docs, not vault captures, and follow their own discipline.
- If the grill aborts before any branch is resolved, write no vault page. The work was conversational, not durable.

The behavioural details live in `.claude/skills/grill-me/SKILL.md` and `.claude/skills/grill-with-docs/SKILL.md` — this rule is the cross-skill policy that makes the per-session-one-doc invariant enforceable.

## One skill per capability

The ecosystem keeps ONE skill per capability — no `mp-*` prefixes, no parallel variants. If a future overlap appears (e.g. someone installs `codi-tdd` alongside the existing `tdd`), resolve it at the source: pick a winner, delete the loser, update this rule. Do not ship duplicates.

## See also

- `codi-capture-everything.md` — defines the 11 marker types and false-positive policy
- `codi-improvement-dev.md` — how observations flow into artifact improvement
- `.claude/skills/wiki/SKILL.md` — vault setup and routing
- `.claude/skills/save/SKILL.md` — conversation-to-vault filing
- `.claude/skills/wiki-lint/SKILL.md` — health checks
- `.claude/skills/triage/SKILL.md`, `.claude/skills/to-issues/SKILL.md`, `.claude/skills/to-prd/SKILL.md` — mattpocock issue/PRD workflows
- `.claude/skills/handoff/SKILL.md` — conversation handoff
- `.codi/state/brain.db` — machine mirror of all Iron Law 9 captures (Codi)
