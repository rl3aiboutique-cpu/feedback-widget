---
name: codi-dev-docs-manager
description: |
  Codi self-documentation skill (for Codi
  contributors only). Use when building, updating, regenerating, or checking
  Codi's own docs site. Also activate for phrases like
  "regenerate docs", "are the docs stale", "update the docs", "rebuild docs
  site", "validate docs freshness", "skill catalog", "pre-release doc sweep",
  or when the user runs \`codi docs --generate\` / \`--validate\`.
  Maintains 20 auto-generated sections across artifacts.md, configuration.md,
  architecture.md, presets.md, and README.md. Do NOT activate for consumer
  project documentation (use codi-project-documentation), branded
  reports or proposals (use codi-content-factory), or user-facing
  tutorials.
category: Codi Platform
compatibility: [claude-code, cursor, codex, windsurf, cline, copilot]
managed_by: codi
user-invocable: true
disable-model-invocation: false
version: 9
---

# codi-dev-docs-manager — Documentation Manager

Maintains Codi's own documentation using a **marker-based code-driven generator**.
Data tables (flag lists, schema fields, template catalogs, preset comparisons) are
auto-generated from code. Prose (explanations, examples, directory structures) is
human-authored and preserved between markers.

## How the Generator Works

Doc files contain marker pairs:

\`\`\`markdown
<!-- GENERATED:START:flags_table -->
| Flag | Type | Default | ... |    <-- auto-generated from FLAG_CATALOG
<!-- GENERATED:END:flags_table -->
\`\`\`

The generator reads source-of-truth code structures (Zod schemas, template registries,
flag catalogs, adapter definitions) and injects rendered Markdown tables between markers.
Everything outside markers is preserved exactly as written.

**20 generated sections** across 4 doc files:
- **artifacts.md** (6): rule_fields, skill_fields, agent_fields, rule_templates, skill_templates, agent_templates
- **configuration.md** (4): flags_table, flag_modes, manifest_fields, flag_instructions
- **architecture.md** (3): adapter_table, layer_order, flag_hooks
- **presets.md** (2): preset_table, preset_flag_comparison
- **README.md** (3): template_counts_compact, preset_table, supported_agents

## When to Activate

- User asks to build or regenerate the documentation site
- User asks if documentation is up to date or stale
- User wants to see all available skills in a browsable format
- User asks to update docs after code changes
- User mentions pre-release documentation sweep
- User asks to validate documentation freshness

## Step 1: Validate Generated Sections

**[CODING AGENT]** Run validation to check if any generated sections are stale:

\`\`\`bash
npx codi docs --validate
\`\`\`

If stale sections are detected, regenerate them:

\`\`\`bash
npx codi docs --generate
\`\`\`

This automatically updates all 20 data tables from their source-of-truth code structures.
No manual editing is needed for generated sections.

Present the results to the user: which files were updated and which sections changed.

## Step 2: Review Prose Freshness

The generator handles data tables, but **prose around the tables** (explanations, examples,
YAML snippets, directory structures) must be reviewed manually when code changes affect them.

**[CODING AGENT]** Check recent code changes that might affect documentation:

\`\`\`bash
git log --since="2 weeks ago" --oneline -- src/schemas/ src/core/flags/ src/adapters/ src/templates/ src/core/scaffolder/
\`\`\`

For each significant change (new artifact type, renamed field, new adapter, removed feature):
1. Read the affected doc file(s)
2. Check if the prose still accurately describes the code
3. Propose specific edits — do NOT rewrite entire documents
4. Wait for user approval before applying changes

**What might need prose updates:**
- New artifact types → add a new section in artifacts.md with frontmatter example
- New flags → add explanation in configuration.md
- New adapters → add description in architecture.md
- Changed directory structure → update directory trees in relevant docs

## Step 3: Export Skill Catalog (optional)

**[CODING AGENT]** Export the skill catalog as JSON for machine consumption:

\`\`\`bash
npx codi docs --json
\`\`\`

## Step 4: Final Validation

**[CODING AGENT]** Confirm everything is in sync:

\`\`\`bash
npx codi docs --validate
\`\`\`

Also check for broken relative links:

\`\`\`bash
# Scan all doc files for broken relative links
for f in docs/*.md README.md; do
  grep -oP '\[.*?\]\((?!http)(.*?)\)' "$f" | while read -r link; do
    target=$(echo "$link" | grep -oP '\((.*)\)' | tr -d '()')
    dir=$(dirname "$f")
    if [ ! -e "$dir/$target" ]; then
      echo "BROKEN: $f -> $target"
    fi
  done
done
\`\`\`

## Documentation Structure

\`\`\`
docs/
  README.md              # Index linking to all docs
  architecture.md        # Config resolution, adapters, hooks, flags (3 generated sections)
  artifacts.md           # Rules, skills, agents, commands, brands (9 generated sections)
  configuration.md       # Manifest, flags, modes, layers, MCP (4 generated sections)
  presets.md             # Built-in presets, create/install/export (2 generated sections)
  workflows.md           # Daily usage, CI/CD (manual)
  migration.md           # Adopting Codi in existing projects (manual)
  troubleshooting.md     # Common issues and fixes (manual)
  deprecated/            # Archive of old docs (spec, QA, roadmaps, research)
\`\`\`

## Skip When

- User wants consumer-project docs, READMEs, or ADRs — use codi-project-documentation
- User wants branded reports or proposals — use codi-content-factory
- User asks to modify source code — this skill only reads code to check doc freshness
- User asks for an auto-commit — all edits require explicit user approval first
- User is not working on the Codi source repo — this skill is contributor-only

## Related Skills

- **codi-documentation** — Document user project code, READMEs, and ADRs
- **codi-content-factory** — Generate branded reports and proposals

