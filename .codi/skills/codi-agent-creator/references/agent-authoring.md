# Agent Authoring Reference

Detailed reference for creating subagent definitions. Read this when the main
SKILL.md flow reaches a step that links here.

## Description Writing Rules

The description determines when the agent triggers. Follow strictly:

**Rule 1 — Be pushy.** Actively claim territory with "Use when", "Also activate when", "Handles all cases of".

**Rule 2 — Include trigger keywords.** Think about what the user will type and include those words verbatim.

**Rule 3 — Third person.** Describe what the agent does, not what "you" do.

**Rule 4 — Stay under 1024 characters.** Longer descriptions get truncated.

### BAD descriptions

- "An agent for security" — too vague, no trigger keywords
- "This helps review code" — no specific scenarios, not pushy
- "Security checker" — no verbs, no context

### GOOD descriptions

- "Analyzes code for security vulnerabilities including injection, auth bypass, and data exposure. Use when reviewing PRs, auditing sensitive code, or checking compliance. Also activate for threat modeling and security architecture review."
- "Generates comprehensive test suites for any codebase. Use when adding test coverage, writing regression tests, or implementing TDD workflows. Handles unit, integration, and e2e test creation."

## Confidence Filtering Template

For each finding, assign a confidence level:

- **HIGH** — Definite issue with clear evidence (code reference, failing test)
- **MEDIUM** — Likely issue but needs human verification
- **LOW** — Possible concern, may be intentional

Only report HIGH and MEDIUM findings by default. Include LOW findings only if
the user requests verbose output.

## Severity Matrix Template

| Severity | Criteria | Action |
|----------|----------|--------|
| CRITICAL | Security vulnerability, data loss risk | Block — must fix before merge |
| HIGH | Bug, logic error, missing validation | Fix recommended before merge |
| MEDIUM | Code smell, maintainability concern | Fix in follow-up PR |
| LOW | Style preference, minor optimization | Optional improvement |

Adapt the levels and criteria to the agent's domain.

## Output Format Template

```markdown
### Summary
- Total findings: <count>
- By severity: CRITICAL: <n>, HIGH: <n>, MEDIUM: <n>, LOW: <n>

### Findings

#### [SEVERITY] Finding Title
- **File**: `path/to/file.ts:42`
- **Issue**: Description of the problem
- **Evidence**: Code snippet or reference
- **Fix**: Suggested remediation
```

## Approval Criteria Template

- **PASS** — No CRITICAL or HIGH findings
- **PASS WITH WARNINGS** — No CRITICAL findings, 1-3 HIGH findings
- **FAIL** — Any CRITICAL finding, or more than 3 HIGH findings

## Process Shape

Each step must:

- Start with `**[CODING AGENT]**` prefix
- Be self-contained and actionable
- Have a clear completion condition

Keep to 5-8 steps. If more are needed, the scope is too broad — split into
multiple agents.

## Frontmatter Example

```yaml
---
name: <kebab-case, max 64 chars>
description: <max 1024 chars — see rules above>
version: 1
tools: [Read, Grep, Glob, Bash]
model: inherit
managed_by: user
user-invocable: true
---
```
