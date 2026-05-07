/**
 * Single source of truth for the iter run's "live model + status"
 * picture. Block C of the v0.5 redesign.
 *
 * Combines two upstream sources into one derived object so every
 * consumer (badge, elapsed timer, hint line, fallback toast) reads
 * from the same shape — no consumer infers state from siblings,
 * keeping the rail consistent during rapid SSE updates.
 *
 * Sources:
 *
 *   1. The SSE reducer state (`useIterRunStream.state`):
 *        - `activeModel`        — last `provider_active` event.
 *        - `providerFallback`   — last walk's from→to.
 *        - `status`             — running / done / error / idle.
 *        - `startedAt` / `completedAt`.
 *   2. The persisted `IterSessionRead`:
 *        - `current_primary_model_id` — env-derived primary at
 *          request time. Used as the *defensive bootstrap* for
 *          `active` when no SSE event has arrived yet (cold start
 *          or browser refresh mid-stream).
 *
 * v0.5.0 — Block C.
 */

import type { IterSessionRead } from "../client/types";
import type { IterStreamState, IterStreamStatus } from "./useIterRunStream";

export interface IterRunMeta {
  /** The model the host configured as primary at the start of the
   * run. Stable for the duration of the session. */
  requested: string | null;
  /** The model currently serving traffic. Pure render of the latest
   * `provider_active` SSE event; falls back to `requested` when
   * none has arrived yet. */
  active: string | null;
  /** Human-readable Spanish reason for the most recent fallback,
   * or `null` if no walk has occurred. Drives the toast copy. */
  fallbackReason: string | null;
  /** Mirrors `IterStreamState.status` for direct consumption by
   * the timer / hint widgets without them touching the stream
   * object. */
  status: IterStreamStatus;
  /** Wall-clock ms when the user pressed Run; used by the elapsed
   * timer. Null while idle. */
  startedAt: number | null;
  /** Wall-clock ms when the stream reached `done` or `error`.
   * Frozen for the rest of the session lifetime so the timer pill
   * stops counting. Null while running. */
  completedAt: number | null;
}

export function deriveIterRunMeta(
  stream: IterStreamState,
  session: IterSessionRead | undefined,
): IterRunMeta {
  const requested = session?.current_primary_model_id ?? null;
  // Defensive bootstrap: if no `provider_active` event has arrived
  // yet (cold start, browser refresh mid-stream), fall back to the
  // session's primary so the badge never flashes empty.
  const active = stream.activeModel ?? requested;
  return {
    requested,
    active,
    fallbackReason: stream.providerFallback?.reason ?? null,
    status: stream.status,
    startedAt: stream.startedAt,
    completedAt: stream.completedAt,
  };
}
