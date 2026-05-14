/**
 * Counts feedback rows in DONE status (recently resolved) for the
 * current user. Drives the red badge on the floating launcher: gives
 * the user a cue that there is something to acknowledge in the
 * "Mías" feed.
 *
 * Lifted out of the legacy ``MyTicketsPanel`` shim during the
 * v1.0.0 chat-first cleanup (S7) — the panel component itself is
 * gone; only this hook survived.
 */

import { useMyFeedbackQuery } from "../adapter";

export function useMyPendingActionCount(): number {
  const query = useMyFeedbackQuery(25);
  return (query.data ?? []).filter((r) => r.status === "done").length;
}
