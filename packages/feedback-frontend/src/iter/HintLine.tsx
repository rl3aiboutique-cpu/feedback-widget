/**
 * Single line of helper copy in the rail's metadata strip.
 *
 *   running → model latency hint ("20–60s typical on Flash models.").
 *   done    → "Generated in Xs" — but ElapsedTimer already shows
 *             the timer, so HintLine renders a short "listo" cue
 *             with the model name.
 *   error   → "Stream interrumpido" + the user-friendly error.
 *   idle    → empty.
 *
 * No hard-coded model copy: the latency hint is derived from
 * `meta.active` via `modelLatencyHint`. Active model never appears
 * in the literal copy string.
 *
 * v0.5.0 — Block C.
 */

import type { ReactElement } from "react";

import { modelLatencyHint } from "./markdownView";
import type { IterRunMeta } from "./useIterRunMeta";

export interface HintLineProps {
  meta: IterRunMeta;
  errorMessage?: string | null;
}

export function HintLine({ meta, errorMessage }: HintLineProps): ReactElement | null {
  if (meta.status === "idle") return null;
  if (meta.status === "running") {
    return <span>{meta.active ? modelLatencyHint(meta.active) : null}</span>;
  }
  if (meta.status === "error") {
    return (
      <span className="text-amber-700 dark:text-amber-300">
        Stream interrumpido. {errorMessage ?? ""}
      </span>
    );
  }
  // done
  return <span>Listo.</span>;
}
