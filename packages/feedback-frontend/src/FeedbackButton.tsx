/**
 * Floating RL3 Feedback launcher.
 *
 * Owns the cross-cutting state for the picker round-trip:
 *
 *   - ``open``         — Sheet visibility
 *   - ``pickerActive`` — element-selector overlay active
 *   - ``locked``       — element the picker locked, or null
 *
 * The Sheet panel closes (visually) while the picker is on, but the
 * panel component stays mounted as long as ``open || pickerActive``
 * — that way the user's half-filled form survives the picker round-
 * trip. When the picker locks an element or cancels, the Sheet
 * re-opens with the form state intact.
 *
 * Visual identity: RL3 mark + "Feedback" label so users know what
 * tool is open. Position is configurable via the FeedbackProvider
 * (env var fallback VITE_FEEDBACK_POSITION).
 *
 * Screenshot exclusion: every UI surface this file owns is wrapped
 * in ``data-feedback-widget-root="true"`` so the capture pipeline
 * filters them out before snapshotting the page.
 */

import { lazy, Suspense, useCallback, useEffect, useState } from "react"
import type { SelectedElementInfo } from "./capture/metadata"
import { describeElement, type ScreenshotResult } from "./capture/screenshot"
import { ElementSelector } from "./ElementSelector"
import { useFeedbackAdapter, useFeedbackConfig } from "./FeedbackProvider"
import { useMyPendingActionCount } from "./MyTicketsPanel"
import { Rl3Mark } from "./Rl3Mark"

const FeedbackPanelLazy = lazy(() => import("./FeedbackPanel"))

const POSITION_CLASSES: Record<string, string> = {
  bottom_right: "bottom-24 right-6",
  bottom_left: "bottom-24 left-6",
  top_right: "top-6 right-6",
  top_left: "top-6 left-6",
}

export interface LockedElement {
  el: HTMLElement
  info: SelectedElementInfo
}

export function FeedbackButton(): React.ReactElement | null {
  const config = useFeedbackConfig()
  const adapter = useFeedbackAdapter()
  const t = adapter.useTranslation()

  const [open, setOpen] = useState(false)
  const [pickerActive, setPickerActive] = useState(false)
  const [locked, setLocked] = useState<LockedElement | null>(null)
  // ``initialParentTicket`` is set when the page is loaded with a
  // ``?parent=FB-…`` query param — typically after the user clicked
  // "Submit a follow-up" on the public reject landing page. Cleared
  // after the panel reads it so closing+reopening doesn't re-prefill.
  const [initialParentTicket, setInitialParentTicket] = useState<string | null>(
    null,
  )

  const handlePickerLock = useCallback((el: HTMLElement) => {
    setLocked({ el, info: describeElement(el) })
    setPickerActive(false)
    // Re-open the panel so the user can finish the form.
    setOpen(true)
  }, [])

  const handlePickerCancel = useCallback(() => {
    setPickerActive(false)
    // Re-open the panel even on cancel — the user may have already
    // filled half the form before deciding the element wasn't worth
    // pinning.
    setOpen(true)
  }, [])

  const handleActivatePicker = useCallback(() => {
    setPickerActive(true)
    // Hide the Sheet visually so the user can interact with the page;
    // the panel stays MOUNTED because pickerActive=true keeps the
    // suspense boundary alive — the user's form state is preserved.
    setOpen(false)
  }, [])

  const handleClearLocked = useCallback(() => {
    setLocked(null)
  }, [])

  // On mount, look for ?parent=FB-YYYY-NNNN in the URL. When found,
  // open the panel pre-filled with the parent ticket. This is the
  // bridge from the public reject-landing page back into the app.
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const parent = params.get("parent")
    if (!parent || !/^FB-\d{4}-\d{4}$/.test(parent)) return
    setInitialParentTicket(parent)
    setOpen(true)
    // Strip the query param from the URL so a refresh / share doesn't
    // re-trigger the prefill. ``replaceState`` keeps the user where
    // they are without a navigation.
    params.delete("parent")
    const cleanQuery = params.toString()
    const cleanUrl =
      window.location.pathname + (cleanQuery ? `?${cleanQuery}` : "")
    window.history.replaceState(null, "", cleanUrl + window.location.hash)
  }, [])

  // Number of "DONE — please confirm" tickets the user owns. Drives
  // the notification dot on the floating button.
  const pendingCount = useMyPendingActionCount()

  if (!config.enabled) return null

  const cornerClass =
    POSITION_CLASSES[config.position] ?? POSITION_CLASSES.bottom_right
  const accentStyle = config.brandPrimaryHex
    ? ({ "--feedback-brand": config.brandPrimaryHex } as React.CSSProperties)
    : undefined

  return (
    <div data-feedback-widget-root="true">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("feedback.open_button")}
        title={
          pendingCount > 0
            ? t("feedback.open_button_with_pending", {
                count: String(pendingCount),
              })
            : t("feedback.open_button")
        }
        data-feedback-id="feedback.open_button"
        className={`fixed z-[2147483640] flex items-center gap-2 rounded-full pl-2 pr-4 py-1.5 shadow-lg
                    bg-background border border-input text-foreground hover:bg-accent
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                    focus-visible:ring-offset-2 transition-all hover:scale-[1.02] hover:shadow-xl
                    ${cornerClass}`}
        style={accentStyle}
      >
        <span className="relative">
          <Rl3Mark className="h-7 w-7 shrink-0" />
          {pendingCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-2 ring-background"
            >
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          ) : null}
        </span>
        <span className="text-sm font-semibold">
          {t("feedback.button_label")}
        </span>
      </button>

      {/* Keep the panel mounted as long as either flag is true.
          That preserves form state across the picker round-trip. */}
      {open || pickerActive ? (
        <Suspense fallback={null}>
          <FeedbackPanelLazy
            open={open && !pickerActive}
            onOpenChange={(v) => {
              setOpen(v)
              if (!v) setInitialParentTicket(null)
            }}
            locked={locked}
            onActivatePicker={handleActivatePicker}
            onClearLocked={handleClearLocked}
            initialParentTicket={initialParentTicket}
            onScreenshotCaptured={(_: ScreenshotResult | null) => {
              /* future v2 hook — annotation overlay would go here */
            }}
          />
        </Suspense>
      ) : null}

      {pickerActive ? (
        <ElementSelector
          onLock={handlePickerLock}
          onCancel={handlePickerCancel}
        />
      ) : null}
    </div>
  )
}

export default FeedbackButton
