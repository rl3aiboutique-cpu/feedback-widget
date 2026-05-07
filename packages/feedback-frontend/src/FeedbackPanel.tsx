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

const _FEED_WIDTH = "w-full sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-[560px]";
const _FOCUS_WIDTH = "w-full sm:max-w-lg md:max-w-2xl lg:max-w-[800px] xl:max-w-[800px]";

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
        // Width follows focus state — gives the spec markdown room
        // when iterating, snaps back to the feed width otherwise.
        // The transition uses Tailwind's max-width animation so the
        // swap feels smooth instead of snapping.
        className={`${widthClass} overflow-y-auto transition-[max-width] duration-200`}
        data-feedback-widget-root="true"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Rl3Mark className="h-6 w-6 shrink-0" />
            <span>{t("feedback.panel_title")}</span>
          </SheetTitle>
          {!isFocused ? (
            <SheetDescription>{t("feedback.panel_description")}</SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="px-4 mt-4 flex-1 min-h-0">
          <Canvas
            locked={locked}
            onActivatePicker={onActivatePicker}
            onClearLocked={onClearLocked}
            onFocusChange={setIsFocused}
          />

          {!isFocused ? (
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
