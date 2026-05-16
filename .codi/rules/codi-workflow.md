---
name: codi-workflow
description: Human-in-the-loop workflow — baby steps, self-evaluation, MCP-first exploration, no unsolicited commits
priority: high
alwaysApply: true
managed_by: codi
version: 3
---

# Workflow

## Human-in-the-Loop Execution
1. **Understand > Search > Propose > Execute**: Understand the user's intent, search the codebase, propose a solution, and execute ONLY after user confirmation
2. **Baby Steps**: Break down all tasks into atomic steps. Propose ONE step at a time and wait for feedback before continuing
3. **Never Assume**: Ask clarifying questions if anything is ambiguous
4. **Pause Before Executing**: Always pause for human feedback before executing any significant action
5. **No Commits Without Approval**: Never commit or deploy code without human approval and all errors fixed

## Manifest Discipline (Q7)

Every code edit must run under a workflow — full or quick. Ad-hoc edits without a manifest row are prohibited.

| Edit type | Command |
|-----------|---------|
| New feature | \`codi workflow run feature "<task>"\` |
| Bug fix | \`codi workflow run bug-fix "<task>"\` |
| Refactor | \`codi workflow run refactor "<task>"\` |
| Schema/data migration | \`codi workflow run migration "<task>"\` |
| Project bootstrap | \`codi workflow run project "<task>"\` |
| Trivial edit | \`codi workflow quick "<task>" --category <cat>\` (or top-level \`codi quick\`) |

Quick categories (closed list — anything else needs a full workflow): \`typo\`, \`comment\`, \`dep-bump\`, \`format\`, \`doc-tweak\`.

If you catch yourself editing a file without an active workflow, STOP. Run the appropriate command first. The audit trail is mandatory, not optional.

## Session Start

Query the active workflow once at session start:

\`\`\`bash
codi workflow status --json --slim
\`\`\`

If \`active: true\`, read \`references/phase-<current_phase>.md\` from the active workflow's skill directory before any edit. If \`active: false\`, decide whether the requested edit is full-workflow scope or quick-mode scope, and start the corresponding command.

## No AI Signatures
- Never sign commits with AI attribution
- Do NOT add Co-Authored-By lines or generated-by footers to commit messages

## Self-Evaluation Before Action
Before proceeding with any solution, self-evaluate for:
- **Security**: Does this introduce vulnerabilities?
- **Performance**: Will this cause bottlenecks or latency issues?
- **Scalability**: Will this work at 10x, 100x scale?
- **Cost**: Does this optimize for resource efficiency?

Only continue with solutions that do NOT compromise any of these factors.

## Accuracy Guardrails
- Never invent file paths, function names, API endpoints, or field names — verify they exist before referencing them
- When information is unavailable or uncertain, say so explicitly — never fabricate data, statistics, or citations
- Distinguish between what the code or data shows and what is inferred — label inferences explicitly
- If a claim cannot be grounded in provided context or code, do not make it
- Prefer "I don't know" or "I need to check" over a confident wrong answer

BAD: "The function \`processPayment()\` in \`src/billing/handler.ts\` handles this" (never verified)
GOOD: "Let me check where payment processing is handled" (then reads the code)

## MCP Usage Strategy
When MCP servers are available, use them PROACTIVELY before making decisions.

### Mandatory Ordering
1. **Code Graph FIRST**: Before using ANY other exploration tool (Glob, Grep, Read, Bash), query the code graph to understand structure, callers, and dependencies
2. **Search Documentation**: Search indexed docs for best practices, known issues, and API patterns
3. **Sequential Thinking**: Use structured step-by-step reasoning for complex problems, debugging, and architectural decisions
4. **Memory**: Store important findings for persistence across sessions
5. **Other MCPs**: Use specialized tools as needed

### When to Query Code Graph
- To understand how functions/classes relate to each other
- To find all callers of a function before modifying it
- To trace dependencies and imports
- To understand impact before refactoring

### When to Search Documentation
- Before implementing any feature
- When encountering errors
- When unsure about API usage, patterns, or conventions
- Before proposing architectural decisions

## Decision-Making Checklist
Before any change, verify:
- Queried code graph? (if available)
- Searched documentation? (if available)
- Security reviewed?
- Performance checked?
- Scalability assessed?
- Cost evaluated?
- User approved?
