# (codi-rule) codi-documentation

# Documentation Standards

## Diataxis Documentation Framework
- Organize documentation into four types: tutorials (learning by doing), how-to guides (solving specific problems), reference (factual descriptions), explanation (understanding concepts)
- Do not mix types in one document — a tutorial should not include exhaustive reference tables; a reference page should not include step-by-step instructions
- Start with reference and how-to guides — these serve the most immediate developer needs

## Code Documentation
- Write self-documenting code first — clear names, small functions
- Add JSDoc/docstrings to all public APIs: purpose, parameters, return value, examples — consumers should not need to read the source
- Document non-obvious behavior with inline comments (WHY, not WHAT)
- Keep documentation close to the code it describes — separate doc files drift out of sync

## Project Documentation
- Keep README up to date with every significant change
- Include: what the project does, how to install, how to use, how to contribute
- Document environment setup and prerequisites — new contributors should be productive in under 30 minutes
- Provide working examples that can be copy-pasted

BAD: Abstract descriptions without runnable examples
GOOD: Copy-pasteable code snippets that work immediately

## Docs-as-Code Workflow
- Store documentation in the same repository as code — changes to code and docs ship together in the same PR
- Use CI to validate documentation: check broken links, lint markdown, test code examples
- Auto-generate API reference from OpenAPI specs or code annotations — hand-written API docs drift from reality

## Architecture Documentation
- Document high-level architecture decisions and their rationale — future developers need to understand WHY, not just WHAT
- Use Architecture Decision Records (ADRs) for significant choices
- Include diagrams for complex system interactions
- Keep architecture docs updated when the system evolves

## API Documentation
- Document all endpoints: method, path, parameters, request/response bodies
- Include example requests and responses — examples are the most-read part of any API doc
- Document error responses and status codes
- Version the documentation alongside the API

## Operational Documentation
- Write runbooks for every production service: how to deploy, how to rollback, how to investigate common alerts
- Include decision trees for incident response — reduce mean time to recovery by eliminating guesswork
- Review and test runbooks quarterly — untested runbooks fail when needed most

## File Naming Convention

All agent-generated documentation MUST follow this naming format:

\`YYYYMMDD_HHMM_[CATEGORY]_filename.md\`

Example: \`20260325_1430_AUDIT_security-review.md\`

### Categories (10)

| Code | Category | Use For |
|------|----------|---------|
| ARCH | Architecture | System design, component diagrams |
| AUDIT | Audit | Security audits, code audits, compliance |
| GUIDE | Guide | How-to guides, tutorials, onboarding |
| REPORT | Report | Analysis, performance, status updates |
| SPEC | Specification | Feature specs, API specs, protocols |
| RUNBOOK | Runbook | Operations, incident response, deploys |
| ADR | Decision Record | Architecture decisions with rationale |
| RESEARCH | Research | Tech evaluations, PoC findings, benchmarks |
| CHANGELOG | Changelog | Release notes, version history |
| REVIEW | Review | Code review summaries, retrospectives |

### Placement Rules
- Agent-generated docs go in \`docs/\` root — NEVER create subdirectories
- Only users create subdirectories for manual organization
- No adjectives in filenames — use descriptive nouns and verbs only

### Document Header

Every generated document must start with:
\`\`\`markdown
# Document Title
- **Date**: YYYY-MM-DD HH:MM
- **Document**: filename.md
- **Category**: CATEGORY
\`\`\`

## Document Types & Required Sections

| Type | Required Sections |
|------|-------------------|
| Audit | Executive Summary, Findings, Recommendations, Risk Matrix |
| Architecture | Overview Diagram, Components, Data Flow, Decisions |
| Report | Summary, Analysis, Conclusions, Next Steps |
| README | Overview, Quick Start, Usage, Configuration |
| CHANGELOG | Version headers, categorized changes (Added/Changed/Fixed) |

## Diagrams — Mermaid Only
- All diagrams must use Mermaid syntax embedded in Markdown — no ASCII art
- Choose the right diagram type: flowchart, sequenceDiagram, erDiagram, classDiagram, stateDiagram, gantt, pie, mindmap
- Keep diagrams minimalist: no custom colors, no \`fill:\`, \`style\`, or \`classDef\` directives — default theme only
- Never use \`\\n\` (literal backslash-n) in node labels — use a new node or a subgraph for multi-line concepts

BAD: \`A["Line1\\nLine2"]\` or \`style A fill:#f00\`
GOOD: \`A["Concise label"]\` with no color overrides

## Maintenance
- Remove outdated documentation — wrong docs are worse than no docs
- Review documentation during code review — docs should be part of the definition of done
- Write documentation as part of the feature, not after

<!-- Generated by Codi | Do not edit — run: codi generate -->
