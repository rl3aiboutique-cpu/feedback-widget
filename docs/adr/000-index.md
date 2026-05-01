# Architecture Decision Records — index

Format: `NNN-<kebab-case-title>.md` with sections **Status / Context / Decision / Alternatives considered / Consequences / Evidence**.

| ADR | Status | Title |
|---|---|---|
| [001](./001-workspace-structure.md) | Accepted | Workspace structure: pnpm + uv with `packages/` and `apps/` |
| [002](./002-vendor-shadcn-inside-widget.md) | Planned (Phase 2) | Vendor shadcn primitives inside the widget |
| [003](./003-backend-auth-adapter-protocol.md) | Planned (Phase 1) | Backend auth as a `typing.Protocol` (structural, not nominal) |
| [004](./004-package-owns-its-migrations.md) | Planned (Phase 1) | Package owns its Alembic chain via `version_table_schema` |
| [005](./005-git-tag-distribution-no-publish.md) | Planned (Phase 4) | Distribution via git tags only for v0.x — no NPM/PyPI |
| [006](./006-sync-initially-async-follow-up.md) | Accepted | v0.1.0 ships sync; async port is a follow-up. Hosts pass a sync `Engine` to `register_feedback_router`. |

When adding an ADR: pick `next number = max + 1`, write the file, append a row here in the SAME commit.
