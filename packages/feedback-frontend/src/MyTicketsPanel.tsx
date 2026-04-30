/**
 * Submitter-facing "my tickets" view.
 *
 * Lists the user's recent feedback rows with the current status and
 * lets them expand any row inline to see the description, expected
 * outcome, triage note, and attachments. Polling lives in
 * `useMyFeedbackQuery` (60 s) so this view is "near-live".
 *
 * Submitter does NOT have admin permissions — this list is scoped to
 * their own user_id by the backend, and the GET /mine endpoint signs
 * attachment URLs so the user can preview their own screenshots.
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { useFeedbackAdapter } from "./FeedbackProvider";
import { useMyFeedbackQuery } from "./adapter";
import type { FeedbackAttachmentRead, FeedbackRead } from "./client";
import type { FeedbackReadShape, FeedbackStatusKey } from "./types";
import { Badge } from "./ui/badge";

function statusVariant(s: FeedbackStatusKey): "default" | "secondary" | "outline" | "destructive" {
  if (s === "new") return "default";
  if (s === "triaged" || s === "in_progress") return "secondary";
  if (s === "wont_fix") return "destructive";
  return "outline";
}

function humanStatus(s: FeedbackStatusKey): string {
  switch (s) {
    case "new":
      return "Submitted";
    case "triaged":
      return "Triaged";
    case "in_progress":
      return "In progress";
    case "done":
      return "Resolved";
    case "wont_fix":
      return "Closed (won't fix)";
    default:
      return s;
  }
}

interface MyTicketsPanelProps {
  /** Called when the user clicks the deep-link in an expanded row.
   * Optional. The host can use this to e.g. navigate to its own
   * tenant-internal admin view. When omitted, the row stays inside the
   * panel. */
  onSelectTicket?: (row: FeedbackReadShape) => void;
}

export function MyTicketsPanel({ onSelectTicket }: MyTicketsPanelProps): React.ReactElement {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const query = useMyFeedbackQuery(25);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("feedback.mine.loading")}</p>;
  }

  if (query.isError) {
    return <p className="text-sm text-destructive">{t("feedback.mine.error")}</p>;
  }

  const rows = query.data ?? [];

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("feedback.mine.empty")}</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((r: FeedbackRead) => {
        const recentlyResolved = r.status === "done";
        const isOpen = expandedId === r.id;
        return (
          <li key={r.id}>
            <div
              className={`rounded-md border ${
                recentlyResolved ? "border-primary bg-primary/5" : "border-input"
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : r.id)}
                className="w-full text-left p-2 text-sm flex flex-col gap-1 hover:bg-accent rounded-md"
                aria-expanded={isOpen}
                aria-controls={`ticket-detail-${r.id}`}
                data-feedback-id="feedback.mine.row"
              >
                <div className="flex items-center gap-2">
                  <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted shrink-0">
                    {r.ticket_code || "—"}
                  </code>
                  <Badge variant={statusVariant(r.status)} className="shrink-0">
                    {humanStatus(r.status)}
                  </Badge>
                  <span className="truncate flex-1 font-medium">{r.title}</span>
                  {isOpen ? (
                    <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </div>
                {recentlyResolved && !isOpen ? (
                  <span className="text-[11px] text-primary">{t("feedback.mine.action_hint")}</span>
                ) : null}
              </button>

              {isOpen ? (
                <div
                  id={`ticket-detail-${r.id}`}
                  className="border-t border-input px-3 py-3 space-y-3 text-xs"
                >
                  {r.created_at ? (
                    <p className="text-muted-foreground">
                      {t("feedback.mine.submitted_at", {
                        date: r.created_at.slice(0, 16).replace("T", " "),
                      })}
                    </p>
                  ) : null}

                  <section>
                    <h4 className="font-semibold text-foreground mb-1">
                      {t("feedback.field.description")}
                    </h4>
                    <p className="whitespace-pre-wrap">
                      {r.description || (
                        <span className="italic text-muted-foreground">
                          {t("feedback.mine.no_description")}
                        </span>
                      )}
                    </p>
                  </section>

                  {r.expected_outcome ? (
                    <section>
                      <h4 className="font-semibold text-foreground mb-1">
                        {t("feedback.field.expected_outcome")}
                      </h4>
                      <p className="whitespace-pre-wrap">{r.expected_outcome}</p>
                    </section>
                  ) : null}

                  {r.triage_note ? (
                    <section className="rounded bg-muted/50 p-2">
                      <h4 className="font-semibold text-foreground mb-1">
                        {t("feedback.mine.triage_note")}
                      </h4>
                      <p className="whitespace-pre-wrap">{r.triage_note}</p>
                    </section>
                  ) : null}

                  {r.attachments && r.attachments.length > 0 ? (
                    <section>
                      <h4 className="font-semibold text-foreground mb-1">
                        {t("feedback.mine.attachments", {
                          count: String(r.attachments.length),
                        })}
                      </h4>
                      <ul className="space-y-1.5">
                        {r.attachments.map((a: FeedbackAttachmentRead) => {
                          const isImage = a.content_type.startsWith("image/");
                          const label = a.filename ?? a.kind;
                          return (
                            <li
                              key={a.id}
                              className="flex items-center gap-2 rounded border border-input bg-background p-1.5"
                            >
                              {isImage && a.presigned_url ? (
                                <a
                                  href={a.presigned_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0"
                                >
                                  <img
                                    src={a.presigned_url}
                                    alt={label}
                                    className="h-10 w-10 rounded object-cover"
                                    loading="lazy"
                                  />
                                </a>
                              ) : null}
                              <span className="flex-1 truncate font-mono">{label}</span>
                              <span className="text-muted-foreground shrink-0">
                                {(a.byte_size / 1024).toFixed(1)} KB
                              </span>
                              {a.presigned_url ? (
                                <a
                                  href={a.presigned_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 text-primary hover:underline"
                                >
                                  {t("feedback.mine.open")}
                                </a>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ) : null}

                  {onSelectTicket ? (
                    <button
                      type="button"
                      onClick={() => onSelectTicket(r as unknown as FeedbackReadShape)}
                      className="text-primary hover:underline"
                      data-feedback-id="feedback.mine.deeplink"
                    >
                      {t("feedback.mine.open_in_app")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Hook returning the count of feedback rows in DONE status (recently
 * resolved). Used by FeedbackButton to render a "look at this" badge.
 */
export function useMyPendingActionCount(): number {
  const query = useMyFeedbackQuery(25);
  return (query.data ?? []).filter((r) => r.status === "done").length;
}
