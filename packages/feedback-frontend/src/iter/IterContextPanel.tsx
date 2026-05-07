/**
 * Collapsible context block shown above the focused iter pane.
 *
 * Surfaces the original feedback the user is iterating about — the
 * screenshot they captured, the title, the description, and the
 * expected outcome. Collapsed by default to keep the focus pane low-
 * noise; opens on click; persists open/closed in `sessionStorage`
 * keyed by feedback id so the user's preference survives within a
 * tab session.
 */

import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";

import type { FeedbackAttachmentRead, FeedbackRead } from "../client";

const _STORAGE_PREFIX = "rl3-iter-context-open:";

function _readPersistedOpen(feedbackId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(_STORAGE_PREFIX + feedbackId) === "1";
  } catch {
    return false;
  }
}

function _writePersistedOpen(feedbackId: string, open: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(_STORAGE_PREFIX + feedbackId, open ? "1" : "0");
  } catch {
    // Ignore quota / disabled storage. State still works in-memory.
  }
}

export interface IterContextPanelProps {
  feedback: FeedbackRead | null | undefined;
  /** Allow the parent to force-open or force-close from outside (e.g.
   * the first time a brand-new feedback gets iterated, opening once
   * automatically makes the source material visible). */
  defaultOpen?: boolean;
}

export function IterContextPanel({
  feedback,
  defaultOpen = false,
}: IterContextPanelProps): ReactElement | null {
  const fbId = feedback?.id ?? "";
  const [open, setOpen] = useState<boolean>(() =>
    fbId ? _readPersistedOpen(fbId) || defaultOpen : defaultOpen,
  );

  useEffect(() => {
    if (!fbId) return;
    _writePersistedOpen(fbId, open);
  }, [fbId, open]);

  if (!feedback) {
    return (
      <div className="rounded-md border border-input bg-muted/30 p-2 text-[11px] text-muted-foreground">
        Loading original feedback…
      </div>
    );
  }

  const screenshot = feedback.attachments?.find(
    (a: FeedbackAttachmentRead) => a.kind === "screenshot",
  );
  const userAttachments = (feedback.attachments ?? []).filter(
    (a: FeedbackAttachmentRead) => a.kind !== "screenshot",
  );

  return (
    <details
      className="rounded-md border border-input bg-card text-xs"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-accent rounded-md select-none">
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="font-medium">Contexto original</span>
        <code className="ml-auto rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
          {feedback.ticket_code || "—"}
        </code>
      </summary>

      <div className="border-t border-input px-3 py-3 space-y-3">
        {screenshot?.presigned_url ? (
          <a
            href={screenshot.presigned_url}
            target="_blank"
            rel="noreferrer"
            className="block"
            title="Open full-size screenshot"
          >
            <img
              src={screenshot.presigned_url}
              alt="Screenshot at submission time"
              className="w-full rounded border border-input object-contain max-h-64"
              loading="lazy"
            />
          </a>
        ) : null}

        <section>
          <h4 className="mb-1 font-semibold text-foreground">Título</h4>
          <p className="whitespace-pre-wrap">{feedback.title}</p>
        </section>

        <section>
          <h4 className="mb-1 font-semibold text-foreground">Description</h4>
          <p className="whitespace-pre-wrap">
            {feedback.description || (
              <span className="italic text-muted-foreground">(no description)</span>
            )}
          </p>
        </section>

        {feedback.expected_outcome ? (
          <section>
            <h4 className="mb-1 font-semibold text-foreground">Expected outcome</h4>
            <p className="whitespace-pre-wrap">{feedback.expected_outcome}</p>
          </section>
        ) : null}

        {userAttachments.length > 0 ? (
          <section>
            <h4 className="mb-1 font-semibold text-foreground">
              Attachments ({userAttachments.length})
            </h4>
            <ul className="space-y-1">
              {userAttachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded border border-input bg-background p-1.5"
                >
                  <span className="flex-1 truncate font-mono text-[11px]">
                    {a.filename ?? a.kind}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[10px]">
                    {(a.byte_size / 1024).toFixed(1)} KB
                  </span>
                  {a.presigned_url ? (
                    <a
                      href={a.presigned_url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-primary hover:underline text-[11px]"
                    >
                      Open
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </details>
  );
}
