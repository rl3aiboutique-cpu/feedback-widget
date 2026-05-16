---
name: codi-dev-operations
description: |
  Unified Codi operations skill. Use when the user wants to
  add, update, or remove rules, skills, or agents; configure flags, presets,
  or MCP servers; run \`codi generate\`, \`add\`, \`update\`,
  \`verify\`, \`doctor\`, \`validate\`, or \`preset\` commands;
  resolve \`generate\` exit-2 conflicts; check drift; clean or revert
  backups; or follow the self-dev clean + reinstall flow for source-layer
  edits. Also activate for phrases like "codi generate didn't propagate",
  "my source edit isn't showing up", "three-layer pipeline", "conflict
  resolution". Do NOT activate for writing a new skill from scratch (use
  codi-skill-creator), creating a new rule (use
  codi-rule-creator), or scaffolding a new agent (use
  codi-agent-creator) — those have their own lifecycle workflows.
category: Codi Platform
compatibility: [claude-code, cursor, codex, windsurf, cline, copilot]
managed_by: codi
user-invocable: true
disable-model-invocation: false
version: 19
---

# codi-dev-operations — Operations

## When to Activate

- User wants to add, update, or remove rules, skills, or agents
- User needs to configure flags, presets, or MCP servers
- User asks to verify, diagnose, or troubleshoot the Codi installation
- User asks about drift, backups, or regenerating agent config files
- \`codi generate\` exited with code 2 and a conflicts payload
- User edited \`src/templates/\` and is not seeing changes take effect

## Skip When

- User wants to **create** a new skill from scratch — use codi-skill-creator
- User wants to **create** a new rule from scratch — use codi-rule-creator
- User wants to **create** a new agent from scratch — use codi-agent-creator
- User wants to package and contribute artifacts to a repo — use codi-artifact-contributor
- User wants to diff local vs upstream — use codi-compare-preset

## Artifact Lifecycle

Codi manages 3 artifact types with identical lifecycle:

| Type | Location | Create | Templates |
|------|----------|--------|-----------|
| Rules | .codi/rules/ | codi add rule | 30 templates |
| Skills | .codi/skills/ | codi add skill | 70 templates |
| Agents | .codi/agents/ | codi add agent | 21 templates |

### Creating Artifacts

```bash
codi add rule <name> --template <template>    # From template (managed_by: codi)
codi add rule <name>                          # Blank skeleton (managed_by: user)
codi add rule --all                           # All templates at once
```

Same pattern for skill, agent.

### Ownership (managed_by)

- `managed_by: codi` — template-managed, updated by `codi update`
- `managed_by: user` — custom, never overwritten by codi

### Frontmatter Format

Rules:
```yaml
name: rule-name
description: What this rule does
priority: high | medium | low
alwaysApply: true
managed_by: codi | user
```

Skills:
```yaml
name: skill-name
description: What this skill does
compatibility: [claude-code, cursor, codex, windsurf, cline, copilot]
managed_by: codi | user
```

Agents:
```yaml
name: agent-name
description: When to use this agent
tools: [Read, Grep, Glob, Bash]
model: inherit
managed_by: codi | user
```

## Configuration

### Flag Presets
```bash
codi update --preset minimal     # Permissive
codi update --preset balanced    # Recommended (default)
codi update --preset strict      # Enforced + locked
```

### Preset Management
```bash
codi preset create <name>              # Scaffold a new preset directory
codi preset create --interactive       # Interactive preset creation wizard
codi preset list                       # List installed presets
codi preset list --builtin             # Include built-in presets (minimal, balanced, strict, fullstack, power-user)
codi preset validate <name>            # Validate preset structure and schema
codi preset export <name> --format zip # Export as ZIP for private distribution
codi preset install ./preset.zip       # Install from local ZIP file
codi preset install github:org/repo    # Install from GitHub repository
codi preset remove <name>             # Remove an installed preset
codi preset search <query>            # Search preset registry
codi preset update                    # Update GitHub-sourced presets
```

### Update Artifacts
```bash
codi update --rules --skills --agents    # Refresh managed_by: codi artifacts (auto-generates)
codi update --from org/team-repo         # Pull from central repo (read-only)
codi update --dry-run                    # Preview changes without writing
```

### MCP Configuration
Place MCP servers in `.codi/mcp.yaml`. Distributed to all agents automatically.

## Verification & Diagnostics

```bash
codi verify                # Show verification token + artifact list
codi verify --check "..."  # Validate agent response
codi compliance            # Full health check (validate + doctor + drift)
codi doctor --ci           # CI-mode health check (exit non-zero on failure)
codi status                # Check for drift in generated files
```

## Conflict Resolution

When `codi generate` exits with code 2, it means one or more files have conflicts that could not be auto-merged. The command writes a JSON payload to stdout:

```json
{
  "type": "conflicts",
  "items": [
    {
      "label": "CLAUDE.md",
      "fullPath": "/absolute/path/CLAUDE.md",
      "currentContent": "... your local version ...",
      "incomingContent": "... new template version ..."
    }
  ]
}
```

### When you detect exit code 2

**[CODING AGENT]** Do the following immediately — do NOT show the raw JSON or exit code to the user:

1. Parse the JSON payload from stdout.
2. Tell the user in plain language:

> "I ran `codi generate` and found conflicts in N file(s): [comma-separated labels].
> These files have local customizations that differ from the updated templates.
> How would you like to resolve this?"

3. Offer two options:

> **[A] Let me handle it** — I will read both versions, merge them preserving your customizations, and continue automatically.
>
> **[B] I'll do it manually** — I will open the files with conflict markers so you can choose each change yourself.

4. Wait for the user's choice before proceeding.

### Path A — Agent resolves

For each item in the payload:

1. Read `currentContent` (your local version) and `incomingContent` (the new template).
2. Produce a merged version:
   - Keep all content unique to `currentContent` (your customizations).
   - Add all sections present in `incomingContent` but absent from `currentContent`.
   - For sections present in both where the template changed: keep `currentContent` unless it matches the old template exactly, in which case take `incomingContent`.
3. Write the merged content to `fullPath`.

After writing all resolved files, re-run `codi generate`:
- If it exits 0: report success to the user.
- If it exits 2 again: switch to Path B — the semantic merge was not sufficient. Tell the user: "The automatic merge could not fully resolve these conflicts. I've opened the files with conflict markers — please resolve them manually and confirm."

### Path B — Manual resolve

For each item in the payload:

1. Write the file at `fullPath` with git-style conflict markers:
```
<<<<<<< current (your version)
[currentContent]
=======
[incomingContent]
>>>>>>> incoming (new template)
```

2. Open the file in the user's editor (use `$VISUAL` → `$EDITOR` → `code` → `vi` resolution order).

3. Tell the user:
> "I've opened [label] with conflict markers. Choose the version you want for each section, remove the markers, save the file, and let me know when you're done."

4. When the user confirms, re-run `codi generate`. If it exits 0, report success.

### Version bump reminder

After any successful `codi generate` run that writes new content, remind the user:
> "Generation complete. If this was triggered by a template update, consider running `codi update` to check for other stale artifacts."

## Generation & Maintenance

```bash
codi generate              # Regenerate all agent config files (only needed after manual .codi/ edits)
codi generate --dry-run    # Preview without writing
codi docs-update           # Auto-fix stale documentation counts
codi doctor                # Detect remaining doc issues — act on ACTION prompts
codi clean                 # Remove generated files (keep .codi/)
codi clean --all           # Full uninstall (remove .codi/ too)
codi revert --list         # Show available backups
codi revert --last         # Restore most recent backup
codi watch                 # Auto-regenerate on .codi/ changes
```

## Self-Development Workflow (editing `src/templates/`)

> **This section applies only when you are working on the Codi source
> repository itself** — i.e. the template source of truth shipped to every consumer.
> When editing a project's own `.codi/` artifacts, use the standard
> generate flow above. CLAUDE.md and AGENTS.md carry the same guidance for readers
> arriving from the agent instruction file.

Codi moves content through three distinct layers. Understanding which
command reads from which layer prevents the most common self-dev mistake: editing
`src/templates/` and wondering why `codi generate` did nothing.

| Layer | Path | What lives here |
|-------|------|-----------------|
| 1. Source | `src/templates/` | The template shipped to consumers (the artifact) |
| 2. Installed | `.codi/<artifact-type>/<name>/` | A project's local copy of an installed artifact |
| 3. Generated | `.claude/` / `.cursor/` / `.codex/` / ... | Per-agent output produced from the installed copy |

Pipeline:

- `pnpm build` compiles `src/templates/` into `dist/`.
- `codi add <artifact-type> <name> --template <name>` copies `dist/` into `.codi/`.
- `codi generate` reads `.codi/` and writes the per-agent directories.

### Source-layer changes require clean + reinstall

**`codi generate` does NOT read from `src/templates/`.** It only reads from
`.codi/`. To make source edits take effect, refresh the installed copy first:

```bash
# 1. Edit src/templates/skills/<name>/
# 2. Rebuild compiled templates
pnpm build

# 3. Clean the stale installed copy
rm -rf .codi/skills/codi-<name>

# 4. Remove the entry from the artifact manifest
node -e "const fs=require('fs'); const p='.codi/artifact-manifest.json'; const m=JSON.parse(fs.readFileSync(p,'utf8')); if(m.artifacts) delete m.artifacts['codi-<name>']; fs.writeFileSync(p, JSON.stringify(m, null, 2)+'\n');"

# 5. Reinstall from the freshly built template
codi add skill codi-<name> --template codi-<name>

# 6. Regenerate per-agent output
codi generate --force
```

The same pattern applies to rules and agents — swap `skill` for `rule` or
`agent`. `codi update --skills --force` is documented as a refresh path
but does not consistently overwrite `.codi/` when the installed artifact
already exists; prefer the explicit clean + reinstall above for deterministic behavior.

### When it is safe to use plain `codi generate`

- Editing `.codi/` artifacts directly (adding a custom rule, tweaking a
  `managed_by: user` skill) — `generate` correctly propagates to per-agent output.
- Running verification, migration, or drift commands that only read from `.codi/`.

If you are editing `src/templates/` and only run `codi generate`, your
changes will never reach `.claude/` or any other agent directory. Always follow
the clean + reinstall flow above when the edit is at the source layer. After the
edit reaches the target, bump `version:` in the template frontmatter so downstream
consumers see the change on their next update.

## Troubleshooting

**Config validation fails:** Run `codi validate --json` to see specific errors.

**Drift detected:** Run `codi generate` to regenerate from current config.

**Token mismatch:** Config changed since last generate. Run `codi generate`, then `codi verify`.

**Agent doesn't see rules:** Check `codi status` for drift. Verify generated files exist.

**Update didn't change anything:** Check `managed_by` field — only `codi` artifacts are updated.

**Backup needed:** Backups are automatic before each generate. Use `codi revert --list` to see history.

## Related Skills

- **codi-compare-preset** — Compare local artifacts against upstream templates
- **codi-session-recovery** — Recover from repeated agent mistakes during operations

