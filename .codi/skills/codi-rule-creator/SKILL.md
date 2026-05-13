---
name: codi-rule-creator
description: |
  Rule creation workflow. Use when the user asks to create, write, or define
  a coding rule, standard, or convention. Also activate when the user wants
  to enforce behavior, set constraints, or establish coding standards. After
  creation, use codi-artifact-contributor to share, package as
  ZIP, or open a PR with the new rule. Do NOT activate for creating a skill
  (use codi-skill-creator), creating an agent (use
  codi-agent-creator), or refining an existing rule from
  collected feedback (use codi-refine-rules).
category: Codi Platform
compatibility: [claude-code, cursor, codex, windsurf, cline, copilot]
managed_by: codi
user-invocable: true
disable-model-invocation: false
version: 11
---

# Rule Creator

## When to Activate

- User asks to create a new rule or coding standard
- User wants to enforce a specific behavior or convention
- User needs to define constraints for a language or framework
- User asks about rule frontmatter or rule structure
- User wants to add a project-specific coding guideline

## Step 1 — Capture Intent

**[CODING AGENT]** Before writing anything, interview the user:

1. **What behavior to enforce?** — Get a specific, actionable constraint. Example: "All API endpoints must validate request bodies with Zod schemas."
2. **For what language/framework?** — Is this universal or scoped to TypeScript, Python, React, etc.?
3. **Universal or scoped?** — Should it apply everywhere or only to specific directories/file patterns?
4. **Why this rule?** — What problem does it prevent? (This becomes the rationale.)

Do NOT proceed until you have clear answers for at least questions 1 and 2.

## Step 2 — Choose Scope

**[CODING AGENT]** Determine the rule's reach:

- **Universal** — Applies to all files: set \`alwaysApply: true\` in frontmatter.
- **Language-specific** — Only for one language: set \`language: typescript\` (or python, go, etc.).
- **File-scoped** — Only for certain paths: set \`scope: [src/api/**, src/routes/**]\`.

If unsure, start with a narrow scope. It is easier to widen later than to narrow.

## Step 3 — Select Template or Start Blank

**[CODING AGENT]** Check available templates:

\`\`\`bash
codi add rule --all
\`\`\`

This lists all built-in rule templates. To use one as a starting point:

\`\`\`bash
codi add rule <template-name>
\`\`\`

To start blank:

\`\`\`bash
codi add rule <name>
\`\`\`

This creates \`.codi/rules/<name>.md\` with a blank skeleton.

## Step 4 — Write Frontmatter

**[CODING AGENT]** Fill in the YAML frontmatter:

\`\`\`yaml
---
name: <kebab-case, max 64 chars>
description: <max 512 chars, specific about when the rule applies>
version: 1
priority: high | medium | low
alwaysApply: true | false
managed_by: user
user-invocable: truelanguage: typescript        # optional — omit for universal rules
scope: [src/api/**]         # optional — omit for universal rules
---
\`\`\`

**Priority guide:**
- **high** — Security, data integrity, production safety rules
- **medium** — Code style, architecture patterns, testing standards
- **low** — Preferences, naming conventions, optional best practices

## Step 5 — Write Content

**[CODING AGENT]** Write the rule body following these strict guidelines:

### Style
- Use **imperative mood**: "Validate input" not "Input should be validated"
- Add **rationale** after each rule: "— prevents injection attacks"
- Keep language direct and unambiguous

### Structure
- Group related rules under **h2 section headings**
- Use bullet points for individual rules
- Include **BAD/GOOD code examples** for the 2-3 most important rules:

\`\`\`markdown
## Input Validation

- Validate all request bodies at the controller level — prevents malformed data from reaching services

**BAD:**
\\\`\\\`\\\`typescript
app.post('/users', (req, res) => {
  db.insert(req.body); // No validation
});
\\\`\\\`\\\`

**GOOD:**
\\\`\\\`\\\`typescript
app.post('/users', (req, res) => {
  const parsed = UserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  db.insert(parsed.data);
});
\\\`\\\`\\\`
\`\`\`

### Measurable criteria
- Include thresholds where possible: "Max 30 lines per function", "Max 3 parameters"
- Include counts: "At least 2 test cases per public method"
- Include patterns: "All environment variables must use the \`CONFIG.\` prefix"

## Step 6 — Validate

**[CODING AGENT]** Before registering, verify ALL of the following:

- [ ] Content is under 6,000 characters (MAX_ARTIFACT_CHARS)
- [ ] No vague adjectives ("appropriate", "proper", "good", "clean", "nice")
- [ ] Every rule has a rationale annotation (text after " — ")
- [ ] At least one BAD/GOOD code example pair
- [ ] Description is specific about when the rule applies (not generic)
- [ ] \`name\` in frontmatter matches the filename
- [ ] Uses imperative mood throughout
- [ ] Does NOT duplicate linter/formatter rules (ESLint, Prettier, etc.)
- [ ] Rules are grouped under clear h2 headings
- [ ] File stays under 50 lines of body content (excluding frontmatter)

Run \`codi validate\` to check Zod schema compliance (name pattern, description length, version, managed_by). Fix any errors before registering.

## Step 7 — Register

**[CODING AGENT]** After validation passes:

\`\`\`bash
codi validate
codi generate
codi doctor
\`\`\`

1. \`codi generate\` distributes the rule to all configured agents
2. \`codi doctor\` checks for remaining issues (size warnings, missing docs)

If doctor reports warnings, address them before finishing.

## Quality Checklist

- [ ] Rule prevents a real, specific problem (not theoretical)
- [ ] Rationale explains the "why" for every constraint
- [ ] BAD/GOOD examples are realistic, not contrived
- [ ] No overlap with existing rules in \`.codi/rules/\`
- [ ] Measurable criteria where applicable (numbers, thresholds, patterns)
- [ ] Scope is as narrow as possible while covering the intent

## Available Rule Templates

Run \`codi add rule --all\` to list all templates. Major categories include:

| Category | Templates |
|----------|-----------|
| Practice | security, code-style, testing, architecture, error-handling, api-design, performance, documentation, git-workflow, production-mindset, simplicity-first |
| Language | typescript, python, golang, java, kotlin, rust, swift, csharp |
| Framework | react, nextjs, django, spring-boot |
| Meta | workflow, agent-usage, codi-improvement-dev |

## Constraints

- Do NOT create rules that duplicate linter/formatter configuration
- Do NOT use vague language — every word must be actionable
- Do NOT exceed the 6,000 char limit — split into multiple rules if needed
- Do NOT skip rationale annotations — rules without reasons get ignored
- Do NOT create overly broad rules — narrow scope is better than wide scope

## Related Skills

- **codi-rule-feedback** — Get feedback on an existing rule's quality and trigger precision
- **codi-refine-rules** — Batch-refine multiple rules for consistency and clarity

