/**
 * Live elapsed-time pill.
 *
 *   running → counts forward in seconds from `meta.startedAt` using
 *             `requestAnimationFrame` so the value is recomputed
 *             from `Date.now() - startedAt` per frame (no
 *             accumulation drift).
 *   done    → freezes at `(completedAt - startedAt) / 1000`,
 *             prefixed with "Generated in".
 *   error   → freezes the same way, prefixed with "Stopped after".
 *   idle    → renders nothing.
 *
 * v0.5.0 — Block C.
 */

import { type ReactElement, useEffect, useState } from "react";

import type { IterRunMeta } from "./useIterRunMeta";

export interface ElapsedTimerProps {
  meta: IterRunMeta;
}

function _format(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export function ElapsedTimer({ meta }: ElapsedTimerProps): ReactElement | null {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (meta.status !== "running") return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [meta.status]);

  if (meta.startedAt === null || meta.status === "idle") return null;

  if (meta.status === "running") {
    const elapsed = now - meta.startedAt;
    return (
      <span className="font-mono text-muted-foreground" style={{ fontSize: "0.65rem" }}>
        {_format(elapsed)}
      </span>
    );
  }

  // done / error — frozen
  const total = (meta.completedAt ?? Date.now()) - meta.startedAt;
  const prefix = meta.status === "error" ? "Stopped after" : "Generated in";
  return (
    <span
      className={[
        "font-mono",
        meta.status === "error" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
      ].join(" ")}
      style={{ fontSize: "0.65rem" }}
    >
      {prefix} {_format(total)}
    </span>
  );
}
