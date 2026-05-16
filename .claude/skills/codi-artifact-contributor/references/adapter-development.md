# Adapter Development Contribution Guide

Reference for contributing new AI agent adapters or extending existing ones.
Read when the user wants to add support for a new agent platform (e.g., Copilot,
Cline, Windsurf, new IDE) or extend an existing adapter with missing features.

This guide encodes lessons learned from the GitHub Copilot adapter remediation
(PR #61, April 2026), a multi-phase fix that turned up eight distinct bugs.
The most dangerous was a `codi clean` derivation that would have recursively
deleted the project root on every run in a Codex-enabled project — caught only
because existing hook-preservation tests failed.

**Read this guide before writing any adapter code.** The patterns it encodes
cost days to discover the first time; following them should take minutes.

## Adapter Contract

Every adapter in `src/adapters/` must implement:

- `detect(projectRoot)` — return true if the platform's config files are present
- `generate(options)` — return the full list of files to write for the platform
- `paths` — declare canonical output directories (rules, skills, agents, mcp)

New adapters must be registered in `src/adapters/index.ts` and added to the
platform compatibility list in `src/constants.ts`.

## Phase 1 — Specification Validation (Do This First)

**The dual-format problem is the #1 reason adapters ship incomplete.**

Platforms often support multiple formats for the same artifact type — one for
the IDE, one for the CLI, one for the agent runtime. Missing a format silently
drops entire use cases.

### 1.1 Read the official platform documentation end-to-end

Do not rely on memory or prior assumptions. Download:

- The platform's configuration file reference
- The skill/command/prompt format specification
- CLI documentation (if separate from IDE)
- Any agent/coding-agent runtime docs

### 1.2 Build a capability matrix before coding

```
| Codi Artifact | Platform Formats         | Adapter Plan     |
|---------------|--------------------------|------------------|
| Rules         | prompts.md, instructions | Both             |
| Skills        | prompt.md + SKILL.md     | Both (dual)      |
| Agents        | agent.md                 | Single           |
| MCP           | mcp.json                 | Single           |
```

Red flags:
- Platform supports format X, matrix says "TODO" → coverage gap
- IDE and CLI use different formats, matrix only lists one → missing use case
- Codi artifact has no platform mapping → orphaned artifact type

### 1.3 Example — GitHub Copilot (what went wrong initially)

Copilot supports two official skill formats:

1. **Prompt Files** (`.github/prompts/*.prompt.md`) — VS Code Copilot Chat
2. **Agent Skills** (`.github/skills/{name}/SKILL.md` + subdirs) — Coding Agent and CLI

The original adapter implemented only format #1. Scripts, references, and
assets in `.codi/skills/NAME/` were silently dropped for Copilot users.
`${CLAUDE_SKILL_DIR}` was stripped to empty string, producing broken paths.

**Fix pattern:** add format #2 alongside format #1, resolve placeholders to
concrete workspace-relative paths, detect both directories, test both outputs.

## Phase 2 — Security Hardening

### 2.1 Path Sanitization

Artifact names come from user-controlled input (skill names, rule names).
Without sanitization, a name like `"../../etc/passwd"` escapes the intended
output directory.

The single source of truth lives at `src/utils/path-guard.ts` and is re-exported
via `src/utils/index.ts`. Every adapter must import and use it:

```typescript
import { sanitizeNameForPath } from "../utils/path-guard.js";

// ❌ DANGEROUS: raw name in path
const dirPath = `${COPILOT_PATHS.skills}/${skill.name}`;

// ❌ DANGEROUS: lax sanitization — only strips whitespace
const fileName = rule.name.toLowerCase().replace(/\\s+/g, "-") + ".md";

// ✅ SAFE: shared strict sanitization
const dirPath = `${COPILOT_PATHS.skills}/${sanitizeNameForPath(skill.name)}`;
const fileName = `${sanitizeNameForPath(rule.name)}.md`;
```

Apply it **everywhere** a name becomes a path segment — rules, skills, agents,
brands, custom directories. Inconsistency between one adapter using it and
another not using it is a supply-chain risk, because the weakest adapter sets
the effective security level of the codebase.

### 2.2 YAML Injection Prevention

When emitting frontmatter, use a shared builder. Never concatenate user
strings into YAML without escaping special characters (`:`, `"`, newlines).

### 2.3 Placeholder Resolution

Placeholders like `${CLAUDE_SKILL_DIR}` and `[[/path]]` must resolve to valid
workspace-relative paths on every platform that supports a directory structure.
Stripping to empty string produces broken paths — e.g., `/scripts/run.sh`
instead of `.github/skills/my-skill/scripts/run.sh`.

Test the resolution explicitly. Grep the generated output for leading `/` on
script paths — if you see it, resolution is broken.

## Phase 3 — Test Infrastructure

### 3.1 Real file I/O, not mocks

Adapter tests that generate files **must** use a real temporary directory with
`beforeEach` / `afterEach` cleanup. Mocking the file system hides path-resolution
bugs, sanitization bugs, and directory-structure bugs.

```typescript
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "adapter-test-"));
  await mkdir(join(tmpDir, ".codi", "skills"), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});
```

### 3.2 Required QA coverage

Every adapter test suite must validate:

- **Format coverage** — all official formats produce output
- **Path resolution** — placeholders resolve to correct paths
- **Field filtering** — only platform-supported fields appear in output
- **Brand skill handling** — brand skills are inlined, not emitted as separate artifacts
- **Path sanitization** — malicious names cannot escape the output directory
- **Dual-format consistency** — when two formats describe the same artifact,
  both contain the expected content

### 3.3 Security test template

```typescript
it("sanitizes artifact names to prevent path traversal", async () => {
  const malicious = { name: "../../etc/passwd", content: "x" };
  const files = await adapter.generate({ skills: [malicious], projectRoot });
  for (const f of files) {
    expect(f.path).not.toContain("..");
    expect(f.path).toMatch(/^[./\w-]+$/);
  }
});
```

## Phase 4 — Declared Paths Must Match Actual Output

The `paths` object on every `AgentAdapter` is a contract. It tells the rest of
Codi where the adapter writes its files. The cursor adapter shipped with
`paths.skills: null` while its `generate()` wrote to `.cursor/skills/`. The
discrepancy was invisible until `codi clean` started deriving its allowlist
from `ALL_ADAPTERS` and silently skipped `.cursor/skills/`.

### 4.1 Self-check rule

For every adapter, a unit test must assert two things:

1. Every `paths.*` field is either `null` (the adapter does not produce
   that artifact type) or the exact prefix of every file `generate()` produces
   for that type.
2. Every file in the `generate()` output starts with one of:
   `paths.rules`, `paths.skills`, `paths.agents`, `paths.instructionFile`,
   `paths.mcpConfig`, or an explicit adapter-specific extra (and that extra
   must be exported from a module-level `PATHS` constant — see Phase 2.4).

Orphan paths (declared but never written) and undeclared paths (written but
not declared) are equally bad. Both lead to incomplete `codi clean`,
incorrect detection, and broken assumptions in downstream tooling.

### 4.2 Single-source-of-truth for output paths

Declare every directory and file the adapter writes in a module-level
constant before the adapter object:

```typescript
const GITHUB_DIR = ".github";
const VSCODE_DIR = ".vscode";

const COPILOT_PATHS = {
  configRoot: GITHUB_DIR,
  rules: `${GITHUB_DIR}/instructions`,
  skills: `${GITHUB_DIR}/skills`,
  agents: `${GITHUB_DIR}/agents`,
  instructionFile: `${GITHUB_DIR}/copilot-instructions.md`,
  mcpConfig: `${VSCODE_DIR}/mcp.json`,
  // Adapter-specific extras not modelled in AgentPaths
  prompts: `${GITHUB_DIR}/prompts`,
  hooks: `${GITHUB_DIR}/hooks`,
  hooksFile: `${GITHUB_DIR}/hooks/codi-hooks.json`,
} as const;

export const copilotAdapter: AgentAdapter = {
  paths: {
    configRoot: COPILOT_PATHS.configRoot,
    rules: COPILOT_PATHS.rules,
    skills: COPILOT_PATHS.skills,
    agents: COPILOT_PATHS.agents,
    instructionFile: COPILOT_PATHS.instructionFile,
    mcpConfig: COPILOT_PATHS.mcpConfig,
  } satisfies AgentPaths,
  // ...
};
```

Then in `detect()`, `generate()`, and any helper, reference `COPILOT_PATHS.*`
— never a string literal. After the change, `grep -r "\".github/" src/adapters/copilot.ts`
should return only the lines inside the `COPILOT_PATHS` declaration itself.

## Phase 5 — `codi clean` Compatibility

The clean command derives its uninstall list from `ALL_ADAPTERS`. A new
adapter that follows Phases 1–4 will be cleaned automatically — but only if
the declared paths follow these rules.

### 5.1 Never declare a path that points at the project root

Codex declares `paths.rules = "."` because AGENTS.md lives at the project
root. The clean command's safety filter (`isSafeSubdir` in `src/cli/clean.ts`)
rejects `""`, `"."`, `"./"`, `".."`, `"/..."`, and absolute paths to prevent
recursive deletion of the project root. **Do not rely on the filter as your
first line of defence** — declare specific subdirectories whenever possible.

If your adapter genuinely writes to the project root (e.g., for a
top-level config file), use `paths.instructionFile = "FILENAME.md"` for the
file itself and leave `paths.rules` pointing at a real subdirectory or `null`.

### 5.2 Adapter-specific extras must be added to clean's supplementary list

If your adapter writes to a directory not in `AgentPaths` (brands, prompts,
custom hook configs), add it explicitly to `AGENT_SUBDIRS` or `AGENT_FILES`
in `src/cli/clean.ts` with a comment explaining why it is not derivable.

Examples already in the supplementary list:
- `.github/prompts` — Copilot's secondary skill format (not modelled in `AgentPaths`)
- `.claude/brands`, `.cursor/brands` — brand directories (not modelled in `AgentPaths`)
- `.github/hooks/codi-hooks.json` — single Copilot hooks file (the hooks
  directory itself is shared with the user, so we target the file only)

### 5.3 Never add a user-shared directory to `AGENT_PARENT_DIRS`

`.github/` and `.vscode/` are shared with the user (workflows, dependabot,
launch configurations, settings.json). Codi removes only the specific files
and subdirectories it generates inside them. The directories themselves
must survive a `codi clean --all`.

This is enforced by `AGENT_PARENT_DIRS` in `src/cli/clean.ts`. If you add a
new agent that writes inside one of these directories, do **not** add the
parent to that list.

### 5.4 Test `codi clean` on every new adapter

Add a regression test that:
1. Sets up codi-generated files in the adapter's output paths
2. Sets up user-owned files in shared directories (e.g., `.github/workflows/`)
3. Runs `cleanHandler(tmpDir, { json: true })`
4. Asserts every codi file is gone
5. Asserts every user file is preserved
6. Asserts the shared directories themselves still exist

See the test
`removes Copilot generated files and subdirs, preserves user-owned .github/ entries`
in `tests/unit/cli/clean.test.ts` as the canonical pattern.

## Phase 6 — Documentation Sync

When you finish an adapter change, verify these are in sync:

- [ ] Adapter JSDoc lists all supported output formats
- [ ] `detect()` checks for all format directories
- [ ] Capability matrix in the audit doc is up to date
- [ ] Examples in the main README / docs show each format
- [ ] No Codi artifact type lacks a platform mapping (no orphans)

Create a remediation summary document in `docs/` using the `[AUDIT]` category
for any adapter change that fixed a security or correctness issue:

```
YYYYMMDD_HHMM_[AUDIT]_adapter-name-remediation.md
```

Follow the format used for `docs/20260417_1645_[AUDIT]_copilot-adapter-remediation-summary.md`.

## Contribution Checklist (Humans and Coding Agents)

### Pre-development
- [ ] Read official platform documentation end-to-end
- [ ] Built a capability matrix and identified gaps
- [ ] Created an implementation plan document under `docs/[PLAN]`
- [ ] Scope approved before coding starts

### Implementation
- [ ] All official platform formats are emitted
- [ ] Path sanitization imports `sanitizeNameForPath` from `src/utils/path-guard.js`
  (never inline the regex — duplication drifts)
- [ ] YAML frontmatter goes through the shared builder (`fmStr` from `src/utils/yaml-serialize.js`)
- [ ] Adapter output directories are declared once in a module-level
  `PATHS` constant and referenced everywhere — no string literals for
  `.github/*`, `.claude/*`, etc. inside `generate()` or `detect()`
- [ ] Placeholders (`${CLAUDE_SKILL_DIR}`, `[[/path]]`) resolve to concrete
  workspace-relative paths built from the `PATHS` constant
- [ ] Adapter JSDoc documents every format emitted
- [ ] `detect()` checks every format directory from `PATHS`
- [ ] `paths.*` declarations match what `generate()` actually writes — no
  `null` field for an artifact type the adapter actually produces
- [ ] If the adapter writes to a directory not modelled in `AgentPaths`
  (brands, prompts, hooks, etc.), the path is added to the supplementary
  lists in `src/cli/clean.ts` with a comment explaining why
- [ ] If the adapter writes inside a user-shared directory like `.github/`
  or `.vscode/`, the parent directory is **not** in `AGENT_PARENT_DIRS`

### Testing
- [ ] `tmpDir` + `beforeEach` / `afterEach` pattern is used
- [ ] Each format has at least one unit test validating content
- [ ] Path traversal attack test is present
- [ ] Dual-format consistency test exists when two formats describe the same artifact
- [ ] Declaration-vs-output test: every file in `generate()` output has a
  path that starts with one of the declared `paths.*` values or an explicit
  adapter-specific extra
- [ ] `codi clean` regression test: codi files removed, user files preserved
  (model on the Copilot test in `tests/unit/cli/clean.test.ts`)
- [ ] `pnpm test` passes with zero failures

### Documentation
- [ ] Adapter JSDoc updated
- [ ] Audit document under `docs/[AUDIT]_` has a capability matrix entry
- [ ] Remediation summary created if this fixed a security or correctness issue
- [ ] No Codi artifact type is orphaned on this platform

### Final review
- [ ] `pnpm build` passes with zero TypeScript errors
- [ ] `pnpm test` passes
- [ ] Manual review: grep `src/adapters/<name>.ts` for raw `skill.name`
  appearances in paths — there should be none
- [ ] Manual review: grep generated output for `${CLAUDE_SKILL_DIR}` — it
  should be resolved, not literal
- [ ] Manual review: `node dist/cli.js clean --dry-run` lists every file
  the adapter generated; user-owned files in shared directories are absent
  from the list
- [ ] Manual review: grep `src/adapters/<name>.ts` for hardcoded path
  literals like `".github/"`, `".claude/"`, etc. — every reference should
  go through the module-level `PATHS` constant
