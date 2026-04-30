/**
 * Feedback panel — the slide-in Sheet that owns the form state and the
 * submit pipeline.
 *
 * Submit flow:
 *
 *   1. Run client-side validation (type chosen, required common fields,
 *      type-specific required fields per ./forms/types.ts, persona +
 *      linked stories for the three mapping types).
 *   2. Capture the screenshot (page or selected element). Failure here
 *      is non-fatal — we toast and submit without the screenshot.
 *   3. Build the metadata bundle with the host adapter's user / version
 *      / git SHA, plus the buffered console + network + breadcrumbs.
 *   4. POST to the backend via adapter.submitFeedback. On 200 we toast
 *      the new feedback id + the deep link to the admin view. On 429
 *      we toast a Retry-After countdown. On anything else we toast a
 *      generic error.
 */

import { useEffect, useMemo, useState } from "react"

import { Button } from "./ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet"
import { SubmitFeedbackError } from "./adapter"
import { buildMetadataBundle } from "./capture/metadata"
import {
  captureElementScreenshot,
  capturePageScreenshot,
  type ScreenshotResult,
} from "./capture/screenshot"
import type { LockedElement } from "./FeedbackButton"
import { useFeedbackAdapter } from "./FeedbackProvider"
import {
  EMPTY_FORM,
  FeedbackForm,
  type FeedbackFormValues,
} from "./forms/FeedbackForm"
import { getTypeDef } from "./forms/types"
import { MyTicketsPanel } from "./MyTicketsPanel"
import { Rl3Mark } from "./Rl3Mark"
import type { FeedbackElementInfo, FeedbackReadShape } from "./types"

interface FeedbackPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locked: LockedElement | null
  onActivatePicker: () => void
  onClearLocked: () => void
  /** Optional FB-YYYY-NNNN to pre-fill the parent ticket field with —
   * set by the parent when the page was loaded with a ``?parent=…``
   * query param (typically from the public reject landing page). */
  initialParentTicket?: string | null
  onScreenshotCaptured?: (shot: ScreenshotResult | null) => void
}

type CaptureMode = "page" | "element"

export function FeedbackPanel({
  open,
  onOpenChange,
  locked,
  onActivatePicker,
  onClearLocked,
  initialParentTicket,
}: FeedbackPanelProps): React.ReactElement {
  const adapter = useFeedbackAdapter()
  const t = adapter.useTranslation()
  const user = adapter.useCurrentUser()

  // Pre-fill follow_up_email with the authenticated user's email so the
  // happy path is "click submit" — they can override before submitting.
  // initialParentTicket comes from the host (e.g. ``?parent=FB-…`` on
  // the URL after the public reject landing page).
  const [values, setValues] = useState<FeedbackFormValues>(() => ({
    ...EMPTY_FORM,
    follow_up_email: user?.email ?? "",
    parent_ticket_code: initialParentTicket ?? "",
  }))
  // ``mode`` is derived from ``locked`` on the first render of every
  // panel session; user can flip it back to "page" to ignore the
  // locked element. We DO NOT reset values here on close — we only
  // reset when the user explicitly closes via the Cancel button or
  // ESC, signalled by the panel being closed AND no picker pending.
  const [mode, setMode] = useState<CaptureMode>(locked ? "element" : "page")
  const [submitting, setSubmitting] = useState(false)
  const [hasOpenedOnce, setHasOpenedOnce] = useState(open)
  // The panel has two tabs: "submit" (the form) and "mine" (the user's
  // own recent tickets, for status checking). Default lands on submit.
  const [tab, setTab] = useState<"submit" | "mine">("submit")

  // Track whether the panel has ever been opened in this mount cycle.
  useEffect(() => {
    if (open) setHasOpenedOnce(true)
  }, [open])

  // When a fresh panel session begins (panel was closed, now opened
  // and no element is locked), reset the form. This gives "fresh form
  // every time you click the floating button" while preserving state
  // across the picker round-trip (because during the picker, locked
  // is still set and the panel is hidden, not unmounted).
  useEffect(() => {
    if (!open && hasOpenedOnce && !locked) {
      // Defer reset to the next tick so the close animation finishes
      // with the user's data still visible.
      const id = setTimeout(() => {
        setValues({ ...EMPTY_FORM, follow_up_email: user?.email ?? "" })
        setMode("page")
        setSubmitting(false)
      }, 200)
      return () => clearTimeout(id)
    }
    return undefined
  }, [open, hasOpenedOnce, locked, user?.email])

  // When the parent reports a newly-locked element, switch the mode.
  useEffect(() => {
    if (locked) setMode("element")
  }, [locked])

  // useCurrentUser typically returns null on first render (query still
  // loading) and resolves a tick later. The useState initializer above
  // captures the null and never re-runs, so the follow_up_email field
  // ships empty even though the user is logged in. Patch the field once
  // the email arrives — only if the user hasn't typed anything in it.
  useEffect(() => {
    if (user?.email && !values.follow_up_email) {
      setValues((cur) => ({ ...cur, follow_up_email: user.email ?? "" }))
    }
  }, [user?.email, values.follow_up_email])

  // Field-level validation errors. Keys correspond to the `reason` strings
  // returned by validate() (e.g. "title", "severity", "persona"). Cleared
  // when the user touches the field again or when submit succeeds.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // When the user edits any field, clear errors for that field so the
  // red marker disappears as soon as they fix it.
  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) return
    const cleared: Record<string, string> = {}
    for (const [k, v] of Object.entries(fieldErrors)) {
      // Heuristic: clear if the corresponding field is now non-empty.
      // For type_fields we check if the key exists in values.type_fields.
      if (k === "title" && values.title.trim()) continue
      if (k === "description" && values.description.trim()) continue
      if (k === "persona" && values.persona.trim()) continue
      if (k === "follow_up_email" && values.follow_up_email.trim()) continue
      if (k === "parent_ticket_code" && values.parent_ticket_code.trim()) continue
      if (k === "consent_metadata_capture" && values.consent_metadata_capture) continue
      if (k === "linked_user_stories" && values.linked_user_stories.length > 0) continue
      // For type_fields, check if the key has been filled.
      const tf = values.type_fields[k]
      if (tf !== undefined && tf !== null && tf !== "") continue
      cleared[k] = v
    }
    if (Object.keys(cleared).length !== Object.keys(fieldErrors).length) {
      setFieldErrors(cleared)
    }
  }, [values, fieldErrors])

  const selectorInfo: FeedbackElementInfo | null = useMemo(() => {
    if (!locked) return null
    return {
      selector: locked.info.selector,
      xpath: locked.info.xpath,
      bounding_box: {
        x: locked.info.bounding_box.x,
        y: locked.info.bounding_box.y,
        w: locked.info.bounding_box.w,
        h: locked.info.bounding_box.h,
      },
    }
  }, [locked])

  const validate = (): { ok: true } | { ok: false; reason: string } => {
    if (!values.type) {
      return { ok: false, reason: "type" }
    }
    if (!values.title.trim()) {
      return { ok: false, reason: "title" }
    }
    if (!values.description.trim()) {
      return { ok: false, reason: "description" }
    }
    const def = getTypeDef(values.type)
    for (const f of def.fields) {
      if (f.required === false) continue
      const v = values.type_fields[f.name]
      if (v === undefined || v === null || v === "") {
        return { ok: false, reason: f.name }
      }
    }
    if (def.requiresPersona && !values.persona.trim()) {
      return { ok: false, reason: "persona" }
    }
    if (def.requiresLinkedStories && values.linked_user_stories.length === 0) {
      return { ok: false, reason: "linked_user_stories" }
    }
    // follow_up_email is optional, but if filled must look like an email.
    const fue = values.follow_up_email.trim()
    if (fue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fue)) {
      return { ok: false, reason: "follow_up_email" }
    }
    // parent_ticket_code is optional, but if filled must match FB-YYYY-NNNN.
    const ptc = values.parent_ticket_code.trim()
    if (ptc && !/^FB-\d{4}-\d{4}$/.test(ptc)) {
      return { ok: false, reason: "parent_ticket_code" }
    }
    if (!values.consent_metadata_capture) {
      return { ok: false, reason: "consent" }
    }
    return { ok: true }
  }

  const captureScreenshot = async (): Promise<ScreenshotResult | null> => {
    const opts = {
      redactionSelectors: adapter.getDefaultRedactionSelectors(),
    }
    try {
      if (mode === "element" && locked?.el) {
        return await captureElementScreenshot(locked.el, opts)
      }
      return await capturePageScreenshot(opts)
    } catch {
      adapter.toast.error(t("feedback.toast_screenshot_failed"))
      return null
    }
  }

  const onSubmit = async (): Promise<void> => {
    const v = validate()
    if (!v.ok) {
      // Build a per-field error map keyed by the `reason` validate()
      // returned, plus a friendly message naming the offending field.
      const reason = v.reason
      const fieldLabel = (() => {
        switch (reason) {
          case "type":
            return t("feedback.type_label")
          case "title":
            return t("feedback.field.title")
          case "description":
            return t("feedback.field.description")
          case "persona":
            return t("feedback.persona.label")
          case "linked_user_stories":
            return t("feedback.stories.label")
          case "follow_up_email":
            return t("feedback.field.follow_up_email")
          case "parent_ticket_code":
            return t("feedback.field.parent_ticket")
          case "consent_metadata_capture":
            return t("feedback.field.consent_metadata")
          default: {
            // Type-specific field (e.g. "severity", "actual_behavior")
            const def = values.type ? getTypeDef(values.type) : null
            const f = def?.fields.find((x) => x.name === reason)
            return f ? t(f.labelKey) : reason
          }
        }
      })()
      const message = t("feedback.toast_error_required_field", {
        field: fieldLabel,
      })
      setFieldErrors({ [reason]: message })
      adapter.toast.error(message)
      return
    }
    setFieldErrors({})
    setSubmitting(true)
    try {
      // Hide the panel for a moment so the screenshot doesn't catch it.
      // We toggle `open` rather than unmounting — the form state stays put.
      const shotPromise = (async () => {
        // The Sheet's open state is controlled — flip it briefly. We
        // also rely on the data-feedback-widget-root filter as a
        // belt-and-suspenders against the panel sneaking in.
        const wasOpen = true
        if (wasOpen) {
          // requestAnimationFrame waits for the panel to repaint before capturing.
          await new Promise((resolve) => requestAnimationFrame(resolve))
        }
        return captureScreenshot()
      })()

      const shot = await shotPromise

      const metadata = buildMetadataBundle({
        routeName:
          typeof window !== "undefined" ? window.location.pathname : null,
        appVersion: adapter.appVersion,
        gitSha: adapter.gitSha,
        user,
        selectedElement: locked?.info ?? null,
      })

      const payload = {
        type: values.type!,
        title: values.title.trim(),
        description: values.description,
        url_captured:
          typeof window !== "undefined"
            ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
            : "",
        route_name:
          typeof window !== "undefined" ? window.location.pathname : null,
        element: selectorInfo,
        type_fields: values.type_fields,
        persona: values.persona || null,
        linked_user_stories: values.linked_user_stories,
        metadata_bundle: metadata,
        consent_metadata_capture: values.consent_metadata_capture,
        app_version: adapter.appVersion,
        git_commit_sha: adapter.gitSha,
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
        follow_up_email: values.follow_up_email.trim() || null,
        parent_ticket_code: values.parent_ticket_code.trim() || null,
      }

      const payloadJson = JSON.stringify(payload)
      // Log wire-size before submit. Invisible to users, invaluable in
      // diagnosing prod issues like "submit fails for me but not for
      // others" — usually a metadata_bundle or screenshot blowup.
      const payloadBytes = new Blob([payloadJson]).size
      const screenshotBytes = shot?.blob.size ?? 0
      console.info("[feedback] submit", {
        payloadBytes,
        screenshotBytes,
        totalBytes: payloadBytes + screenshotBytes,
      })
      const created: FeedbackReadShape = await adapter.submitFeedback(
        payloadJson,
        shot?.blob ?? null,
      )
      const link = adapter.getDeepLinkToFeedback(created.id)
      // Prefer the human-readable ticket_code in the success toast; the
      // raw UUID is meaningless to the submitter.
      const ticketLabel = created.ticket_code || created.id.slice(0, 8)
      adapter.toast.success(
        t("feedback.toast_success", { id: ticketLabel }),
        {
          url: link,
          actionLabel: t("feedback.toast_success_link"),
        },
      )
      onOpenChange(false)
    } catch (err) {
      if (err instanceof SubmitFeedbackError && err.status === 429) {
        const seconds = err.retryAfter ?? "?"
        adapter.toast.error(
          t("feedback.toast_error_429", { seconds: String(seconds) }),
        )
      } else {
        adapter.toast.error(t("feedback.toast_error_generic"))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto"
        data-feedback-widget-root="true"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Rl3Mark className="h-6 w-6 shrink-0" />
            <span>{t("feedback.panel_title")}</span>
          </SheetTitle>
          <SheetDescription>{t("feedback.panel_description")}</SheetDescription>
        </SheetHeader>

        <div className="px-4 mt-4 space-y-4">
          {/* Tab switcher */}
          <div
            className="grid grid-cols-2 gap-1 p-1 rounded-md bg-muted text-xs font-medium"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "submit"}
              onClick={() => setTab("submit")}
              className={`px-3 py-1.5 rounded transition-colors ${
                tab === "submit"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-feedback-id="feedback.tab.submit"
            >
              {t("feedback.tab.submit")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "mine"}
              onClick={() => setTab("mine")}
              className={`px-3 py-1.5 rounded transition-colors ${
                tab === "mine"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-feedback-id="feedback.tab.mine"
            >
              {t("feedback.tab.mine")}
            </button>
          </div>

          {tab === "mine" ? <MyTicketsPanel /> : null}

          {tab === "submit" ? (
            <>
              {/* Capture mode selector */}
              <div className="rounded-md border border-input p-3 space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("feedback.mode_label")}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={mode === "page" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setMode("page")
                      onClearLocked()
                    }}
                    data-feedback-id="feedback.mode_whole_page"
                  >
                    {t("feedback.mode_whole_page")}
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "element" ? "default" : "outline"}
                    size="sm"
                    onClick={onActivatePicker}
                    data-feedback-id="feedback.mode_select_element"
                  >
                    {t("feedback.mode_select_element")}
                  </Button>
                </div>
                {mode === "element" && locked ? (
                  <div className="flex items-center justify-between rounded-md bg-primary/10 px-2 py-1 text-xs">
                    <span className="font-mono truncate">
                      {locked.info.selector}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClearLocked()
                        setMode("page")
                      }}
                      className="text-primary underline-offset-4 hover:underline ml-2"
                      data-feedback-id="feedback.clear_element"
                    >
                      {t("feedback.clear_element")}
                    </button>
                  </div>
                ) : null}
              </div>

              <FeedbackForm values={values} onChange={setValues} errors={fieldErrors} />

              <details className="rounded-md border border-input p-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-foreground">
                  {t("feedback.metadata.title")}
                </summary>
                <p className="mt-2">{t("feedback.metadata.summary")}</p>
              </details>
            </>
          ) : null}

          <a
            href="https://rl3.dev"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("feedback.powered_by_aria")}
          >
            <Rl3Mark className="h-3.5 w-3.5" />
            <span>
              {t("feedback.powered_by")}{" "}
              <strong className="font-semibold">RL3</strong>
            </span>
          </a>
        </div>

        <SheetFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            data-feedback-id="feedback.cancel"
          >
            {t("feedback.cancel")}
          </Button>
          {tab === "submit" ? (
            <Button
              type="button"
              onClick={onSubmit}
              disabled={submitting || !values.type}
              data-feedback-id="feedback.submit"
            >
              {submitting ? t("feedback.submitting") : t("feedback.submit")}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default FeedbackPanel
