#!/bin/sh
# .claude/hooks/inject-capability-prompt.sh
#
# Injected on every UserPromptSubmit AFTER the codi capture-protocol hook.
# Re-emphasises the capability-discovery rule so the agent surfaces relevant
# skills proactively instead of waiting for the user to know what to ask.
#
# POSIX sh — invoked via /bin/sh from .claude/settings.json. No bashisms.
# Script writes ONLY to stdout; output is injected into the agent's next turn.

set -eu

# Per-machine permanent override: if .claude/output-mode.local contains "normal",
# emit an override tag that cancels the codi caveman default for this session.
# See .claude/rules/output-tone-policy.md for the full mechanism.
OVERRIDE_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/output-mode.local"
if [ -f "$OVERRIDE_FILE" ]; then
  MODE=$(tr -d '[:space:]' < "$OVERRIDE_FILE" 2>/dev/null || true)
  if [ "$MODE" = "normal" ]; then
    cat <<'OVERRIDE'
<output-mode-override>normal</output-mode-override>
<output-mode-override-note>
The project caveman default is OVERRIDDEN for this checkout via
.claude/output-mode.local. Respond in normal prose with full articles
and natural phrasing. Remove .claude/output-mode.local to revert.
</output-mode-override-note>
OVERRIDE
  fi
fi

cat <<'PROMPT'
<capability-discovery>
Your installed skills, agents, and slash commands are listed in the
available-skills section of the system reminder — that block IS your
capability catalog. The human-readable map is .claude/skills/_index.md.

Before responding to a substantive request (anything asking for action,
analysis, planning, audit, research, design, or code change):

  1. Restate the user's intent in ONE phrase.
  2. Skim available-skills. Identify any whose description matches the intent.
  3. If 1+ skills apply, NAME THEM in your response and propose how to use
     them. Combine into a numbered route if 2+ apply.
  4. State which files/dirs you would touch before any non-trivial write.
  5. Confirm only when scope >3 files, destructive, or ambiguous.

DO NOT:
  - reply "I can help" without naming applicable skills
  - start executing when 2+ skills could apply and the user has not chosen
  - ask the user which skill to use (you decide, they confirm)
  - skip a skill because "I know the pattern" — skills add hooks, captures,
    vault writes, or guardrails you would not reproduce manually

SKIP discovery for: greetings, yes/no confirmations, pure conceptual questions
without action, mid-plan execution of already-approved steps, P0 incidents.

Rule: .claude/rules/agent-capability-discovery.md
Human index: .claude/skills/_index.md
</capability-discovery>
PROMPT
