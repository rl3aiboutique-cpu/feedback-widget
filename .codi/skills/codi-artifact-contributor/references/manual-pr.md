# Manual Pull Request Workflow

Reference for advanced users who prefer to build the PR by hand instead of
using `codi contribute`. Read when the main flow reaches Step 3 Option B.

## 1. Clone the target repository

```bash
git clone https://github.com/lehidalgo/codi.git /tmp/codi-contrib
cd /tmp/codi-contrib
```

Substitute the target repo if contributing to a custom or team repository.

## 2. Create a contribution branch

```bash
git checkout -b contrib/add-my-artifact
```

## 3. Convert the artifact to a TypeScript template

- Rules  → `src/templates/rules/{name}.ts`
- Skills → `src/templates/skills/{name}/template.ts` (plus `index.ts`)
- Agents → `src/templates/agents/{name}.ts`

Source-layer edits do not propagate automatically. `codi generate` reads
from `.codi/`, not from `src/templates/`. To verify your new artifact
inside the Codi repo before pushing:

1. `pnpm build`
2. Remove the stale installed copy at `.codi/<artifact-type>/codi-<name>`
3. Delete its entry from `.codi/artifact-manifest.json`
4. `codi add <artifact-type> codi-<name> --template codi-<name>`
5. `codi generate --force`

The `codi-dev-operations` skill documents the full flow.

## 4. Export as a template string

```typescript
export const template = `---
name: {{name}}
description: Your artifact description
managed_by: codi
---

# {{name}}

Your artifact content here...
`;
```

## 5. Register in the corresponding index.ts

Add an `export` entry so the loader picks up the new template.

## 6. Push and open the PR

```bash
git remote add user https://github.com/YOUR_USERNAME/codi.git
git push user contrib/add-my-artifact
gh pr create --repo lehidalgo/codi --base develop \
  --title "feat: add my-artifact template" \
  --body "Description of the contribution"
```

Target the `develop` branch — not `main`.
