/**
 * Returns true if the currently signed-in user is permitted to triage
 * feedback (list inbox, transition status, download bundle, delete).
 *
 * The role set is configured per-host via `bindings.triageRoles` (e.g.
 * `["admin", "manager"]` for sapphira, sourced from VITE_FEEDBACK_TRIAGE_ROLES).
 * When unset, it falls back to the legacy "MASTER_ADMIN" check.
 *
 * Use this in your admin route component instead of hand-coding the
 * role comparison so a future role rename in the host doesn't require
 * a frontend code change — only a binding/env update.
 */
import { useFeedbackAdapter, useFeedbackBindings } from "../FeedbackProvider";

export function useCanTriageFeedback(): boolean {
  const adapter = useFeedbackAdapter();
  const bindings = useFeedbackBindings();
  const user = adapter.useCurrentUser();
  if (!user) return false;
  const allowed = (
    bindings.triageRoles && bindings.triageRoles.length > 0
      ? bindings.triageRoles
      : ["MASTER_ADMIN"]
  ).map((r) => r.toUpperCase());
  return allowed.includes(user.role.toUpperCase());
}
