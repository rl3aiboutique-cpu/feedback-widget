# codi-skill-creator

Creates, improves, and migrates Codi skills. Covers the full 11-step lifecycle: intent capture, scaffolding, SKILL.md authoring, eval writing, quality testing, description optimization, versioning, packaging, import/migration, and security review.

## Prerequisites

| Dependency | Install | Purpose |
|------------|---------|---------|
| Node.js 18+ | required | codi CLI and TypeScript scripts |
| codi CLI | `npm install -g codi` | scaffold skills, run evals, generate |
| Python 3.9+ | optional | Python-based skill scripts and evals |

## Scripts

| Directory | Runtime | Purpose |
|-----------|---------|---------|
| `scripts/python/` | Python | Python-based skill utilities |
| `scripts/ts/` | TypeScript (`npx tsx`) | TypeScript skill utilities |

## Key Concepts

### Skill Destinations

| Destination | Path | When |
|-------------|------|------|
| Project skill | `.codi/skills/<name>/` | installed in one project (default) |
| Built-in template | `src/templates/skills/<name>/` | ships to all codi users (contributors only) |

### Skill Directory Layout

```
<name>/
├── SKILL.md          # Instructions read by the coding agent
├── evals/
│   └── evals.json    # Test cases for the skill
├── scripts/          # Helper scripts referenced by SKILL.md
├── references/       # Supporting documentation and examples
├── assets/           # Images, diagrams, media
├── agents/           # Subagent definitions for eval runners
└── README.md         # Setup guide (this file pattern)
```

### Eval Format (`evals.json`)

```json
{
  "skillName": "my-skill",
  "cases": [
    {
      "id": "case-01",
      "input": "User message that should trigger the skill",
      "expectedBehavior": "What the skill should produce",
      "tags": ["happy-path"]
    }
  ]
}
```

## Quick Start (project skill)

```bash
# Scaffold a new skill
codi add skill my-skill

# Edit the generated SKILL.md
# Add eval cases to evals/evals.json

# Run evals to verify behavior
codi eval my-skill

# Generate / sync to all supported agents
codi generate
```
