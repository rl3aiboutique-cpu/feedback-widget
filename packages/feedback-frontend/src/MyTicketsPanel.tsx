/**
 * Submitter-facing "my tickets" view.
 *
 * Lists the user's recent feedback rows with the current status —
 * shown inside the floating panel as a tab so the user can:
 *
 *   1. Confirm their submission landed.
 *   2. See when admin moves it through TRIAGED → IN_PROGRESS → DONE.
 *
 * Polling lives in `useMyFeedbackQuery` (60s interval) so this view
 * is "near-live" without a manual refresh.
 *
 * Submitter does NOT have admin permissions — this list is scoped to
 * their own user_id by the backend.
 */

import { useFeedbackAdapter } from "./FeedbackProvider";
import { useMyFeedbackQuery } from "./adapter";
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
  /** Called when the user clicks a row — host can use this to e.g.
   * deep-link into a tenant-internal admin view. Optional. */
  onSelectTicket?: (row: FeedbackReadShape) => void;
}

export function MyTicketsPanel({ onSelectTicket }: MyTicketsPanelProps): React.ReactElement {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const query = useMyFeedbackQuery(25);

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
      {rows.map((r) => {
        const recentlyResolved = r.status === "done";
        const clickable = !!onSelectTicket;
        const Tag = clickable ? "button" : "div";
        return (
          <li key={r.id}>
            <Tag
              type={clickable ? "button" : undefined}
              onClick={
                clickable ? () => onSelectTicket?.(r as unknown as FeedbackReadShape) : undefined
              }
              className={`w-full text-left rounded-md border p-2 text-sm flex flex-col gap-1
                ${recentlyResolved ? "border-primary bg-primary/5" : "border-input"}
                ${clickable ? "hover:bg-accent" : ""}`}
            >
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted shrink-0">
                  {r.ticket_code || "—"}
                </code>
                <Badge variant={statusVariant(r.status)} className="shrink-0">
                  {humanStatus(r.status)}
                </Badge>
                <span className="truncate flex-1 font-medium">{r.title}</span>
              </div>
              {recentlyResolved ? (
                <span className="text-[11px] text-primary">{t("feedback.mine.action_hint")}</span>
              ) : null}
            </Tag>
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
