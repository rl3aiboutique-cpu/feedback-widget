/**
 * Feedback panel — the slide-in Sheet that owns the form state and the
 * submit pipeline.
 *
 * Submit flow:
 *
 *   1. Run client-side validation (type chosen, title + description
 *      non-empty). Expected outcome and attachments are optional.
 *   2. Capture the screenshot (page or selected element). Failure here
 *      is non-fatal — we toast and submit without the screenshot.
 *   3. Build the metadata bundle with the host adapter's user / version
 *      / git SHA, plus the buffered console + network + breadcrumbs.
 *   4. POST to the backend via adapter.submitFeedback (multipart with
 *      the screenshot + N user attachments). On 200 we toast the new
 *      ticket code + the deep link to the admin view. On 429 we toast
 *      a Retry-After countdown. On anything else we toast a generic
 *      error.
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
import { MyTicketsPanel } from "./MyTicketsPanel"
import { Rl3Mark } from "./Rl3Mark"
import type { FeedbackElementInfo, FeedbackReadShape } from "./types"

interface FeedbackPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locked: LockedElement | null
  onActivatePicker: () => void
  onClearLocked: () => void
  onScreenshotCaptured?: (shot: ScreenshotResult | null) => void
}

type CaptureMode = "page" | "element"

export function FeedbackPanel({
  open,
  onOpenChange,
  locked,
  onActivatePicker,
  onClearLocked,
}: FeedbackPanelProps): React.ReactElement {
  const adapter = useFeedbackAdapter()
  const t = adapter.useTranslation()

  const [values, setValues] = useState<FeedbackFormValues>(() => ({
    ...EMPTY_FORM,
  }))
  const [mode, setMode] = useState<CaptureMode>(locked ? "element" : "page")
  const [submitting, setSubmitting] = useState(false)
  const [hasOpenedOnce, setHasOpenedOnce] = useState(open)
  const [tab, setTab] = useState<"submit" | "mine">("submit")

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
      const id = setTimeout(() => {
        setValues({ ...EMPTY_FORM })
        setMode("page")
        setSubmitting(false)
      }, 200)
      return () => clearTimeout(id)
    }
    return undefined
  }, [open, hasOpenedOnce, locked])

  // When the parent reports a newly-locked element, switch the mode.
  useEffect(() => {
    if (locked) setMode("element")
  }, [locked])

  // Field-level validation errors. Cleared when the user touches the
  // field again or when submit succeeds.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) return
    const cleared: Record<string, string> = {}
    for (const [k, v] of Object.entries(fieldErrors)) {
      if (k === "title" && values.title.trim()) continue
      if (k === "description" && values.description.trim()) continue
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
      const reason = v.reason
      const fieldLabel = (() => {
        switch (reason) {
          case "type":
            return t("feedback.type_label")
          case "title":
            return t("feedback.field.title")
          case "description":
            return t("feedback.field.description")
          default:
            return reason
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
      const shotPromise = (async () => {
        await new Promise((resolve) => requestAnimationFrame(resolve))
        return captureScreenshot()
      })()

      const shot = await shotPromise

      const metadata = buildMetadataBundle({
        routeName:
          typeof window !== "undefined" ? window.location.pathname : null,
        appVersion: adapter.appVersion,
        gitSha: adapter.gitSha,
        user: null,
        selectedElement: locked?.info ?? null,
      })

      const payload = {
        type: values.type!,
        title: values.title.trim(),
        description: values.description,
        expected_outcome: values.expected_outcome.trim() || null,
        url_captured:
          typeof window !== "undefined"
            ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
            : "",
        route_name:
          typeof window !== "undefined" ? window.location.pathname : null,
        element: selectorInfo,
        metadata_bundle: metadata,
        app_version: adapter.appVersion,
        git_commit_sha: adapter.gitSha,
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent : null,
      }

      const payloadJson = JSON.stringify(payload)
      const payloadBytes = new Blob([payloadJson]).size
      const screenshotBytes = shot?.blob.size ?? 0
      const attachmentBytes = values.attachments.reduce(
        (sum, f) => sum + f.size,
        0,
      )
      console.info("[feedback] submit", {
        payloadBytes,
        screenshotBytes,
        attachmentBytes,
        attachmentCount: values.attachments.length,
        totalBytes: payloadBytes + screenshotBytes + attachmentBytes,
      })
      const created: FeedbackReadShape = await adapter.submitFeedback(
        payloadJson,
        shot?.blob ?? null,
        values.attachments,
      )
      const link = adapter.getDeepLinkToFeedback(created.id)
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

              <FeedbackForm
                values={values}
                onChange={setValues}
                errors={fieldErrors}
              />
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
