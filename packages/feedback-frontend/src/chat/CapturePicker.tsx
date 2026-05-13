import type { ReactElement } from "react";

import { useFeedbackAdapter } from "../FeedbackProvider";
import { Button } from "../ui/button";

export type CaptureMode = "page" | "element";

export interface LockedElementInfo {
  selector: string;
  xpath: string | null;
  bounding_box: { x: number; y: number; w: number; h: number };
}

export interface CapturePickerProps {
  mode: CaptureMode;
  locked: LockedElementInfo | null;
  onActivatePicker: () => void;
  onClearLocked: () => void;
  onModeChange: (mode: CaptureMode) => void;
  /** When `true`, the picker is in read-only "badge" mode (after the chat has started). */
  readOnly?: boolean;
}

export function CapturePicker({
  mode,
  locked,
  onActivatePicker,
  onClearLocked,
  onModeChange,
  readOnly = false,
}: CapturePickerProps): ReactElement {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();

  if (readOnly) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wide">{t("feedback.mode_label")}</span>
        {mode === "element" && locked ? (
          <code className="font-mono truncate max-w-[220px] rounded bg-muted px-1.5 py-0.5">
            📍 {locked.selector}
          </code>
        ) : (
          <span className="rounded bg-muted px-1.5 py-0.5">🌐 {t("feedback.mode_whole_page")}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {t("feedback.mode_label")}
      </span>
      <Button
        type="button"
        variant={mode === "page" ? "default" : "outline"}
        size="sm"
        onClick={() => {
          onModeChange("page");
          onClearLocked();
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
      {mode === "element" && locked ? (
        <span className="ml-auto inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[11px]">
          <code className="font-mono truncate max-w-[180px]">{locked.selector}</code>
          <button
            type="button"
            onClick={() => {
              onClearLocked();
              onModeChange("page");
            }}
            className="text-primary underline-offset-2 hover:underline"
            data-feedback-id="feedback.clear_element"
            aria-label="Clear locked element"
          >
            ✕
          </button>
        </span>
      ) : null}
    </div>
  );
}
