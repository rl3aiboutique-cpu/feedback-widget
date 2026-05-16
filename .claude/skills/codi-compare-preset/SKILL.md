---
name: codi-compare-preset
description: 'Compare local Codi artifacts against upstream templates. Use when the user wants to check customizations, review pending upstream updates, or prepare to contribute improvements. Also activate for phrases like "what have I customized", "diff against upstream", "see my changes vs Codi", "pending upstream updates", "show differences", "review my local config", "upgrade Codi artifacts", or on /codi-compare-preset. Produces a report of local improvements (contribution candidates), upstream updates available, and conflicts. Do NOT activate for installing a preset (use \`codi preset install\`), creating a new preset (use codi-preset-creator), or opening the PR itself (use codi-artifact-contributor).'
user-invocable: true
---

# codi-compare-preset — Compare Preset

## When to Activate

- User asks to compare their local Codi setup against the latest version
- User wants to see what they have customized vs what is upstream
- User is preparing to contribute improvements back to Codi
- User asks about upgrading or updating Codi artifacts
- User runs `/codi-compare-preset`

## Skip When

- User wants to install a preset from a ZIP — use \`codi preset install <path>\`
- User wants to create or package a new preset — use codi-preset-creator
- User wants to open a PR with their improvements — use codi-artifact-contributor (this skill only identifies candidates)
- User wants to pull upstream updates — run \`codi update\` directly

## Step 1: Identify Local State

**[CODING AGENT]** Read the local configuration:

\`\`\`bash
# Read manifest to get preset name and artifact lists
cat .codi/codi.yaml
\`\`\`

Then inventory local customizations:

\`\`\`bash
# List custom rules (user-created or improved)
ls .codi/rules/ 2>/dev/null

# List skills (check for managed_by: user in frontmatter)
grep -rl "managed_by: user" .codi/skills/ 2>/dev/null

# List agents
ls .codi/agents/ 2>/dev/null
\`\`\`

Record:
- The installed preset name
- All custom rules in `.codi/rules/`
- Any skills or agents with `managed_by: user` (project-specific versions)
- The Codi version from `codi.yaml`

## Step 2: Fetch Upstream State

**[CODING AGENT]** Get the latest Codi templates:

\`\`\`bash
TEMP_DIR=$(mktemp -d)
git clone --depth 1 https://github.com/lehidalgo/codi.git "$TEMP_DIR/codi-upstream" 2>/dev/null
\`\`\`

If the clone fails (offline, network error), skip upstream comparison and show only the local customization report.

Read the corresponding preset definition:

\`\`\`bash
# Find the preset file (preset name from Step 1)
ls "$TEMP_DIR/codi-upstream/src/templates/presets/"
\`\`\`

## Step 3: Compare Artifacts

**[CODING AGENT]** For each artifact type, compare local vs upstream:

### Rules Comparison
For each rule in the installed preset:
1. Read local version from `.codi/rules/<name>.md` (if customized) or the generated output
2. Read upstream version from `$TEMP_DIR/codi-upstream/src/templates/rules/<name>.ts`
3. Extract the template string content from the TypeScript file
4. Identify: added sections, removed sections, modified guidance

### Custom Rules (local-only)
List rules in `.codi/rules/` that have no upstream equivalent — these are **contribution candidates**.

### Skills Comparison
For skills with `managed_by: user`:
1. Read local `.codi/skills/<name>/SKILL.md`
2. Read upstream `$TEMP_DIR/codi-upstream/src/templates/skills/<name>.ts`
3. Identify added steps, modified workflows, expanded scope

### Agents Comparison
Same approach: diff local agent files against upstream template strings.

## Step 4: Present Report

**[CODING AGENT]** Format the comparison as:

\`\`\`markdown
## Preset Comparison: [preset-name]

### Your Improvements (contribution candidates)
- **[artifact-name]** ([type]): [what was added/changed] — [why it is better]

### Upstream Updates Available
- **[artifact-name]**: upstream added [new section] — [should we pull it in?]

### Conflicts
- **[artifact-name]**: local and upstream both changed [section] — needs manual resolution

### Summary
- X local improvements ready to contribute
- Y upstream updates available to pull
- Recommendation: [contribute first / pull first / both / nothing needed]
\`\`\`

## Step 5: Action

**[CODING AGENT]** Based on the user's choice:

### Contribute Local Improvements
Guide the user through the `codi contribute` workflow:
\`\`\`bash
codi contribute
\`\`\`
Or use the contribute skill for the full workflow (fork, branch, PR).

### Pull Upstream Updates
\`\`\`bash
codi update
\`\`\`
This only updates `managed_by: codi` artifacts — user customizations are preserved.

### Both
Contribute first (so improvements are not overwritten), then pull updates.

## Step 6: Cleanup

\`\`\`bash
rm -rf "$TEMP_DIR"
\`\`\`

## Offline Mode

If upstream clone fails, present a local-only report:
- List all custom rules with their descriptions
- List all `managed_by: user` skills and agents
- Note that upstream comparison is unavailable
- Suggest retrying when network is available

## Related Skills

- **codi-preset-creator** — Create or package a preset before comparing it
- **codi-artifact-contributor** — Contribute local improvements found during comparison back upstream

<!-- Generated by Codi | Do not edit — run: codi generate -->
