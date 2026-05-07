/**
 * Compact badge showing the model currently serving the run.
 *
 * Pure render of `meta.active`. The bolt icon flips visual state
 * when a fallback has happened (`meta.fallbackReason !== null`) so
 * the user can tell at a glance "we walked the chain".
 *
 * Tooltip via the native `title` attribute — no new tooltip
 * primitive needed for v0.5. If we add Radix Tooltip later for
 * keyboard-accessible hover, this is the seam.
 *
 * v0.5.0 — Block C.
 */

import type { ReactElement } from "react";

import type { IterRunMeta } from "./useIterRunMeta";

export interface ModelBadgeProps {
  meta: IterRunMeta;
}

export function ModelBadge({ meta }: ModelBadgeProps): ReactElement {
  const fellBack = meta.fallbackReason !== null;
  const display = meta.active ?? "—";
  const tooltip = fellBack
    ? `${meta.fallbackReason} — primario configurado: ${meta.requested ?? "—"}`
    : `Modelo activo: ${display}`;
  return (
    <span
      title={tooltip}
      className={[
        "inline-flex items-center gap-1 rounded font-mono",
        "px-1.5 py-0.5",
        fellBack
          ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
          : "bg-muted text-muted-foreground",
      ].join(" ")}
      style={{ fontSize: "0.6rem" }}
    >
      <span aria-hidden="true">⚡</span>
      <span className="truncate">{display}</span>
    </span>
  );
}
