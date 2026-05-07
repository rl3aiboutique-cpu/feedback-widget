/**
 * Feedback panel — Sheet shell that hosts the single-canvas v0.4.0 UX.
 *
 * Pre-v0.4.0 this file owned the form state, validation, screenshot
 * capture, submit pipeline, and the Submit/Mine tab switcher. All of
 * that moved into the Canvas (and its sub-component Compose) so this
 * shell is intentionally thin: it just wires the Sheet header /
 * footer / branding strip and forwards the picker callbacks.
 *
 * v0.4.1 adds an animated width swap: when the Canvas reports it has
 * entered focus mode, the Sheet expands from ~520px to ~800px on lg+
 * so the spec markdown has room to breathe. Reverts when focus exits.
 */

import { type ReactElement, useState } from "react";

import { Canvas } from "./Canvas";
import type { LockedElement } from "./FeedbackButton";
import { useFeedbackAdapter } from "./FeedbackProvider";
import { Rl3Mark } from "./Rl3Mark";
import { VersionPill } from "./VersionPill";
import type { ScreenshotResult } from "./capture/screenshot";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

interface FeedbackPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locked: LockedElement | null;
  onActivatePicker: () => void;
  onClearLocked: () => void;
  onScreenshotCaptured?: (shot: ScreenshotResult | null) => void;
}

// v0.4.4 — focus mode takes over the viewport entirely. The element
// picker only matters when SUBMITTING new feedback (compose tab),
// which happens before the user is ever in focus mode. So during
// iter we can safely cover the host. The Sheet's overlay + esc-to-
// close still works; "← Volver" in the focus header is the
// single-button-back-to-feed path. Mobile (< sm) was already full;
// no change needed there.
const _FEED_WIDTH = "w-full sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-[560px]";
const _FOCUS_WIDTH = "w-full sm:w-screen sm:max-w-none";

export function FeedbackPanel({
  open,
  onOpenChange,
  locked,
  onActivatePicker,
  onClearLocked,
}: FeedbackPanelProps): ReactElement {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const [isFocused, setIsFocused] = useState(false);

  const widthClass = isFocused ? _FOCUS_WIDTH : _FEED_WIDTH;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // Width follows focus state — full viewport during iter,
        // narrow drawer when browsing the feed. `transition-all`
        // keeps the swap smooth between the two modes.
        className={`${widthClass} overflow-y-auto transition-all duration-200`}
        data-feedback-widget-root="true"
      >
        {/* Header is hidden during focus mode — the focus view has
            its own header (← Volver / ticket / round counter) and a
            duplicate "RL3 Feedback" title above just wastes vertical
            space. */}
        {!isFocused ? (
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Rl3Mark className="h-6 w-6 shrink-0" />
              <span>{t("feedback.panel_title")}</span>
            </SheetTitle>
            <SheetDescription>{t("feedback.panel_description")}</SheetDescription>
          </SheetHeader>
        ) : null}

        <div className={`flex-1 min-h-0 ${isFocused ? "p-3 sm:p-4" : "px-4 mt-4"}`}>
          <Canvas
            locked={locked}
            onActivatePicker={onActivatePicker}
            onClearLocked={onClearLocked}
            onFocusChange={setIsFocused}
          />

          {!isFocused ? (
            <>
              <a
                href="https://rl3.dev"
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center justify-center gap-1.5 pt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                aria-label={t("feedback.powered_by_aria")}
              >
                <Rl3Mark className="h-3.5 w-3.5" />
                <span>
                  {t("feedback.powered_by")} <strong className="font-semibold">RL3</strong>
                </span>
              </a>
              {/* v0.4.4 — version pill so devs/admins can verify which
                  build of the widget is live without inspecting the
                  bundle hash. Click to expand for full detail. */}
              <VersionPill />
            </>
          ) : null}
        </div>

        {!isFocused ? (
          <SheetFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-feedback-id="feedback.cancel"
            >
              {t("feedback.cancel")}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default FeedbackPanel;
