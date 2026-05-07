/**
 * Right rail of the iter focus view — run-metadata only.
 *
 * Block A wires the live, data-derived parts (round indicator,
 * `IterContextPanel`) and exposes named slots for Block C to fill
 * (model badge, elapsed timer, latency hint, fallback toast landing).
 * Each slot is optional; the rail renders a small placeholder line
 * until Block C lands so the rail still occupies its grid area.
 *
 * Why slots and not direct rendering: keeps Block A purely
 * presentational. Block C's "single source of truth" hook
 * (`useIterRunMeta`) lives one level up and feeds slot ReactNodes
 * down — no business logic in the rail.
 *
 * v0.5.0 — Block A.
 */

import type { ReactElement, ReactNode } from "react";

import type { FeedbackRead } from "../client";
import { IterContextPanel } from "./IterContextPanel";

export interface IterMetadataRailProps {
  /** Original feedback for the `IterContextPanel` inside the rail. */
  feedback: FeedbackRead | null | undefined;
  /** True the very first time a session is opened — keeps the
   * IterContextPanel open so the user sees the screenshot at least
   * once before it tucks away. */
  contextDefaultOpen: boolean;
  /** Auto-collapses the IterContextPanel on idle→running transitions
   * so the rail stays quiet during a stream. (Existing v0.4.5 prop.) */
  contextStreaming: boolean;
  /** Round indicator — current / max. Null when unknown (loading). */
  roundCurrent: number | null;
  roundMax: number | null;

  /** Block C slots — model state, elapsed timer, latency hint, and
   * the toast landing zone. Until Block C lands, all are undefined
   * and the rail renders compact placeholders. */
  modelBadgeSlot?: ReactNode;
  elapsedTimerSlot?: ReactNode;
  hintSlot?: ReactNode;
  toastLandingSlot?: ReactNode;
}

export function IterMetadataRail({
  feedback,
  contextDefaultOpen,
  contextStreaming,
  roundCurrent,
  roundMax,
  modelBadgeSlot,
  elapsedTimerSlot,
  hintSlot,
  toastLandingSlot,
}: IterMetadataRailProps): ReactElement {
  const showRoundBadge = roundCurrent !== null && roundMax !== null && roundMax > 0;
  return (
    <aside
      className="flex h-full min-h-0 flex-col gap-2 overflow-auto"
      aria-label="Metadatos de la iteración"
    >
      {/* Round indicator + active-model placeholder line. Compact strip
          at the top so the user always sees "what round, what model". */}
      <div className="rounded-md border border-input bg-card px-2 py-1.5 text-[0.7rem]">
        <div className="flex items-center gap-2">
          {showRoundBadge ? (
            <span
              className="rounded bg-muted px-1.5 py-0.5 font-mono uppercase tracking-wide text-muted-foreground"
              style={{ fontSize: "0.6rem" }}
            >
              Round {roundCurrent}/{roundMax}
            </span>
          ) : null}
          {modelBadgeSlot ?? (
            <span className="text-muted-foreground" style={{ fontSize: "0.65rem" }}>
              <span aria-hidden="true">⚡</span> modelo —
            </span>
          )}
          <span className="ml-auto" style={{ fontSize: "0.65rem" }}>
            {elapsedTimerSlot ?? null}
          </span>
        </div>
        {hintSlot ? (
          <div className="mt-1 text-muted-foreground" style={{ fontSize: "0.6rem" }}>
            {hintSlot}
          </div>
        ) : null}
      </div>

      {/* Toast landing zone — Block C portals the dismissed fallback
          card here so the swap leaves a visible trace next to the
          model badge. */}
      {toastLandingSlot ? <div>{toastLandingSlot}</div> : null}

      {/* Original-feedback collapsible. Lives in the rail so the main
          column gets full vertical real estate during streaming. */}
      <IterContextPanel
        feedback={feedback}
        defaultOpen={contextDefaultOpen}
        streaming={contextStreaming}
      />
    </aside>
  );
}
