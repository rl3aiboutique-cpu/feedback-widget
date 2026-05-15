import { Image as ImageIcon, MousePointer2 } from "lucide-react";
import type { ReactElement } from "react";

import { useFeedbackAdapter } from "../FeedbackProvider";

export type CaptureMode = "page" | "element";

export interface LockedElementInfo {
  selector: string;
  xpath: string | null;
  bounding_box: { x: number; y: number; w: number; h: number };
  /** Sprint B / capture_v3 — element outerHTML snapshot, truncated to
   * the backend cap (4096 chars). Null when capture failed. */
  outer_html?: string | null;
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
            <MousePointer2 className="mr-1 inline h-3 w-3" />
            {locked.selector}
          </code>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
            <ImageIcon className="h-3 w-3" />
            {t("feedback.mode_whole_page")}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {t("feedback.mode_label")}
      </span>
      <div className="inline-flex items-center rounded-full border border-input/60 bg-muted/30 p-0.5">
        <button
          type="button"
          onClick={() => {
            onModeChange("page");
            onClearLocked();
          }}
          data-feedback-id="feedback.mode_whole_page"
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
            mode === "page"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          {t("feedback.mode_whole_page")}
        </button>
        <button
          type="button"
          onClick={onActivatePicker}
          data-feedback-id="feedback.mode_select_element"
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
            mode === "element"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <MousePointer2 className="h-3.5 w-3.5" />
          {t("feedback.mode_select_element")}
        </button>
      </div>
      {/* The locked-element selector now lives inside CapturePreview's
       * caption (post 20260515 visual-refresh) so the chip here would
       * duplicate the information. The user clears the lock either by
       * × on the CapturePreview (drops the screenshot entirely) or by
       * clicking "Whole page" in this toggle (resets mode + clears
       * locked via the page-button handler above). */}
    </div>
  );
}
