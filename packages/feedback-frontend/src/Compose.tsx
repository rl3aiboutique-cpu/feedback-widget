/**
 * Compose — sticky-at-top form for new feedback inside the Canvas.
 *
 * Owns its own validation + screenshot capture + submit pipeline. The
 * parent Canvas only needs to pass:
 *   * the locked element (if the user pressed "Select element" in the
 *     ElementSelector overlay)
 *   * an `onSubmitted(feedbackId)` callback so the canvas can scroll
 *     to the freshly-created card and offer to launch iter inline.
 *   * picker activation/clear callbacks (the ElementSelector lives one
 *     layer up in FeedbackButton).
 *
 * Compose is intentionally self-contained — it does NOT know about
 * the card feed below it. That keeps the canvas free to swap the
 * feed renderer (cards / table / spreadsheet) without touching this
 * file.
 */

import { Send, Sparkles } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";

import type { LockedElement } from "./FeedbackButton";
import { useFeedbackAdapter } from "./FeedbackProvider";
import { SubmitFeedbackError } from "./adapter";
import { buildMetadataBundle } from "./capture/metadata";
import {
  type ScreenshotResult,
  captureElementScreenshot,
  capturePageScreenshot,
} from "./capture/screenshot";
import { EMPTY_FORM, FeedbackForm, type FeedbackFormValues } from "./forms/FeedbackForm";
import type { FeedbackElementInfo, FeedbackReadShape, FeedbackTypeKey } from "./types";
import { Button } from "./ui/button";

export interface ComposeProps {
  locked: LockedElement | null;
  onActivatePicker: () => void;
  onClearLocked: () => void;
  /** Fired after a successful POST. ``thenIterate`` lets the canvas
   * decide whether to auto-launch the inline iter pane on the new
   * card. */
  onSubmitted: (feedbackId: string, opts: { thenIterate: boolean }) => void;
}

type CaptureMode = "page" | "element";

export function Compose({
  locked,
  onActivatePicker,
  onClearLocked,
  onSubmitted,
}: ComposeProps): ReactElement {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();

  const [values, setValues] = useState<FeedbackFormValues>(() => ({ ...EMPTY_FORM }));
  const [mode, setMode] = useState<CaptureMode>(locked ? "element" : "page");
  const [submitting, setSubmitting] = useState(false);
  const [submittingWithIter, setSubmittingWithIter] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reflect newly-locked elements from the picker round-trip.
  useEffect(() => {
    if (locked) setMode("element");
  }, [locked]);

  // Clear field errors as the user fixes them.
  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) return;
    const cleared: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldErrors)) {
      if (k === "title" && values.title.trim()) continue;
      if (k === "description" && values.description.trim()) continue;
      cleared[k] = v;
    }
    if (Object.keys(cleared).length !== Object.keys(fieldErrors).length) {
      setFieldErrors(cleared);
    }
  }, [values, fieldErrors]);

  const selectorInfo: FeedbackElementInfo | null = useMemo(() => {
    if (!locked) return null;
    return {
      selector: locked.info.selector,
      xpath: locked.info.xpath,
      bounding_box: { ...locked.info.bounding_box },
    };
  }, [locked]);

  const validate = (): { ok: true } | { ok: false; reason: string } => {
    if (!values.type) return { ok: false, reason: "type" };
    if (!values.title.trim()) return { ok: false, reason: "title" };
    if (!values.description.trim()) return { ok: false, reason: "description" };
    return { ok: true };
  };

  const captureScreenshot = async (): Promise<ScreenshotResult | null> => {
    const opts = { redactionSelectors: adapter.getDefaultRedactionSelectors() };
    try {
      if (mode === "element" && locked?.el) {
        return await captureElementScreenshot(locked.el, opts);
      }
      return await capturePageScreenshot(opts);
    } catch {
      adapter.toast.error(t("feedback.toast_screenshot_failed"));
      return null;
    }
  };

  const onSubmit = async (opts?: { thenIterate?: boolean }): Promise<void> => {
    const thenIterate = opts?.thenIterate ?? false;
    const v = validate();
    if (!v.ok) {
      const reason = v.reason;
      const fieldLabel = (() => {
        switch (reason) {
          case "type":
            return t("feedback.type_label");
          case "title":
            return t("feedback.field.title");
          case "description":
            return t("feedback.field.description");
          default:
            return reason;
        }
      })();
      const message = t("feedback.toast_error_required_field", { field: fieldLabel });
      setFieldErrors({ [reason]: message });
      adapter.toast.error(message);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    setSubmittingWithIter(thenIterate);
    try {
      const shotPromise = (async () => {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        return captureScreenshot();
      })();
      const shot = await shotPromise;

      const metadata = buildMetadataBundle({
        routeName: typeof window !== "undefined" ? window.location.pathname : null,
        appVersion: adapter.appVersion,
        gitSha: adapter.gitSha,
        user: null,
        selectedElement: locked?.info ?? null,
      });

      const payload = {
        type: values.type as FeedbackTypeKey,
        title: values.title.trim(),
        description: values.description,
        expected_outcome: values.expected_outcome.trim() || null,
        url_captured:
          typeof window !== "undefined"
            ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
            : "",
        route_name: typeof window !== "undefined" ? window.location.pathname : null,
        element: selectorInfo,
        metadata_bundle: metadata,
        app_version: adapter.appVersion,
        git_commit_sha: adapter.gitSha,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      };

      const created: FeedbackReadShape = await adapter.submitFeedback(
        JSON.stringify(payload),
        shot?.blob ?? null,
        values.attachments,
      );
      const link = adapter.getDeepLinkToFeedback(created.id);
      const ticketLabel = created.ticket_code || created.id.slice(0, 8);
      adapter.toast.success(t("feedback.toast_success", { id: ticketLabel }), {
        url: link,
        actionLabel: t("feedback.toast_success_link"),
      });
      // Reset form so the user can compose another without scrolling
      // back up. The card list owns showing the new ticket.
      setValues({ ...EMPTY_FORM });
      onClearLocked();
      setMode("page");
      onSubmitted(created.id, { thenIterate });
    } catch (err) {
      if (err instanceof SubmitFeedbackError && err.status === 429) {
        const seconds = err.retryAfter ?? "?";
        adapter.toast.error(t("feedback.toast_error_429", { seconds: String(seconds) }));
      } else {
        adapter.toast.error(t("feedback.toast_error_generic"));
      }
    } finally {
      setSubmitting(false);
      setSubmittingWithIter(false);
    }
  };

  return (
    <div className="rounded-md border border-input bg-background p-3 space-y-3 shadow-sm">
      {/* Capture mode selector — compact row above the form fields. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {t("feedback.mode_label")}
        </span>
        <Button
          type="button"
          variant={mode === "page" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setMode("page");
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
            <code className="font-mono truncate max-w-[180px]">{locked.info.selector}</code>
            <button
              type="button"
              onClick={() => {
                onClearLocked();
                setMode("page");
              }}
              className="text-primary underline-offset-2 hover:underline"
              data-feedback-id="feedback.clear_element"
            >
              ✕
            </button>
          </span>
        ) : null}
      </div>

      <FeedbackForm values={values} onChange={setValues} errors={fieldErrors} />

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => onSubmit({ thenIterate: false })}
          disabled={submitting || !values.type}
          data-feedback-id="feedback.submit"
          size="sm"
        >
          <Send className="h-3.5 w-3.5" />
          {submitting && !submittingWithIter ? t("feedback.submitting") : t("feedback.submit")}
        </Button>
        <Button
          type="button"
          onClick={() => onSubmit({ thenIterate: true })}
          disabled={submitting || !values.type}
          data-feedback-id="feedback.submit-and-iterate"
          title="Submit the feedback and immediately open the inline AI iteration"
          size="sm"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {submitting && submittingWithIter ? "Submitting…" : "Send and Iterate"}
        </Button>
      </div>
    </div>
  );
}
