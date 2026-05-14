import type { ReactElement } from "react";

import { useFeedbackAdapter } from "../FeedbackProvider";
import { useMyFeedbackQuery } from "../adapter";
import type { FeedbackRead } from "../client";

import { StatusPill } from "./StatusPill";

export interface MineFeedTabProps {
  /** Called when user clicks a row. S3E opens the inline TicketDetail
   * view; before S3E this no-op'd back to the compose tab. */
  onSelectFeedback?: (feedbackId: string) => void;
}

export function MineFeedTab({ onSelectFeedback }: MineFeedTabProps): ReactElement {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const query = useMyFeedbackQuery(25);

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground p-4">{t("feedback.mine.loading")}</p>;
  }
  if (query.isError) {
    return <p className="text-sm text-destructive p-4">{t("feedback.mine.error")}</p>;
  }
  const rows = query.data ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">{t("feedback.mine.empty")}</p>;
  }

  return (
    <ul className="space-y-2 p-1">
      {rows.map((r: FeedbackRead) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onSelectFeedback?.(r.id)}
            className="w-full p-2 text-sm flex items-center gap-2 rounded-md border border-input hover:bg-accent text-left"
            data-feedback-id="feedback.mine.row"
          >
            <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted shrink-0">
              {r.ticket_code || "—"}
            </code>
            <StatusPill status={r.status} />
            <span className="truncate flex-1 font-medium">{r.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
