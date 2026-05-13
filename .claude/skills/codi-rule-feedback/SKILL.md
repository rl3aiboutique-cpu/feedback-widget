---
name: codi-rule-feedback
description: 'Rule observation skill. Activates automatically when the agent notices a gap, outdated guidance, missing example, or user correction related to a loaded rule. Emits an end-of-response \`|OBSERVATION: "verbatim text"|\` capture marker — the Stop hook persists it into brain.db where the P9 pattern detector turns repeat references into artifact-improvement proposals. Mention the rule name and the gap kind (`missing-step`, `outdated-rule`, `missing-example`, `user-correction`, `trigger-miss`, `trigger-false`, `wrong-output`) inside the verbatim text. Background observer — the agent does not write files. Do NOT emit for single-occurrence anecdotes (require 2+ evidence points), do NOT directly edit rule files (use codi-refine-rules), and do NOT emit during time-critical operations (bug incidents, blocking hot fixes).'
user-invocable: false
---

# codi-rule-feedback — Rule Feedback

## When to Activate

- A codebase pattern repeats 2+ times but no loaded rule covers it
- A loaded rule recommends something the project has moved away from
- A loaded rule covers a topic but lacks a relevant BAD/GOOD example
- The user corrects behavior that contradicts or extends a loaded rule
- A loaded rule's trigger fired when it should not have, or failed to fire when it should have

## Skip When

- Time-critical operations (bug incidents, blocking hot fixes) — observations can wait
- Single-occurrence anecdotes without 2+ evidence points (except user corrections)
- Applying rule changes to the codebase — use codi-refine-rules
- Creating a brand-new rule from scratch — use codi-rule-creator
- The session has already emitted 3 observations — focus on the most impactful

## Purpose

You are both a consumer and an observer of the rules loaded into your context. When you notice a gap, outdated guidance, or missing example, emit a one-line marker in your response. The system collects and structures this automatically — you do not write files.

**Rules are not changed directly.** Observations are reviewed when the user runs \`/codi-refine-rules\`.

## When to Emit an Observation

Emit a marker when ANY of these occur during your work:

### 1. New Pattern Detected
A codebase pattern appears 2+ times but no existing rule covers it.
- Example: Every service uses a Result type for error handling, but no rule documents this.
- Category: \`missing-step\`

### 2. Outdated Rule
A rule recommends something the codebase has moved away from.
- Example: Rule says "use ESLint + Prettier" but the project uses Biome exclusively.
- Category: \`outdated-rule\`

### 3. Missing Example
A rule covers a topic but lacks a BAD/GOOD example for a pattern you encounter.
- Example: The testing rule says "mock only external dependencies" but shows no example for this project's DI container.
- Category: \`missing-example\`

### 4. User Correction
The user corrects behaviour that contradicts or extends a rule.
- Example: User says "don't mock the database in these tests."
- Category: \`user-correction\` (severity: high — always emit)

## How to Emit

End your response with a canonical Iron Law 9 capture marker:

\`\`\`
|OBSERVATION: "verbatim text — name the rule and the gap kind"|
\`\`\`

The rule name and gap category live INSIDE the verbatim text. Use the gap
vocabulary so the brain's consolidation can match observations to artifact
candidates: \`missing-step\`, \`outdated-rule\`, \`missing-example\`,
\`user-correction\`, \`trigger-miss\`, \`trigger-false\`,
\`wrong-output\`.

**Example:**

\`\`\`
|OBSERVATION: "codi-testing outdated-rule — rule says use Jest but project migrated to Vitest, all test files use vitest imports"|
\`\`\`

The Stop hook parses every \`|TYPE: "..."|\` marker on the line, persists
captures into brain.db (\`captures\` table), and the P9 detector
aggregates repeat references into artifact-improvement proposals. You do
not touch the file system.

## Guardrails

- **Max 3 observations per session** — focus on the most impactful gaps
- **Require 2+ evidence points** — no single-occurrence anecdotes
- **User corrections are always high severity** — always emit them, no evidence threshold
- **Do not announce observations** — emit the marker inline, do not draw attention to it

## What NOT to Capture (false-positive filter)

Reject these as noise — they pollute the captures table without payoff:

- **Conversational acknowledgements** ("ok", "yeah", "thanks", "got it",
  "sounds good", "perfect") — they confirm receipt, not content.
- **Approval / rejection of a proposed action** ("go ahead", "do it", "no
  don't", "skip that") — control flow, not knowledge.
- **Verbatim quoting of the prompt back** as a PROMPT capture — the prompts
  table already has it; doubling adds no signal.
- **Generic facts** the agent could derive any time from the codebase
  (\`this project uses TypeScript\`).
- **Ephemeral session state** (\`user is currently working on auth\`) —
  workflow_runs tracks that.

Emit only when the marker carries **concrete, reusable content** with at
least one specific actor named (artifact, file, technology, pattern).

## Related Skills

- **codi-refine-rules** — Review (summary) and refine (interactive edits) rules from collected feedback

<!-- Generated by Codi | Do not edit — run: codi generate -->
