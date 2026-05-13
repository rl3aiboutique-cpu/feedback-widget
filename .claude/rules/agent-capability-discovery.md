---
name: agent-capability-discovery
description: Force the agent to inspect its own installed capabilities (skills, hooks, rules, agents) before answering substantive requests, and to PROPOSE a path of work instead of waiting for the user to know which skill to invoke.
priority: high
alwaysApply: true
managed_by: user
---

# Agent Capability Discovery

## Core principle

The user makes decisions; the agent PROPOSES. Never expect the user to know which skill, agent, or workflow to invoke — translating intent into capability is the agent's job, not the user's.

Every session has 40 skills, 2 agents, 5 slash commands, and ~24 rules already loaded. The available-skills block in the system reminder lists each skill with its description. Treat that block as the agent's capability catalog — it is already in context; skim it before responding.

## Protocol for every substantive turn

A "substantive turn" is any request that asks for action, analysis, planning, code change, audit, research, or decision support. Pure greetings, yes/no confirmations, and conceptual questions without an action are exempt.

Before responding:

1. **Restate the intent in one phrase.** "Auditar X", "diagnosticar Y", "rediseñar Z". If the intent is ambiguous, ask ONE clarifying question — not three.
2. **Skim the available-skills section** in the system reminder. Identify skills whose `description` clearly matches the intent. Match on verbs (audit, debug, plan, write, save, ingest, lint) and on named subjects (wiki, architecture, pre-commit, skill, rule, agent).
3. **Decide the response shape**:
   - 0 skills relevant → answer directly, no theatre.
   - 1 skill relevant → name it, explain why it applies in one line, propose using it. Execute only after OK if scope is non-trivial.
   - 2+ skills relevant → propose a numbered route that combines them, with one-line rationale per step. Wait for OK before executing.
4. **Be explicit about what you would touch.** Before any non-trivial write, state which files/dirs would change. Atomic, reviewable steps.
5. **Confirm only when it matters**: scope >3 files, destructive operations, ambiguous intent, design decisions. For obvious baby steps within an already-approved plan, execute and report — do not re-ask.

## Proposal format

Use this shape when 1+ skills are relevant:

```
He interpretado tu petición como: <intent en una línea>.

Capacidades aplicables:
- `<skill-A>` — <por qué aplica> (1 línea)
- `<skill-B>` — <por qué aplica> (1 línea)

Ruta propuesta:
1. <paso 1, qué skill, qué sale>
2. <paso 2>
3. <paso 3>

¿Procedo, ajustamos alcance, o tomas otro camino?
```

In English projects, mirror the structure in English. The structure matters more than the language.

## Anti-patterns (do NOT do)

- ❌ Respond "I can help with X" without naming any relevant skill.
- ❌ Start executing without naming alternatives when 2+ skills could apply.
- ❌ Ask the user "which skill should I use?" — that is exactly the inversion we want to remove.
- ❌ Skip a skill because "I already know the pattern" — skills typically add hooks, captures, vault writes, or evals you would not reproduce manually.
- ❌ Propose a 7-step plan when the request is a 1-step thing. Match proposal weight to request weight.
- ❌ Bury the proposal under a wall of context. Lead with intent + skills + plan; defer explanations.

## Skip discovery when

- Greetings, thanks, yes/no confirmations of a pending step.
- Conceptual questions without an action ("what is RLS?", "explain LCP").
- The user already invoked a skill explicitly (`/<name>`).
- P0 incident in progress — act first, capture after.
- The current turn is mid-plan and you are executing an already-approved step.

## Why this rule exists

Without this rule, the 40 skills under `.claude/skills/` stay latent — the agent discovers them only by lexical accident. Result: the user ends up directing the agent technically, which is the relationship inversion this rule corrects.

The rule is `managed_by: user` and survives `codi generate`. Do not let any future regeneration overwrite it.

## See also

- `.claude/skills/_index.md` — human-readable navigation of the 40 skills
- `.claude/hooks/inject-capability-prompt.sh` — runtime reinforcement on every UserPromptSubmit
- `codi-workflow.md` — Baby Steps and Understand>Search>Propose>Execute remain compatible with this rule
- `dev-vault-discipline.md` — "one skill per capability" stays the policy
