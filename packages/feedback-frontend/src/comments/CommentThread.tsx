/**
 * Conversation timeline for one ticket.
 *
 * After the 2026-05-16 unification this component renders the
 * ``messages`` JSONB on the ticket row directly — there is no
 * separate ``feedback_comment`` table any more. Admins write new
 * entries via ``POST /feedback/{id}/admin-action`` (single atomic
 * call that may also transition status); users reply by sending a
 * normal chat turn (handled elsewhere by the chat sheet).
 */

import { Send } from "lucide-react";
import { useState } from "react";

import { useFeedbackAdapter } from "../FeedbackProvider";
import {
  FeedbackApiError,
  useFeedbackDetailQuery,
  usePostFeedbackAdminActionMutation,
} from "../adapter";
import type { FeedbackTimelineMessage } from "../client";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

export interface CommentThreadProps {
  feedbackId: string;
}

function _fmt(dt: string | null | undefined): string {
  if (!dt) return "—";
  return dt.slice(0, 16).replace("T", " ");
}

export function CommentThread({ feedbackId }: CommentThreadProps): React.ReactElement {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const currentUser = adapter.useCurrentUser();
  const ticketQuery = useFeedbackDetailQuery(feedbackId);
  const adminAction = usePostFeedbackAdminActionMutation();
  const [draft, setDraft] = useState("");

  const messages: FeedbackTimelineMessage[] = ticketQuery.data?.messages ?? [];
  const isAdmin = ticketQuery.data?.user_id !== currentUser?.id;

  const onSend = (): void => {
    const body = draft.trim();
    if (!body) return;
    adminAction.mutate(
      { feedbackId, payload: { message_text: body } },
      {
        onSuccess: () => {
          setDraft("");
        },
        onError: (err) => {
          if (err instanceof FeedbackApiError) {
            if (err.status === 429) {
              const seconds = err.retryAfter ?? "?";
              adapter.toast.error(t("feedback.toast_error_429", { seconds: String(seconds) }));
              return;
            }
            if (err.status === 401 || err.status === 403) {
              adapter.toast.error(t("feedback.comments.send_unauthorized"));
              return;
            }
          }
          adapter.toast.error(t("feedback.comments.send_error"));
        },
      },
    );
  };

  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
        {t("feedback.comments.thread_title")}
      </h4>

      {ticketQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">{t("feedback.comments.loading")}</p>
      ) : ticketQuery.isError ? (
        <p className="text-xs text-destructive">{t("feedback.comments.error")}</p>
      ) : messages.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">{t("feedback.comments.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {messages.map((m, idx) => {
            const isMine = m.role === "user";
            const label =
              m.role === "admin"
                ? t("feedback.comments.admin_label")
                : m.role === "assistant"
                  ? "RL3"
                  : isMine
                    ? t("feedback.comments.you_label")
                    : t("feedback.comments.submitter_label");
            const bubbleClass =
              m.role === "admin"
                ? "border-primary/40 bg-primary/5"
                : m.role === "assistant"
                  ? "border-input bg-muted/40"
                  : "border-input bg-background";
            const badgeVariant =
              m.role === "admin"
                ? "default"
                : m.role === "assistant"
                  ? "secondary"
                  : "outline";
            return (
              <li
                key={`${m.role}-${m.ts}-${idx}`}
                className={`rounded-md border p-2 text-xs ${bubbleClass}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={badgeVariant} className="text-[10px]">
                    {label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{_fmt(m.ts)}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.text}</p>
              </li>
            );
          })}
        </ul>
      )}

      {isAdmin ? (
        <div className="space-y-1.5">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("feedback.comments.placeholder")}
            rows={2}
            maxLength={5000}
            disabled={adminAction.isPending}
            data-feedback-id="feedback.comments.draft"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={onSend}
              disabled={adminAction.isPending || draft.trim().length === 0}
              data-feedback-id="feedback.comments.send"
            >
              <Send className="mr-1 h-3.5 w-3.5" />
              {adminAction.isPending
                ? t("feedback.comments.sending")
                : t("feedback.comments.send")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
