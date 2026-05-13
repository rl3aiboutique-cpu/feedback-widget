---
name: output-tone-policy
description: Project tone is caveman by default. Documents the single-turn and permanent escape mechanisms so the agent honours user intent to switch to normal mode without each skill having to repeat the recommendation.
priority: medium
alwaysApply: true
managed_by: user
---

# Output Tone Policy

## Default

Caveman mode (Iron Law 8). The codi UserPromptSubmit hook injects `<output-mode>caveman</output-mode>` on every turn. Responses use bullets, ≤3-column tables, one summary line per phase, and drop filler, articles, pleasantries, and hedging.

This default applies to every skill in this project. Skill authors MUST NOT duplicate the caveman recommendation in individual SKILL.md bodies — Iron Law 8 + the hook already enforce it project-wide. Repeating it inflates skill descriptions against the `codi-contribution-discipline` ≤1500 char budget.

## Single-turn escape — `?`

When the user types `?` as the entire prompt or prepends it to a request, respond in normal prose for THAT TURN ONLY. Revert to caveman the next turn without being asked.

## Natural-language escape — 1 turn

The agent must recognise and honour these phrases as equivalent to `?`, for the current turn only:

- `modo normal` · `modo normal por favor` · `normal mode` · `normal mode please`
- `no caveman` · `sin caveman` · `without caveman`
- `disable caveman` · `switch to normal` · `use normal mode` · `responde en modo normal`
- `be verbose` · `give me the full answer` · `explain in detail` — when caveman-ness is the issue

Acknowledge the switch with ONE short line at the start of the response (`Modo normal para este turno.`) and then continue in normal prose. Revert to caveman next turn.

## Permanent override — `.claude/output-mode.local`

For a project checkout where the user wants normal mode by default (screen-share with a stakeholder, demo recording, onboarding a new developer, accessibility need):

```bash
echo "normal" > .claude/output-mode.local
```

The `.claude/hooks/inject-capability-prompt.sh` hook reads this file on every UserPromptSubmit and emits `<output-mode-override>normal</output-mode-override>` plus a directive cancelling the codi caveman default. The override persists until the file is removed:

```bash
rm .claude/output-mode.local
```

The file is gitignored (per-machine, never committed) — every developer chooses their own default.

## Precedence (highest first)

1. `?` or natural-language escape — affects only the current turn
2. `.claude/output-mode.local` content (`normal`) — affects the entire session/checkout
3. Iron Law 8 caveman default — everything else

## Why this rule exists

Caveman saves roughly 75% of tokens but reduces readability for users not used to compressed output. The default-on plus multiple-escape design lets the project optimise for cost without locking users into a tone that does not fit every moment.

`managed_by: user` ensures `codi generate` never overwrites this rule. It is the cross-cutting policy that lets skill authors stay silent on tone — they can trust the hook and this rule.

## See also

- `codi-output-discipline.md` — formatting rules (no em-dashes, plain quotes, etc.) — apply in BOTH caveman and normal mode
- `codi-capture-everything.md` — Iron Law 8 + Iron Law 9 baseline
- `.claude/hooks/inject-capability-prompt.sh` — reads `.claude/output-mode.local` and injects the override
- `.claude/skills/caveman/SKILL.md` — the skill that formally re-enables caveman if the user disabled it for the session, or activates it in projects where it is NOT the default
