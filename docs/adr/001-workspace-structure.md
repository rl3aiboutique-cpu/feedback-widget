# ADR-001 — Workspace structure: pnpm workspace + uv workspace, `packages/` and `apps/`

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-04-29 |
| **Phase** | 0 (bootstrap) |
| **Supersedes** | — |

## Context

The repo holds two installable packages (Python + JS) plus a sandbox host that depends on both. We need a layout that:

1. Lets each installable package have its own `pyproject.toml` / `package.json` and lockfiles, so the two distributables are clean copies — not blob from a monorepo.
2. Lets the sandbox host depend on the **local** versions of both packages during development (no `pip install` round-trip after every change), while still being a representative consumer.
3. Keeps a single CI surface so a PR touching the package and the host runs both test suites in lockstep.

Naïve placements considered:

- **Flat repo** (one Python package + one JS package at root). Rejected: there's no place for the sandbox host. It would have to be a separate repo or `examples/` that nobody runs.
- **Two separate repos** (one per language). Rejected: doubles the CI surface, ADR log fragments, version skew between the Python schema and the TS SDK becomes routine.

## Decision

```
feedback-widget/
├── packages/
│   ├── feedback-backend/   # rl3-feedback-widget (Python, uv workspace member)
│   └── feedback-frontend/  # @rl3/feedback-widget (JS, pnpm workspace member)
└── apps/
    └── sandbox-host/
        ├── backend/        # uv workspace member; depends on packages/feedback-backend via path
        └── frontend/       # pnpm workspace member; depends on @rl3/feedback-widget via workspace:*
```

Two workspace systems run side by side:

- **pnpm workspace** (`pnpm-workspace.yaml`) — `packages/feedback-frontend` + `apps/sandbox-host/frontend`. Linked via `workspace:*` in the sandbox's `package.json`.
- **uv workspace** (`tool.uv.workspace.members` in root `pyproject.toml`) — `packages/feedback-backend` + `apps/sandbox-host/backend`. Linked via `tool.uv.sources` in the sandbox's `pyproject.toml`.

The two managers are independent (no shared root `package.json` or `pyproject.toml` ownership of files), but they share the same `feedback-widget/` git root, the same CI workflow split (`backend.yml` + `frontend.yml`), and the same Makefile.

## Alternatives considered

- **Single Python package containing both backend and a "frontend assets" folder.** Rejected — the JS package has its own dependency graph (React, tsup, Tailwind preset) that has no business landing in the Python wheel.
- **Nx / Turborepo for the JS side.** Rejected — adds a layer of build orchestration we don't need yet. pnpm workspace + a Makefile is enough for two JS packages.
- **Hatch monorepo plugin instead of uv workspace.** Rejected — uv workspace is the lowest-friction path that's already standardised in our other repos.

## Consequences

**Easier**:

- Local development of the sandbox host picks up package changes instantly via workspace links, no rebuild loop.
- Each installable package has a tidy directory with its own README and pyproject/package.json — ready to publish as-is when ADR-005 is revisited.
- ADR log applies to the whole repo (one history, one numbering).

**Harder**:

- Two managers to keep in sync. Mitigation: the Makefile's `install` target runs both, and CI runs both jobs.
- pnpm git-URL installs on subdirectories are tricky (see ADR-005). Mitigation: `release.yml` produces a tarball as the primary artefact.

**Riskier**:

- Drift between the package's published version and the workspace `0.1.0` placeholder. Mitigation: Phase 4 wires `version` bumps to a script that updates both `pyproject.toml` and `package.json` in lockstep.

## Evidence

- `pnpm-workspace.yaml`
- Root `pyproject.toml` `[tool.uv.workspace]`
- `Makefile` (`install`, `sandbox-up`, `lint`, `typecheck`, `test` targets)
- `.github/workflows/backend.yml` and `frontend.yml`
