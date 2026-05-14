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

import { Suspense, lazy, useCallback, useState } from "react";
import { ElementSelector } from "./ElementSelector";
import { useFeedbackAdapter, useFeedbackConfig } from "./FeedbackProvider";
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
  const t = adapter.useTranslation();

  const [open, setOpen] = useState(false);
  const [pickerActive, setPickerActive] = useState(false);
  const [locked, setLocked] = useState<LockedElement | null>(null);

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

  const cornerClass = POSITION_CLASSES[config.position] ?? POSITION_CLASSES.bottom_right;
  const accentStyle = config.brandPrimaryHex
    ? ({ "--feedback-brand": config.brandPrimaryHex } as React.CSSProperties)
    : undefined;

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
        <span className="text-sm font-semibold">{t("feedback.button_label")}</span>
      </button>

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
