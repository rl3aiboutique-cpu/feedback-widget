/**
 * Sandbox host bindings — wires SandboxAuth headers + the demo backend's
 * URL into the @rl3/feedback-widget contract.
 *
 * Hosts replicate this file for their real auth (sapphira / CRM).
 */

import type { CurrentUserSnapshot, FeedbackHostBindings } from "@rl3/feedback-widget"

export type SandboxRole = "admin" | "staff" | "manager"

const _ROLE_KEY = "feedback-sandbox-role"
const _UID_KEY = "feedback-sandbox-uid"

export function getSandboxRole(): SandboxRole {
  if (typeof window === "undefined") return "staff"
  const v = window.localStorage.getItem(_ROLE_KEY) as SandboxRole | null
  return v ?? "staff"
}

export function setSandboxRole(role: SandboxRole): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(_ROLE_KEY, role)
    if (!window.localStorage.getItem(_UID_KEY)) {
      window.localStorage.setItem(_UID_KEY, crypto.randomUUID())
    }
  }
}

function getSandboxUid(): string {
  if (typeof window === "undefined") return "11111111-1111-1111-1111-111111111111"
  let v = window.localStorage.getItem(_UID_KEY)
  if (!v) {
    v = crypto.randomUUID()
    window.localStorage.setItem(_UID_KEY, v)
  }
  return v
}

const _origFetch = typeof fetch !== "undefined" ? fetch : undefined
if (_origFetch && typeof window !== "undefined") {
  // Attach the sandbox auth headers to every request the widget issues.
  // Done globally to cover both fetch helpers in adapter.ts and any
  // future SDK calls.
  const wrapped: typeof fetch = (input, init) => {
    const role = getSandboxRole()
    const uid = getSandboxUid()
    const headers = new Headers(init?.headers)
    headers.set("X-Sandbox-User-Id", uid)
    headers.set("X-Sandbox-User-Role", role)
    return _origFetch(input, { ...init, headers })
  }
  window.fetch = wrapped
}

const useCurrentUser = (): CurrentUserSnapshot | null => {
  // The sandbox UI renders the role chip and lets the user toggle it
  // — for the widget's purposes we just hand over the same snapshot
  // the backend will resolve from the headers.
  const role = getSandboxRole()
  const uid = getSandboxUid()
  return {
    user_id: uid,
    email: `${role}@sandbox.local`,
    tenant_id: null,
    role,
    full_name: role.charAt(0).toUpperCase() + role.slice(1),
  }
}

export const sandboxBindings: FeedbackHostBindings = {
  useCurrentUser,
  getCsrfToken: async () => "",
  apiBaseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:9000",
  apiPathPrefix: "/api/v1/feedback",
  getDeepLinkBase: () =>
    typeof window !== "undefined" ? window.location.origin : "http://localhost:9001",
}
