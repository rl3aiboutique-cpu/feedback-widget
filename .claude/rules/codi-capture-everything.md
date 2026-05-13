# (codi-rule) codi-capture-everything

# Capture Everything (Iron Law 9)

## Core Rule

The agent MUST emit \`|TYPE: "verbatim content"|\` markers at the **end** of any response that detected one of the canonical capture types. The dev never persists manually; the agent is responsible for proactive capture.

## Canonical capture types (closed set)

This list is exhaustive. The parser auto-promotes any marker with a
non-canonical TYPE to \`OBSERVATION\`, prefixing the content with
\`[unknown_type=<RAW>]\` and preserving the literal marker in the
\`raw_marker\` column. A stderr warning is also emitted so the typo
is visible during the session. Prefer the canonical type whenever it
fits — auto-promotion is a safety net, not the default path. Synonyms
to avoid: \`BUG\`, \`ERROR\`, \`NOTE\`, \`TODO\`,
\`HIGHLIGHT\`.

| Type | When to emit |
|------|--------------|
| \`RULE\` | The user states a normative rule for future behavior. |
| \`PROHIBITION\` | The user forbids an action ("never", "don't", "stop"). |
| \`PREFERENCE\` | The user expresses a non-binding preference. |
| \`FEEDBACK\` | The user evaluates the agent's work positively or negatively. |
| \`INSIGHT\` | The user reveals a non-obvious fact about the codebase, team, or domain. |
| \`OBSERVATION\` | The agent itself notices a pattern worth recording. |
| \`DECISION\` | The user picks one path among presented options. |
| \`QUESTION\` | The user asks something that should be answered later, not now. |
| \`PROMPT\` | The user provides reusable wording the agent should remember. |
| \`CORRECTION\` | The user fixes a mistake the agent made — always high-severity. |
| \`DEFECT\` | The agent finds a real bug in code (file:line + symptom + fix hint). |

## Format

\`\`\`
|TYPE: "single-line verbatim content"|
\`\`\`

- Exactly one type, ONE colon, ONE space, then the content in straight double quotes.
- Embedded quotes escape as \`\\"\`. No multi-line content.
- Multiple markers per turn are allowed; emit them in the order the events occurred.
- Place markers at the **end** of the agent response — after all prose / code / tool reports.

## False-positive policy

A false positive — capturing something the user didn't actually say or
something with no long-term value — pollutes the brain and is **NOT**
tolerated. A false negative — missing a real rule — is recoverable via
offline consolidation. When unsure: **do not emit.**

## Long-term value test (apply BEFORE every marker)

The brain is for **rules, improvements, defects, and decisions that will
help the team and the system across future sessions** — never for
session bookkeeping. Before emitting any marker, ask:

1. **Will a future session benefit from knowing this?** If the answer is
   "only this turn", do not emit.
2. **Is there a named actor?** A capture must point at something concrete
   — an artifact, file path, technology, command, recurring pattern.
   Markers without a specific subject are noise.
3. **Is the content reusable verbatim?** If the content rephrased the
   user's prompt or restated what just happened, it is bookkeeping, not
   knowledge. Do not emit.

If any answer fails, **suppress the marker.** It is always cheaper to
miss a capture than to pollute the brain with a turn-local note.

## Hard reject patterns (NEVER emit)

These shapes look canonical but carry no long-term value. Always reject
them no matter how strongly they match the grammar:

| Pattern | Why it is noise |
|---------|-----------------|
| \`FEEDBACK: "user pidió/asked for X"\` | Restatement of the prompt — already in the prompts table. |
| \`FEEDBACK: "user wants X / preguntó X"\` | Same — bookkeeping about the user's request, not their content. |
| \`QUESTION: "<a question the agent asked the user>"\` | Control flow, not content. Questions captured belong to the user, not the agent. |
| \`DECISION: "<an ephemeral path choice for this turn>"\` | \`workflow_runs\` already records control flow. Captures are for durable rules. |
| \`OBSERVATION: "<the agent's own opinion>"\` | The OBSERVATION type is for **detected patterns** with at least 2 occurrences. Opinions go in the response prose. |
| \`RULE: "<one-shot guidance for this turn>"\` | If the rule does not generalise to the next session, it is not a rule. |
| \`PREFERENCE: "ok / yeah / sure / vamos"\` | Approvals are control flow tokens, not preferences. |
| \`PROMPT: "<the user's literal command>"\` | The prompts table stores it already. PROMPT is for reusable wording (e.g. boilerplate the agent should reuse). |

When the agent catches itself drafting one of these shapes mid-response,
**delete the draft** — do not "salvage" it with a softened verbatim.

## Conditional accept patterns (emit ONLY when content is durable)

These types are valid emit targets, but only when the content carries
forward signal:

- \`RULE / PROHIBITION / PREFERENCE\` — the user states something the
  agent must apply in **future sessions**.
- \`INSIGHT\` — non-obvious fact about codebase, team, domain that
  would otherwise be lost.
- \`CORRECTION\` — user fixes an agent mistake; **always** durable
  because it prevents the same error next time.
- \`DEFECT\` — real bug with \`file:line + symptom + fix hint\`.
  Pure code observations without a fix hint go in \`OBSERVATION\`.
- \`OBSERVATION\` — agent-detected pattern that has occurred at least
  **twice** in the session and names the artifact / file / technology
  involved.

## Worked examples (right vs wrong)

User: "Always commit at the end of a session, never per fix."
✅ \`|RULE: "commit at end of session, not per fix"|\`
Reason: durable, names the action, applies cross-session.

User: "Don't use git worktrees in this project."
✅ \`|PROHIBITION: "no git worktrees in this project"|\`
Reason: scope ("this project") + named technology.

User: "No, that's not right — \`pnpm\` not \`npm\`."
✅ \`|CORRECTION: "use pnpm not npm"|\`
Reason: corrections are always durable.

User: "perfecto, ahora mejora X"
❌ \`|FEEDBACK: "user wants me to improve X"|\` — restatement of the
prompt, no long-term content. Suppress.

Agent (to user): "Should I do A or B?"
❌ \`|QUESTION: "should I do A or B?"|\` — agent's own question, not
user content. Suppress.

User: "ok, dale"
❌ \`|PREFERENCE: "ok dale"|\` — approval token, control flow.
Suppress.

Agent finds a real bug at \`src/runtime/capture/stop-hook.ts:235\`
where Codex shape is not handled.
✅ \`|DEFECT: "stop-hook extractAssistantText missing Codex shape (response_item/payload.role=assistant) — fix at src/runtime/capture/stop-hook.ts"|\`
Reason: file path + concrete symptom + fix hint.

## Boundary

This rule defines **emission**. The runtime parser (\`src/runtime/capture/markers.ts\`) deduplicates by \`(turn_id, raw_marker)\` and persists into the \`captures\` table. Re-emitting the same marker on a subsequent turn is harmless.

<!-- Generated by Codi | Do not edit — run: codi generate -->
