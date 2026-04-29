# Upgrade strategy

How `@rl3/feedback-widget` evolves once it's installed in N consumer
repos (sapphira-clinic, capellai-ai-crm, future RL3 products).

## Versioning contract — strict SemVer

| Bump | Trigger | Consumer action |
|---|---|---|
| **PATCH** `0.1.X` | bug fixes, doc tweaks, no public-API change | renovate auto-PR + auto-merge if CI green |
| **MINOR** `0.X.0` | additive features (new hooks, new optional bindings, new endpoints) | renovate auto-PR; human review the changelog |
| **MAJOR** `X.0.0` | breaking changes (renamed exports, removed methods, schema migrations that need data work) | renovate auto-PR; human follows `MIGRATION-v{X}.md`; cannot auto-merge |

Each version maps to:

* a git tag `vX.Y.Z`
* a GitHub release with auto-generated notes + the frontend tarball as an asset
* a CHANGELOG.md section

## How consumers pin the version

**Backend (Python — uv)**:

```toml
# pyproject.toml
[project.dependencies]
"rl3-feedback-widget @ git+https://github.com/rl3aiboutique-cpu/feedback-widget.git@v0.1.0#subdirectory=packages/feedback-backend"
```

**Frontend (JS — pnpm)**:

```json
{
  "dependencies": {
    "@rl3/feedback-widget": "github:rl3aiboutique-cpu/feedback-widget#v0.1.0"
  }
}
```

The git tag is the only piece that changes when upgrading.

## Manual upgrade — 4 commands

```bash
# 1. Bump the tag in both lockfiles
sed -i 's|feedback-widget.git@v0\.1\.0|feedback-widget.git@v0.1.1|' backend/pyproject.toml
sed -i 's|feedback-widget#v0\.1\.0|feedback-widget#v0.1.1|' frontend/package.json

# 2. Re-resolve dependencies
cd backend && uv lock --upgrade-package rl3-feedback-widget && uv sync
cd ../frontend && pnpm install

# 3. Apply any new migrations the version brought
docker compose exec backend python -m feedback_widget migrate

# 4. Smoke-test the widget on the running host
curl http://localhost:8000/api/v1/feedback/health
```

## Automated upgrade — Renovate

Each consumer adds a Renovate configuration that recognises the git
URL pattern and opens a PR when a new tag ships:

```jsonc
// .github/renovate.json (in the consumer repo)
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:base"],
  "regexManagers": [
    {
      "fileMatch": ["pyproject\\.toml$", "package\\.json$"],
      "matchStrings": [
        "feedback-widget(?:\\.git)?[@#]v(?<currentValue>\\d+\\.\\d+\\.\\d+)"
      ],
      "datasourceTemplate": "github-tags",
      "depNameTemplate": "rl3aiboutique-cpu/feedback-widget",
      "versioningTemplate": "semver"
    }
  ],
  "packageRules": [
    {
      "matchPackageNames": ["rl3aiboutique-cpu/feedback-widget"],
      "matchUpdateTypes": ["patch"],
      "automerge": true
    }
  ]
}
```

What this gives you:

* PATCH bumps merge themselves once CI is green (the consumer's own
  tests still gate the merge — no widget release ships into prod
  unless the consumer's CI agrees).
* MINOR / MAJOR bumps land as a PR with the widget's changelog body
  pasted in; the human reviewer decides.

## Automated post-merge: re-deploy + run migrations

Each consumer's CD pipeline runs `python -m feedback_widget migrate`
as a step in its deployment script — same way it runs the host's own
`alembic upgrade head`. The widget's chain uses
`version_table='feedback_widget_alembic_version'`, so it never
collides with the host's `alembic_version` table even when both run
in the same database.

Sapphira example (`backend/Dockerfile` entrypoint):

```bash
#!/usr/bin/env bash
set -euo pipefail
alembic upgrade head                          # host's own migrations
python -m feedback_widget migrate             # widget's migrations
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
```

CRM example (when it adopts the package): identical, swap
`alembic upgrade head` for the CRM's existing migration step.

## Breaking-change discipline

The widget's own CI guards consumers from accidental breakage:

1. **Cross-boundary import check** — `frontend.yml` greps for
   `from "@/"` inside `packages/feedback-frontend/src/` and fails the
   build if anyone re-introduces a host-coupled import.

2. **Dist-size budget** — also in `frontend.yml`; rejects merges that
   push the minified bundle past 300 KB. Stops the package from
   bloating into a transitive performance regression in every host.

3. **Test gate** — backend has 28 unit tests + 7 integration tests
   running against a real Postgres in CI; frontend has vitest
   coverage for the adapter + redactors. Failing tests block the
   release workflow from publishing the GitHub release.

4. **Bandit security scan** — non-blocking warning today; will be a
   gate at `v1.0.0`.

5. **Type-surface diff** (planned for `v0.2.0`) — diff
   `dist/index.d.ts` between the previous tag and this one; require a
   `BREAKING:` prefix in the commit message if any export shape
   changed.

## Cutting a new release — 3 commands inside `feedback-widget/`

```bash
# 1. Bump the version and CHANGELOG (a small script runs both files in lockstep)
make bump-patch     # or: make bump-minor / make bump-major

# 2. Push the commit + tag
git push origin main && git push origin v0.1.1

# 3. Watch CI build the GitHub release; consumers' Renovate sees the new
#    tag inside an hour and opens its PR.
gh release view v0.1.1
```

## What we tested before declaring this strategy "real"

The `feedback-widget` repo contains the validation of every step
above:

| Claim | Evidence |
|---|---|
| Sync engine path picks up automatically | `apps/sandbox-host/backend/app/main.py` boots through `register_feedback_router` and the migrations apply on first run (see container logs of `feedback-sandbox-backend`). |
| The migration chain coexists with the host | Sandbox's `feedback_widget_alembic_version` table sits next to a (would-be) sapphira `alembic_version` — no name collision possible. |
| The frontend dist is consumable by a vanilla Vite host | The sandbox is exactly that: Vite + React 19 + workspace-linked package. Bundle size 450 KB total, gzip 144 KB. |
| Sapphira compiles + runs against `v0.1.0` from the public repo | `cd sapphira-clinic/backend && uv sync` + `cd ../frontend && pnpm install` resolved `git+https://...@v0.1.0` cleanly. The branch `feat/feedback-widget` carries the full integration. |
| The toast binding works either way | Sandbox uses the default console-only fallback; sapphira swaps it for sonner via the `bindings.toast` slot. |

## Two phases ahead

* **v0.2.0** — async port (ADR-006 follow-up) + type-surface diff CI
  gate. Async lets sapphira drop the dedicated sync engine.
* **v1.0.0** — when both sapphira and CRM have consumed the widget
  for two consecutive minor versions without breakage, we cut
  `1.0.0` and then revisit ADR-005 / ADR-043: at that point publishing
  to a private NPM + PyPI registry probably becomes worth the
  pipeline complexity, because the API has demonstrated stability
  across two real consumers.
