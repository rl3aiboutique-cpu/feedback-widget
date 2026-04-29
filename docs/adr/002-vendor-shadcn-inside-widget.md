# ADR-002 — Vendor shadcn primitives inside the widget (pays CRM ADR-042 debt)

| | |
|---|---|
| **Status** | Planned (will be Accepted at end of Phase 2) |
| **Date** | 2026-04-29 |
| **Phase** | 2 (frontend extraction) |

## Context

CRM `ADR-042` (`docs/adr/042-feedback-widget-adapter-seam.md`) records 29 cross-boundary imports in 8 widget files: 28 to `@/components/ui/*` (shadcn primitives) and 3 to `@/client` (the host SDK). That ADR explicitly defers the fix to "the extraction phase". This is the extraction phase.

The widget's frontend cannot live in `@rl3/feedback-widget` while it imports from a host-specific path alias. Either we bring the primitives along, or we exclude them and demand every host pre-install shadcn under the same alias and the same component versions.

## Decision

We **vendor** the 10 shadcn primitives the widget consumes inside `packages/feedback-frontend/src/ui/`:

`button`, `sheet`, `table`, `select`, `dropdown-menu`, `badge`, `input`, `label`, `textarea`, `tabs`.

Every widget file imports them via relative paths (`./ui/button`, etc.). The widget's `package.json` lists `@radix-ui/*` + `class-variance-authority` + `tailwind-merge` + `lucide-react` as direct dependencies (not peer) so each install is self-contained.

A regression test enforces the boundary: `grep -r 'from "@/' packages/feedback-frontend/src/` MUST return zero hits at every commit.

## Alternatives considered

- **Component registry on `FeedbackAdapter`** (host injects `Button`, `Sheet`, etc.). Rejected — the typed contract for 10 primitives × multiple variants is high-overhead, and changing it later breaks every consumer.
- **Demand hosts pre-install shadcn at `@/components/ui/*`.** Rejected — silently downgrades the extraction promise. A new host that uses Mantine or stock Radix has to fork or rewrite.
- **Publish the vendored UI as a separate `@rl3/feedback-widget-ui` package.** Rejected — over-engineering for ten files. Revisit if a second RL3 widget needs the same primitives.

## Consequences

**Easier**:

- Hosts install one package. Tailwind preset + styles.css cover the look.
- Bumping shadcn happens inside the widget on its own cadence; hosts ride along.

**Harder**:

- The widget vendors ~10 files of shadcn that already live in CRM and sapphira. Some duplication of upstream primitives.

**Riskier**:

- If shadcn evolves, the widget's vendored copies drift. Mitigation: `make sync-shadcn` script (Phase 4) re-syncs from the upstream registry and fails CI on diff.

## Evidence

To be added at end of Phase 2:

- The 10 files in `packages/feedback-frontend/src/ui/`
- The CI grep guard in `.github/workflows/frontend.yml`
- A grep-in-the-PR-body confirmation that 0 hits remain.
