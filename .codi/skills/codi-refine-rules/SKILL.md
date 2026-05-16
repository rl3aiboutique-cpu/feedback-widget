---
name: codi-refine-rules
description: |
  Review and refine rules from collected feedback. Two modes: REVIEW (read-only
  summary of \`.codi/feedback/\` grouped by artifact with top 3
  actions) and REFINE (interactive one-at-a-time approval flow that edits rule
  files and runs \`codi generate\`). Use when the user asks to
  review collected observations, show accumulated feedback, audit
  \`.codi/feedback/\`, improve rules, refine rules, process rule
  feedback, apply rule updates, or fix outdated rules. Also activates on
  /codi-refine-rules or phrases like "show feedback summary",
  "what's accumulated", "review observations", "process rule feedback",
  "update outdated rule". Do NOT activate for creating a brand-new rule (use
  codi-rule-creator), emitting new observations during work (that
  happens automatically via codi-rule-feedback), or general quality
  audits without collected feedback (use codi-compare-preset).
category: Codi Platform
compatibility: [claude-code, cursor, codex, windsurf, cline, copilot]
managed_by: codi
user-invocable: true
disable-model-invocation: false
version: 8
---

# codi-refine-rules — Review and Refine Rules

Three modes on one pipeline:

| Mode | Trigger | Output | Modifies rules? |
|------|---------|--------|-----------------|
| **REVIEW** | "show feedback", "what's accumulated", "summary" | Read-only grouped summary | No |
| **REFINE** | "refine rules", "improve rules", "process feedback", /codi-refine-rules | Interactive one-at-a-time approval + edits | Yes |

Start in REVIEW mode when the user just wants visibility. Move to REFINE when they are ready to apply changes.

## Skip When

- User wants to create a brand-new rule — use codi-rule-creator
- User is emitting a new observation during coding work — codi-rule-feedback handles it automatically
- User wants to diff local rules vs upstream templates — use codi-compare-preset
- No feedback has been collected yet — wait for codi-rule-feedback to accumulate observations
- Feedback directory is empty — this skill still works but reports "no observations"

---

## Mode: REVIEW (read-only summary)

Read the observations collected in \`.codi/feedback/\` and show a concise summary grouped by artifact. This is the first step before running the REFINE mode.

Observations are written automatically by the Stop hook — the agent emits a \`[CODI-OBSERVATION: ...]\` marker in its response and the hook structures it into JSON. You do not write feedback files manually.

### REVIEW Steps

1. Read all JSON files in \`.codi/feedback/\`
2. Group observations by \`artifactName\` (skill or rule)
3. Within each group, sort by severity (high → medium → low), then by timestamp (newest first)
4. Show the top 3 most actionable observations across all groups
5. For each, show: artifact name, category, observation text, severity, and date

### REVIEW Output Format

\`\`\`
## Feedback Summary — N observations across M artifacts

### codi-commit (2 observations)
1. [HIGH] trigger-miss — skill did not activate when user typed /codi-commit directly (2026-04-10)
2. [LOW] missing-step — no step to verify staged files are not empty before committing (2026-04-08)

### codi-testing (1 observation)
3. [MEDIUM] outdated-rule — rule says use Jest but project migrated to Vitest (2026-04-09)

---
Run /codi-refine-rules to review these one by one and propose changes.
\`\`\`

If no feedback exists, report: "No observations in \`.codi/feedback/\` yet. The system collects them automatically as you work."

---

## Mode: REFINE (interactive one-at-a-time edits)

Review collected feedback and propose targeted improvements to rules — always with human approval.

**Design principle:** Rules are sacred. Feedback is data. You propose; the human decides.

### Step 1 — Load Feedback

**[CODING AGENT]** Read all JSON files from \`.codi/feedback/rules/\`.

If the directory is empty or doesn't exist, inform the user:
> "No rule feedback collected yet. As you work, the rule-feedback skill automatically observes patterns, corrections, and outdated practices. Run this command again after a few coding sessions."

### Step 2 — Aggregate and Prioritize

**[CODING AGENT]** Group observations by \`ruleName\` and sort by priority:

1. **User corrections** (\`category: user-correction\`) — highest priority, the user explicitly said something
2. **High severity** — important gaps or outdated guidance
3. **Frequency** — rules with multiple observations need attention first
4. **Medium/low severity** — minor improvements

Present a summary table:

| Rule | Observations | Highest Severity | Top Category |
|------|-------------|-----------------|--------------|
| codi-testing | 3 | high | user-correction |
| codi-typescript | 2 | medium | outdated-rule |
| (no rule) | 1 | low | new-pattern |

### Step 3 — Review One at a Time

**[CODING AGENT]** For each rule with feedback (highest priority first):

1. **Show the observation(s):**
   - Quote the observation text
   - List all evidence points
   - Show the suggested change

2. **Read the current rule** from \`.codi/rules/<ruleName>.md\`

3. **Propose the specific change:**
   - Show what section to modify
   - Show the before/after diff
   - Explain the rationale

4. **Wait for user decision:**
   - **Approve** → Edit the rule file, mark feedback as resolved
   - **Reject** → Mark feedback as dismissed, move to next
   - **Skip** → Leave feedback for later review
   - **Edit** → User provides a modified version of the change

5. **For "new-pattern" observations without a ruleName:**
   - Propose creating a new custom rule: \`codi add rule <name>\`
   - Or propose adding the pattern to an existing related rule

### Step 4 — Propagate Changes

**[CODING AGENT]** After all reviews:

\`\`\`bash
codi generate
\`\`\`

This distributes updated rules to all configured agents.

### Step 5 — Cleanup

**[CODING AGENT]** Remove resolved and dismissed feedback:
- Delete JSON files for resolved/dismissed observations
- Keep skipped observations for future review
- Report: "Processed X observations: Y approved, Z rejected, W skipped"

## Handling Edge Cases

### Observation references a rule that doesn't exist
The rule may have been renamed or removed. Search \`.codi/rules/\` for similar names and ask the user which rule to update.

### Multiple conflicting observations for the same rule
Present all observations together so the user can decide on a coherent change rather than applying contradictory updates.

### Observation suggests a change already made
Check the current rule content against the suggestion. If already addressed, mark as resolved automatically.

## Related Skills

- **codi-rule-feedback** — Collects the observations this skill reviews
- **codi-rule-creator** — Create entirely new rules (when observations suggest gaps)
- **codi-skill-creator** — Refine or create new skills
- **codi-dev-operations** — General artifact management

---

## Mode: REPORT-DRIVEN (consume team consolidation report)

**Trigger:** user invokes the skill with a path to a \`[REPORT]_team-consolidation*.md\` file, or the user asks to "apply the approved rules from the team consolidation report" / "process the team consolidation findings".

### REPORT-DRIVEN Steps

1. **Locate the report.** If the user provided a path, use it. Otherwise, list \`docs/*[REPORT]_team-consolidation*.md\` and ask which to process (default: most recent).
2. **Read the report.** Parse free-form markdown using your own intelligence — there is no formal schema. Find sections labeled \`Domain findings\`. For each finding (header \`### D-N\` or similar), look at the \`Consensus:\` section and identify items where \`[x] APPROVED\` is marked.
3. **Filter for refine-rules scope.** Within APPROVED items, look at the \`Target meta-skill:\` line. Only process items whose target is \`refine-rules\` (or unspecified — default to refine-rules for domain rule items).
4. **Build internal feedback structure.** For each filtered item, construct an in-memory feedback shape equivalent to a \`.codi/feedback/*.json\` entry: \`{ artifactName, category, observation, severity, evidence, proposedChange }\`. Use the report's evidence excerpts and proposed action.
5. **Run the existing REFINE pipeline** on the synthesized feedback structure. Use the same one-at-a-time approval flow: present each item, accept/skip/edit, edit \`.codi/rules/<name>.md\`, then move to the next.
6. **Optional clarity check.** If a finding lacks enough context to act on, query the brain DBs at the path in the report header (\`Brains directory:\` field) using \`sqlite3 -readonly\`. The schema reference in \`team-consolidation-workflow/references/schema-reference.md\` documents every table.
7. **After applying.** Run \`codi generate\` to propagate changes to per-agent dirs.

### Output Format

Same as REFINE mode. The report path is logged at the top of each session so the team can trace which report drove which changes.

### Skip When (REPORT-DRIVEN)

- No \`[REPORT]_team-consolidation*.md\` files exist in \`docs/\` and the user did not provide a path → fall back to existing REFINE mode using \`.codi/feedback/\`.
- The report has zero APPROVED items in the \`refine-rules\` scope → tell the user there is nothing to apply, suggest re-reviewing the report for consensus.
- The report itself was never reviewed (no \`[x]\` marks anywhere) → tell the user consensus is the prerequisite; do not apply unilaterally.

