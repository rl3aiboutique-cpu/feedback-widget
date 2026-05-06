/**
 * v0.4.0 shim — the legacy ``MyTicketsPanel`` component lived here
 * but its responsibilities moved into ``Canvas`` (single-surface
 * card feed) and ``InlineIterPane`` (inline iter inside expanded
 * cards). This file now exports only the small hook that the
 * floating ``FeedbackButton`` uses for its pending-action badge,
 * so the existing import path stays stable.
 */

import { useMyFeedbackQuery } from "./adapter";

/**
 * Number of feedback rows in DONE status (recently resolved).
 * Drives the red dot on the floating launcher: gives the user a
 * cue that there's something to acknowledge in the canvas.
 */
export function useMyPendingActionCount(): number {
  const query = useMyFeedbackQuery(25);
  return (query.data ?? []).filter((r) => r.status === "done").length;
}
