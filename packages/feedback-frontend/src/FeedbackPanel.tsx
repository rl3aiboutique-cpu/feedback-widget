/**
 * Feedback panel — Sheet shell that hosts the single-canvas v0.4.0 UX.
 *
 * Pre-v0.4.0 this file owned the form state, validation, screenshot
 * capture, submit pipeline, and the Submit/Mine tab switcher. All of
 * that moved into the Canvas (and its sub-component Compose) so this
 * shell is intentionally thin: it just wires the Sheet header /
 * footer / branding strip and forwards the picker callbacks.
 */

import type { ReactElement } from "react";

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

export function FeedbackPanel({
  open,
  onOpenChange,
  locked,
  onActivatePicker,
  onClearLocked,
}: FeedbackPanelProps): ReactElement {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // Wider on lg+ so the inline iter pane has room for the
        // assumption + multiple-choice radios without wrapping.
        className="w-full sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-[560px] overflow-y-auto"
        data-feedback-widget-root="true"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Rl3Mark className="h-6 w-6 shrink-0" />
            <span>{t("feedback.panel_title")}</span>
          </SheetTitle>
          <SheetDescription>{t("feedback.panel_description")}</SheetDescription>
        </SheetHeader>

        <div className="px-4 mt-4">
          <Canvas
            locked={locked}
            onActivatePicker={onActivatePicker}
            onClearLocked={onClearLocked}
          />

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
        </div>

        <SheetFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-feedback-id="feedback.cancel"
          >
            {t("feedback.cancel")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default FeedbackPanel;
