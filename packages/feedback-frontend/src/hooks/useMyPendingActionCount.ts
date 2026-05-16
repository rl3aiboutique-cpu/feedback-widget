/**
 * Counts tickets where the user has to take an action. Post-unification
 * (2026-05-16) this reads ``user_action_required`` directly from the
 * ticket row — the backend flips that flag when an admin injects a
 * message via /admin-action and clears it when the user replies. The
 * red badge on the floating launcher and the count chip on the
 * "My tickets" tab both render from this value, so admin pings reach
 * the user even when the sheet is closed.
 */

import { useMyFeedbackQuery } from "../adapter";

export function useMyPendingActionCount(): number {
  const query = useMyFeedbackQuery(25);
  return (query.data ?? []).filter((r) => r.user_action_required).length;
}

export function useMyTicketsTotalCount(): number {
  const query = useMyFeedbackQuery(25);
  return (query.data ?? []).length;
}
