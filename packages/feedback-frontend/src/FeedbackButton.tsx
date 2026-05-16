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

import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { ElementSelector } from "./ElementSelector";
import {
  useFeedbackAdapter,
  useFeedbackBindings,
  useFeedbackConfig,
} from "./FeedbackProvider";
import { Rl3Mark } from "./Rl3Mark";
import type { SelectedElementInfo } from "./capture/metadata";
import { describeElement } from "./capture/screenshot";
import { useMyPendingActionCount } from "./hooks/useMyPendingActionCount";

const FeedbackChatSheetLazy = lazy(() =>
  import("./chat/FeedbackChatSheet").then((m) => ({ default: m.FeedbackChatSheet })),
);

// v1.0.0 — the chat sheet is the only submitter surface. The legacy
// `FeedbackPanel` / `Compose` / `Canvas` files were removed in S7.

const POSITION_CLASSES: Record<string, string> = {
  bottom_right: "bottom-24 right-6",
  bottom_left: "bottom-24 left-6",
  top_right: "top-6 right-6",
  top_left: "top-6 left-6",
};

export interface LockedElement {
  el: HTMLElement;
  info: SelectedElementInfo;
}

export function FeedbackButton(): React.ReactElement | null {
  const config = useFeedbackConfig();
  const adapter = useFeedbackAdapter();
  const bindings = useFeedbackBindings();
  const t = adapter.useTranslation();

  const [open, setOpen] = useState(false);
  const [pickerActive, setPickerActive] = useState(false);
  const [locked, setLocked] = useState<LockedElement | null>(null);

  // Host-side visibility cascade (tenant default → admin override →
  // self opt-out lives in the host's bindings.isEnabled()). When the
  // callback resolves false, the FAB stays hidden even for signed-in
  // users — replaces the old "useCurrentUser returns null" workaround.
  // Optimistic true so the FAB does not pop in late on the slow path.
  const [hostEnabled, setHostEnabled] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const cb = bindings.isEnabled;
    if (!cb) {
      setHostEnabled(true);
      return;
    }
    Promise.resolve(cb()).then((v) => {
      if (!cancelled) setHostEnabled(v !== false);
    });
    return () => {
      cancelled = true;
    };
  }, [bindings]);

  const handlePickerLock = useCallback((el: HTMLElement) => {
    setLocked({ el, info: describeElement(el) });
    setPickerActive(false);
    setOpen(true);
  }, []);

  const handlePickerCancel = useCallback(() => {
    setPickerActive(false);
    setOpen(true);
  }, []);

  const handleActivatePicker = useCallback(() => {
    setPickerActive(true);
    setOpen(false);
  }, []);

  const handleClearLocked = useCallback(() => {
    setLocked(null);
  }, []);

  // Pending tickets — DONE rows in the user's "mine" list. Drives
  // the notification dot on the floating button.
  const pendingCount = useMyPendingActionCount();

  if (!config.enabled) return null;
  if (!hostEnabled) return null;

  const cornerClass = POSITION_CLASSES[config.position] ?? POSITION_CLASSES.bottom_right;
  const accentStyle = config.brandPrimaryHex
    ? ({ "--feedback-brand": config.brandPrimaryHex } as React.CSSProperties)
    : undefined;

  // Hide the floating launcher whenever the sheet is open (post-baseline
  // audit 2026-05-15) — otherwise it overlaps the lower-right of the
  // Sheet content and clutters the UX.
  const sheetActuallyOpen = open && !pickerActive;
  const launcherHidden = sheetActuallyOpen;

  return (
    <div
      data-feedback-widget-root="true"
      className="rl3-feedback-scope dark"
    >
      {launcherHidden ? null : (
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
          className={[
            "group fixed z-[2147483640]",
            "inline-flex items-center justify-center",
            "h-12 w-12 rounded-full",
            "bg-background/80 backdrop-blur-md",
            "shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6),0_2px_4px_rgba(0,0,0,0.25)]",
            "transition-all duration-200 ease-out",
            "hover:shadow-[0_12px_32px_-6px_hsl(var(--primary)/0.5),0_4px_12px_rgba(0,0,0,0.4)]",
            "hover:-translate-y-0.5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            cornerClass,
          ].join(" ")}
          style={accentStyle}
        >
          {/* Animated RL3 mark: gentle hover rotation + pulsing ring
              when something is pending. No wordmark — the mark itself
              carries the brand. */}
          <span className="relative inline-flex items-center justify-center">
            <Rl3Mark className="h-9 w-9 shrink-0 transition-transform duration-500 ease-out group-hover:rotate-6 group-hover:scale-105" />
            {pendingCount > 0 ? (
              <>
                {/* Soft glow halo (no outline ring) when something is
                    pending — pulses opacity, not the border. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -m-1 rounded-full bg-primary/30 blur-md animate-pulse"
                />
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
                >
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              </>
            ) : null}
          </span>
        </button>
      )}

      {/* v1.0.0 (S3F shell-hybrid) — the chat sheet is the only path.
          The sheet stays mounted while `pickerActive` is true so the
          in-flight chat session and locked-element state survive the
          element-picker round-trip; visibility is driven by the
          `open` prop. */}
      {open || pickerActive ? (
        <Suspense fallback={null}>
          <FeedbackChatSheetLazy
            open={open && !pickerActive}
            onOpenChange={setOpen}
            locked={locked?.info ?? null}
            onActivatePicker={handleActivatePicker}
            onClearLocked={handleClearLocked}
          />
        </Suspense>
      ) : null}

      {pickerActive ? (
        <ElementSelector onLock={handlePickerLock} onCancel={handlePickerCancel} />
      ) : null}
    </div>
  );
}

export default FeedbackButton;
