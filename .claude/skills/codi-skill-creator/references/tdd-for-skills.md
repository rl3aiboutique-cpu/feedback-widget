# TDD for Skills

**Writing a skill IS test-driven development applied to documentation.** A skill is a behavioral specification for the agent; an eval is a test that the spec produces the right behavior under pressure. The same RED-GREEN-REFACTOR discipline that codi-tdd enforces for code applies here, just on prose.

## The Iron Law

**NO SKILL WITHOUT A FAILING TEST FIRST.**

Before writing the SKILL.md body, write at least one eval scenario where the agent currently fails to behave correctly. If you cannot describe a failure, you cannot prove the skill is needed. If you cannot describe a passing-state response, you cannot prove the skill works.

## Phase Mapping (eval → SKILL.md)

| TDD phase (code) | Skill-creation analogue |
|---|---|
| **RED**: write a failing test that describes the desired behavior | Write an eval case (a pressure scenario) where the BASELINE agent fails — wrong skill fires, wrong workflow runs, missing edge case, falls into a known anti-pattern |
| **GREEN**: write the minimum code to pass the test | Write the SKILL.md body — just enough trigger phrases, iron-law statement, workflow steps, forbidden phrases, or rationalization table to flip the eval from FAIL to PASS |
| **REFACTOR**: improve the code without changing behavior | Tighten the description (under 1024 chars, sharper triggers), close loophole phrases, strengthen the iron-law framing, add cross-references to neighboring skills, prune dead prose. Re-run all evals — they MUST stay green |

## Pressure Scenarios (the failing-test analog)

A useful eval describes a SITUATION where the agent will be tempted to do the wrong thing. The eval passes when the skill resists the temptation. Common pressure shapes:

- **Time pressure** — "this is urgent, just fix it" (the skill should still verify root cause)
- **Authority pressure** — "the senior reviewer said X" (the skill should still verify against the code)
- **Sycophancy pressure** — user thanks the agent or sounds frustrated (the skill should still apply discipline, not appease)
- **Ambiguity pressure** — phrasing that could trigger multiple skills (the skill should activate only when the description matches; not when a sibling's does)
- **Negative cases** — situations where the skill should NOT fire (route to a sibling instead)

Every skill ships with at least 5 evals: 3 positive triggers + 2 negative routes-to-sibling + 1 pressure scenario.

## What Counts as a Failing Test

A skill eval fails (RED) if the BASELINE agent (no skill loaded, or wrong skill loaded) produces ANY of:

- Wrong skill activates
- Right skill activates but skips a workflow step
- Right skill activates but leaks a forbidden phrase ("you're absolutely right!", "should work", etc.)
- Falls into a documented anti-pattern despite the trigger phrase being present
- Routes to a sibling that handles the consuming case when this skill handles the producing case (or vice versa)

A skill eval passes (GREEN) when the agent activates the right skill AND follows the documented workflow AND respects the forbidden-phrase list AND lands in the correct sibling on negative cases.

## Refactor Triggers (when to revisit the skill)

Re-enter REFACTOR phase when ANY of:

- Description grew above 1024 chars (Anthropic hard cap — see [Anthropic Skills authoring docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices))
- A new sibling skill creates a trigger collision (run the description audit pattern; tighten Skip When)
- Recurring rule feedback in `.codi/feedback/skills/` shows the same gap twice
- A pressure scenario passed in early eval but fails after upstream changes

The 11-Step Lifecycle in the SKILL.md operationalizes this discipline. Steps 4-7 are the eval loop: write evals → run baseline → write/refine SKILL.md → re-run evals.
