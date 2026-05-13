---
name: codi-preset-creator
description: |
  Guided creation of Codi presets. Use when the user wants
  to create, package, scaffold, fork, share, publish, or customize a
  Codi preset — a reusable bundle of rules, skills, agents,
  commands, flags, and MCP configs. Also activate for phrases like "bundle
  my rules and skills", "make a preset for my team", "org-wide preset",
  "fork the balanced preset", "share preset via ZIP", "publish preset to
  GitHub". Do NOT activate for installing an existing preset (use
  \`codi preset install\` directly), diffing local vs upstream
  (use codi-compare-preset), or contributing artifacts back to
  Codi upstream (use codi-artifact-contributor).
category: Codi Platform
compatibility: [claude-code, cursor, codex, windsurf, cline, copilot]
managed_by: codi
user-invocable: true
disable-model-invocation: false
version: 8
---

# codi-preset-creator — Preset Creator

Guide the user through creating a Codi preset — a reusable bundle of rules, skills, agents, commands, flags, and MCP configs.

## What Is a Preset?

A preset is a **named bundle** of Codi artifacts (rules, skills, agents, flags, MCP servers) that a team or organization can install as a single package. Presets answer the question "what should every project in our org look like?" — one \`codi init --preset <name>\` produces a configured \`.codi/\` ready to use.

### Built-in presets (check these first)

Before creating a custom preset, see if one of these already fits:

| Preset | Intended audience |
|--------|-------------------|
| `minimal` | Just the self-improvement core — user decides everything else |
| `balanced` | **Recommended default** — security on, type-checking strict, no force-push |
| `strict` | Security-first teams, regulated environments |
| `fullstack` | Full application teams — backend + frontend + testing + deploy |
| `development` | Contributor-heavy setup — adds artifact-contributor and preset-creator |
| `power-user` | Heavy agent users — every productivity + exploration skill enabled |

Run \`codi preset list --builtin\` to see them. **Create a custom preset only when:**

- A built-in does not fit your team's stack or policies
- You need to enforce org-specific flag defaults or artifact locks
- You want to distribute your configuration across many repos (monorepo, org-wide standards)

For a single project's customization, you often do not need a preset — just edit \`.codi/\` directly. Presets are for **distribution and reuse**.

---

## When to Activate

- User asks to create, package, or scaffold a new codi preset
- User wants to bundle existing rules, skills, and agents into a reusable configuration
- User needs to export a preset as a ZIP or publish it to a GitHub repository
- User asks how to customize or fork a built-in preset

## Skip When

- User wants to install an existing preset — use \`codi preset install <path|github:org/repo|zip>\` directly
- User wants to compare local vs upstream or audit their preset — use codi-compare-preset
- User wants to contribute an artifact back to Codi upstream — use codi-artifact-contributor
- User just wants to create a single custom rule/skill/agent (not a bundle) — use the matching creator skill

## Step 1: Define Purpose and Audience

**[CODING AGENT]** Before asking about metadata, establish **why** the preset exists. A preset without a clear audience becomes another `balanced` variant that nobody uses.

**Required (agent blocks until answered):**

1. **What problem does this preset solve that the built-ins don't?**
   - Good: *"Our fintech org requires security-scan + project-quality-guard + stricter TypeScript than `strict` — this preset codifies that."*
   - Good: *"My team builds Next.js apps and needs nextjs-researcher + frontend-design + webapp-testing in every new project."*
   - Bad: *"I just want my own preset."* (not a reason — presets are for distribution)
   - **Not sure?** Compare your intended configuration against `balanced` and `strict`. List what you are adding and what you are removing. If the delta is small, consider extending a built-in via `compare-preset` instead.

2. **Who is the audience?** Pick one:
   - (a) Personal — just me, across my own projects
   - (b) Team — a small group (5-20 people) sharing a stack
   - (c) Organization — company-wide standard across many teams
   - (d) Open-source — public distribution via GitHub
   - **Not sure?** Default to (a) personal. You can promote to team/org later.

3. **Reference preset**: start from which built-in?
   - `minimal` — start with almost nothing, add only what you need
   - `balanced` — recommended default, tune from here for most cases
   - `strict` — start here for security-first orgs
   - `fullstack` / `development` / `power-user` — start here if one matches your archetype
   - Blank — only if building something fundamentally different

**Identity metadata (after Purpose is clear):**

4. **Name**: kebab-case, max 64 chars. Use a name that signals the audience:
   - Good: `acme-fintech`, `frontend-team`, `org-security`
   - Bad: `my-preset`, `custom`, `preset-v2` (no audience signal)
5. **Description**: one sentence describing who should use it and why (not what it contains — the artifact list is separate).
6. **Version**: semver format (default: `1.0.0`). Bump on every distributed change.
7. **Tags**: comma-separated tags for discoverability — stack names (react, django), domains (fintech, medical), org names, etc.

### "Not sure?" escape hatches

- **"I don't know what to put in my preset."** Pick the reference preset closest to what you want, install it into a temp project (`codi init --preset <name>` in `/tmp/test`), use it for a week, then list the edits you made. Those edits become your preset's delta.
- **"A built-in almost fits but not quite."** Do NOT fork. Instead, use `compare-preset` + `refine-rules` to contribute the gap upstream. If the gap is truly org-specific, then fork.
- **"The preset keeps growing."** A preset with 30+ skills is suspicious. Most teams need 5-15 skills beyond the self-improvement core. Audit what everyone actually uses before bundling.

**Block rule:** Do NOT proceed to Step 2 until Questions 1-3 have clear answers.

## Step 2: Select Artifacts

**[CODING AGENT]** List available artifacts from the current project and built-in templates.

Ask the user which to include in the preset:
- **Rules**: list rules from `.codi/rules/` and built-in templates
- **Skills**: list skills from `.codi/skills/` and built-in templates
- **Agents**: list agents from `.codi/agents/`

## Step 3: Configure Flags

**[CODING AGENT]** Show the current flag configuration. Ask the user:
- Which flags should the preset override?
- What values and modes? (enabled, enforced, disabled)
- Should any flags be locked? (prevents downstream overrides)

## Step 4: MCP Configuration

**[CODING AGENT]** Ask if any MCP server configurations should be included:
- List current MCP servers from `mcp.yaml`
- User selects which to include

## Step 5: Create the Scaffold

**[CODING AGENT]** Run:
\`\`\`bash
codi preset create <name>
\`\`\`

Then populate the generated directory:
1. Update `preset.yaml` with the metadata from Step 1
2. Copy selected rules to `rules/`
3. Copy selected skills to `skills/`
4. Copy selected agents to `agents/`
5. Write `flags.yaml` with the configured overrides
6. Write `mcp.yaml` if MCP servers were selected

## Step 6: Choose Output Format

**[CODING AGENT]** Ask the user how they want to distribute the preset:

### Option A: Local directory (default)
The preset stays in `.codi/presets/<name>/`. Reference it in `codi.yaml`:
\`\`\`yaml
presets:
  - <name>
\`\`\`

### Option B: ZIP package
Export the preset as a portable ZIP file:
\`\`\`bash
codi preset export <name> --format zip --output ./<name>.zip
\`\`\`
The ZIP can be shared privately and installed with:
\`\`\`bash
codi preset install ./<name>.zip
\`\`\`

### Option C: GitHub repository
Create a repository scaffold for version-controlled distribution:
1. Create a new directory outside the project
2. Copy the preset contents there
3. Add a README.md with usage instructions
4. Add a .gitignore
5. Initialize git and push to a GitHub repository

Others can install with:
\`\`\`bash
codi preset install github:org/repo-name
\`\`\`

## Step 7: Validate

**[CODING AGENT]** Run validation to ensure the preset is well-formed:
\`\`\`bash
codi preset validate <name>
\`\`\`

Report any errors or warnings to the user.

## Important Notes

- Presets are private by default — ZIP files stay local, GitHub repos use the org's access controls
- Presets are flat and self-contained — no inheritance. To customize a built-in preset, copy its artifacts into a new preset and modify them directly
- The preset manifest (`preset.yaml`) must include at minimum: `name`, `description`, `version`
- All `.md` files in artifact directories must have valid YAML frontmatter

## Related Skills

- **codi-compare-preset** — Compare two presets or audit the active preset configuration

