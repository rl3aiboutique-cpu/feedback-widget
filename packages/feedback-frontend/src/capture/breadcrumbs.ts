/**
 * Breadcrumbs: a ring buffer of the last 30 user actions before
 * submission. Drives the "what did the user do leading up to the bug?"
 * panel in the email.
 *
 * Sources:
 *   * Route changes — fired by listeners attached in `installBreadcrumbs`.
 *   * Click events on elements with `data-feedback-id`.
 *   * Form submissions — record the form's id/name.
 *
 * We deliberately ignore mousemoves and generic clicks. The
 * `data-feedback-id` attribute is opt-in: the host marks the controls
 * worth tracking. The default list ships in the existing layout +
 * sidebar.
 */

import { redactString } from "../redactors"

export type BreadcrumbKind = "route" | "click" | "submit"

export interface Breadcrumb {
  kind: BreadcrumbKind
  message: string
  timestamp: string
}

const DEFAULT_CAPACITY = 30
const _buffer: Breadcrumb[] = []
let _capacity = DEFAULT_CAPACITY
let _installed = false
let _detach: (() => void) | null = null

function _push(crumb: Breadcrumb): void {
  _buffer.push(crumb)
  while (_buffer.length > _capacity) _buffer.shift()
}

export function recordRoute(path: string): void {
  _push({
    kind: "route",
    message: redactString(path),
    timestamp: new Date().toISOString(),
  })
}

export function installBreadcrumbs(capacity: number = DEFAULT_CAPACITY): void {
  if (_installed || typeof window === "undefined") return
  _capacity = capacity
  _installed = true

  const onClick = (e: MouseEvent) => {
    const target = e.target
    if (!(target instanceof Element)) return
    const tagged = target.closest("[data-feedback-id]")
    if (!tagged) return
    const id = (tagged as HTMLElement).dataset.feedbackId ?? ""
    _push({
      kind: "click",
      message: redactString(id),
      timestamp: new Date().toISOString(),
    })
  }

  const onSubmit = (e: SubmitEvent) => {
    const form = e.target
    if (!(form instanceof HTMLFormElement)) return
    const ident =
      form.id ||
      form.getAttribute("name") ||
      form.getAttribute("action") ||
      "<form>"
    _push({
      kind: "submit",
      message: redactString(`form ${ident}`),
      timestamp: new Date().toISOString(),
    })
  }

  // Initial route capture so the first submission carries something.
  recordRoute(
    window.location.pathname + window.location.search + window.location.hash,
  )

  window.addEventListener("click", onClick, true)
  window.addEventListener("submit", onSubmit, true)

  // popstate covers back/forward navigation. TanStack Router pushes
  // history without firing popstate, so route consumers should call
  // `recordRoute(...)` from a router subscription where appropriate.
  const onPop = () => {
    recordRoute(
      window.location.pathname + window.location.search + window.location.hash,
    )
  }
  window.addEventListener("popstate", onPop)

  _detach = () => {
    window.removeEventListener("click", onClick, true)
    window.removeEventListener("submit", onSubmit, true)
    window.removeEventListener("popstate", onPop)
  }
}

export function getBreadcrumbs(): Breadcrumb[] {
  return [..._buffer]
}

export function _clearForTests(): void {
  _detach?.()
  _detach = null
  _buffer.length = 0
  _installed = false
}
