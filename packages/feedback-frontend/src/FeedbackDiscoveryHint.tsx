/**
 * Optional discovery card hosts can mount in their admin home / docs
 * page to teach users where the in-app feedback UX lives. Mirrors the
 * Patrón A model: triage lives inside the FeedbackButton sheet, no
 * dedicated route exists.
 *
 * Hosts opt in:
 *
 *   import { FeedbackDiscoveryHint } from "@rl3/feedback-widget";
 *   <FeedbackDiscoveryHint variant="admin" />
 *
 * Variants:
 * - ``admin``  — full block with title + instructions (for admin pages)
 * - ``inline`` — one-liner sentence (for in-context references)
 */

import { Sparkles } from "lucide-react";
import type { ReactElement } from "react";

export interface FeedbackDiscoveryHintProps {
  /** Layout variant. ``admin`` is the full discovery card; ``inline``
   *  is a one-line span suitable for embedding in body copy. */
  variant?: "admin" | "inline";
  /** Optional className passed through for host-side spacing. */
  className?: string;
  /** Override the headline (admin variant only). */
  title?: string;
  /** Override the body copy (admin variant only). */
  description?: string;
}

const _DEFAULT_TITLE = "Beta feedback triage";
const _DEFAULT_DESCRIPTION =
  "Click the floating RL3 Feedback button (bottom-right), open the My tickets tab, then toggle the scope to All to browse every ticket in the tenant — screenshots, attachments, spec card, and admin actions all live inside the sheet.";

export function FeedbackDiscoveryHint({
  variant = "admin",
  className,
  title,
  description,
}: FeedbackDiscoveryHintProps): ReactElement {
  if (variant === "inline") {
    return (
      <span className={className} data-feedback-id="feedback.discovery.inline">
        usa el botón flotante{" "}
        <span className="font-semibold text-primary">RL3 Feedback</span>{" "}
        (esquina inferior derecha)
      </span>
    );
  }
  return (
    <div
      className={[
        "flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-4",
        className ?? "",
      ].join(" ")}
      data-feedback-id="feedback.discovery.admin"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">{title ?? _DEFAULT_TITLE}</h2>
          <p className="text-sm text-muted-foreground">
            {description ?? _DEFAULT_DESCRIPTION}
          </p>
        </div>
      </div>
    </div>
  );
}
