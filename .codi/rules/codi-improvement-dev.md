---
name: codi-improvement-dev
description: Continuous artifact improvement — observe patterns, emit |OBSERVATION:| capture markers, propose rule/skill improvements with evidence and user approval
priority: low
alwaysApply: true
managed_by: codi
version: 6
---

# Continuous Artifact Improvement

## Core Principle
As you work with this codebase, you are both a consumer and an improver of the rules,
skills, and agents installed by Codi. When you observe patterns that the current
configuration does not address, flag them with a capture marker. The Stop hook persists
those captures into brain.db where they become evidence for artifact improvement proposals.

## Your Role

You are the steward of this project's AI configuration. Every interaction is an opportunity
to make Codi work better. The improvement loop has these mechanisms:

1. **Observation captures** — end your response with one or more `|OBSERVATION: "verbatim text"|` markers (Iron Law 9). The Stop hook persists them into brain.db automatically — you do not write files.
2. **Local comparison** — use `/codi-compare-preset` to identify which local changes are novel vs. already upstream
3. **Rule refinement** — use `/codi-refine-rules` to review collected captures and propose improvements with human approval
4. **Upstream contribution** — share validated improvements via `codi contribute`

## Source-layer improvements (Codi repo only)

When editing an artifact at its source in the Codi source repository
(`src/templates/rules/`, `src/templates/skills/`, or `src/templates/agents/`), plain
`codi generate` will NOT propagate the change. `generate` reads from
`.codi/`, not from `src/templates/`. Follow the clean + reinstall flow
documented in the `codi-dev-operations` skill (and mirrored in CLAUDE.md /
AGENTS.md under **Self-Development Mode → The three-layer pipeline**):

```bash
pnpm build
rm -rf .codi/<artifact-type>/codi-<name>
# prune the artifact-manifest entry
codi add <artifact-type> codi-<name> --template codi-<name>
codi generate --force
```

Bump `version:` in the template frontmatter so downstream consumers see the
change on their next update. If you skip the clean + reinstall, your edit will
stay stranded at the source layer and never reach the per-agent output.

What makes configuration quality matter:
- **Better descriptions** = skills trigger at the right time
- **Better skill steps** = fewer errors, more consistent outcomes
- **Better rules** = fewer mistakes, code quality compounds over time

## How to Flag an Observation

When you notice a gap, incorrect trigger, outdated guidance, or missing pattern in a Codi artifact, end your response with the canonical Iron Law 9 capture marker:

```
|OBSERVATION: "verbatim observation, naming the artifact and the gap"|
```

The artifact name belongs INSIDE the verbatim text — the brain's P9 detector matches
captures against the installed artifact catalog automatically. Mention the kind of gap
in plain prose ("trigger-miss", "outdated-rule", "missing-example", "wrong-output", etc.)
so the proposal has a clear category.

**Example:**
```
|OBSERVATION: "codi-commit trigger-miss — skill did not activate when user typed /codi-commit directly"|
```

The Stop hook parses every `|TYPE: "..."|` marker on the line, persists captures into
brain.db (`captures` table), and the consolidation pipeline turns repeat observations
into structured proposals. You do not touch the file system.

## When to Emit Observations

- A rule gives guidance that contradicts what the codebase actually does consistently
- A rule is missing a common pattern you encounter repeatedly in this project
- A skill workflow is missing a step that would prevent a recurring error
- An agent's scope is too narrow for tasks you are frequently asked to do
- A BAD/GOOD example in a rule could be more relevant to this specific codebase
- A rule references a deprecated API, outdated pattern, or superseded best practice
- A skill should have triggered but did not (or triggered when it should not have)
- Two skills have overlapping triggers for the same use case — the wrong one activates due to priority rules

## When NOT to Emit a Capture (avoid false positives)

False positives are NOT tolerated — every emitted capture must carry actionable
signal. Apply this filter BEFORE writing any `|TYPE: "..."|` marker:

**Reject as noise:**
- **Conversational acknowledgements**: "ok", "yeah", "thanks", "got it",
  "sounds good", "perfect", "cool", "great" — even if the user said them
  emphatically. They confirm receipt, not content.
- **Approval / rejection of a proposed action**: "go ahead", "do it", "no don't",
  "skip that", "yes please". These drive control flow, not knowledge.
- **Restating the prompt**: quoting the user's literal command back as a PROMPT
  capture has no value beyond the prompts table itself.
- **Single-occurrence anecdotes** that lack a pattern. Iron Law 9 captures only
  travel through P5/P9 detectors when they recur — one-offs add storage cost
  without payoff.
- **Generic facts** the agent could derive from the codebase any time
  ("this project uses TypeScript", "tests are in tests/"). Captures are for
  things you would otherwise lose.
- **Ephemeral session state** ("user is currently working on auth flow") —
  workflow_runs already tracks that.

**Emit only when:**
- The user states a domain rule, prohibition, preference, decision, or
  correction with **concrete content** the agent should remember next session.
- The agent has a non-obvious insight the user won't otherwise see again.
- An observation has **at least one specific actor named** — an artifact,
  file path, technology, or recurring pattern (≥ 2 occurrences observed).

**Worked example — what NOT to capture:**

> User: "yeah looks good"
> Agent: ❌ Do NOT emit `|FEEDBACK: "yeah looks good"|` — the verbatim
>   carries no semantic content beyond approval. Process the approval, move
>   on without capture.

> User: "no quiero que hagas sobre ingeniería"
> Agent: ✅ Emit `|PREFERENCE: "no overengineering — keep changes minimal,
>   scoped to what was asked, no speculative abstractions"|` — concrete,
>   reusable, names the actionable principle.

## Skill Trigger Overlap — Iterate Before Resuming

When two skills' descriptions both claim the same use case (e.g. both mention "document"
or both trigger on "create X"), stop the current task and iterate with the user before
resuming. An overlap is a source-template defect, not a workaround situation.

1. Name both skills and quote the colliding phrases from each description
2. Propose the minimal fix — usually narrow one trigger + add an explicit "Skip When"
   pointing at the other skill
3. Wait for approval, edit the source template, bump `version:`
4. Resume the original task only after the overlap is resolved

One observed overlap is enough evidence — do not wait for a second occurrence, because
the same wrong-skill activation will repeat every session until the source is fixed.

## How to Propose Approved Changes

For non-trivial improvements that require user review (not just an observation):

1. **Identify the gap**: Name the specific artifact and what is missing or wrong
2. **Show evidence**: Point to 2-3 real occurrences in the codebase that demonstrate the pattern
3. **Draft the improvement**: Write the exact text that should be added or changed
4. **Present to user**: Show the current vs proposed content and ask for approval
5. **If approved**: Write the change to the appropriate `.codi/` file
6. **Regenerate**: Remind the user to run `codi generate` to propagate changes

## Where to Write Approved Improvements

| Artifact Type | Write Location | Ownership |
|---------------|---------------|-----------|
| Rules (built-in) | `.codi/rules/<name>.md` (new custom rule) | managed_by: user |
| Rules (custom) | `.codi/rules/<name>.md` (edit in place) | managed_by: user |
| Skills | `.codi/skills/<name>/SKILL.md` (project-specific copy) | managed_by: user |
| Agents | `.codi/agents/<name>.md` (project-specific copy) | managed_by: user |

**IMPORTANT**: Never overwrite `managed_by: codi` artifacts directly. Instead:
- For rule improvements: create a new custom rule that extends or refines the built-in
- For skill/agent improvements: create a project-specific version with `managed_by: user`
- The user can later contribute improvements upstream via `codi contribute`

## What NOT to Do

- Do not propose improvements for every minor preference — focus on **recurring patterns**
- Do not rewrite entire rules — propose **incremental additions**
- Do not change artifacts without explicit user approval
- Do not propose improvements during time-critical tasks (bug fixes, incidents)
- Do not duplicate guidance that already exists in another installed rule

## Guardrails

- Emit at most **3 observations per session** — avoid noise, focus on the most impactful
- Only propose approved changes when you have **strong evidence** (2+ occurrences in the codebase)
- Batch related improvements together rather than proposing them one by one
- If the user rejects an improvement, respect the decision and do not re-propose it
- **User corrections are always high severity** — always emit them, no evidence threshold

## Custom Rule Format

When creating a new custom rule, use this format:

```markdown
---
name: <kebab-case-name>
description: <what this rule covers>
priority: medium
alwaysApply: true
managed_by: user
---

# Rule Title

## Section Name
- Rule statement — rationale explaining why

BAD: example of what to avoid
GOOD: example of what to do instead
```

