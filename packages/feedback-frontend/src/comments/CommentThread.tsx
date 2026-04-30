/**
 * Chat-style conversation thread for one feedback ticket.
 *
 * Shipped in v0.2.2 — replaces the magic-link accept/reject flow that
 * was dropped in v0.2.0 with an in-app reply loop.
 *
 *   - Submitter sees + can post on tickets they filed.
 *   - Admin (master) sees + can post on any ticket in the tenant.
 *   - Append-only — no edit / delete in v0.2.2.
 *
 * Polls the GET /feedback/{id}/comments endpoint every 30 s so admin
 * replies surface "near-live" without a manual refresh.
 */

import { Send } from "lucide-react";
import { useState } from "react";

import { useFeedbackAdapter } from "../FeedbackProvider";
import { useFeedbackCommentsQuery, usePostFeedbackCommentMutation } from "../adapter";
import type { FeedbackCommentRead } from "../client";
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
  const query = useFeedbackCommentsQuery(feedbackId);
  const post = usePostFeedbackCommentMutation();
  const [draft, setDraft] = useState("");

  const onSend = (): void => {
    const body = draft.trim();
    if (!body) return;
    post.mutate(
      { feedbackId, body },
      {
        onSuccess: () => {
          setDraft("");
        },
        onError: (err) => {
          adapter.toast.error(`${t("feedback.comments.send_error")}: ${String(err)}`);
        },
      },
    );
  };

  return (
    <section className="space-y-2">
      <h4 className="font-semibold text-foreground text-xs uppercase tracking-wide text-muted-foreground">
        {t("feedback.comments.thread_title")}
      </h4>

      {query.isLoading ? (
        <p className="text-xs text-muted-foreground">{t("feedback.comments.loading")}</p>
      ) : query.isError ? (
        <p className="text-xs text-destructive">{t("feedback.comments.error")}</p>
      ) : (query.data?.data?.length ?? 0) === 0 ? (
        <p className="text-xs italic text-muted-foreground">{t("feedback.comments.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {query.data?.data.map((c: FeedbackCommentRead) => {
            const isMine = currentUser !== null && c.author_user_id === currentUser.id;
            const label = isMine
              ? t("feedback.comments.you_label")
              : c.author_role === "admin"
                ? t("feedback.comments.admin_label")
                : t("feedback.comments.submitter_label");
            return (
              <li
                key={c.id}
                className={`rounded-md border p-2 text-xs ${
                  isMine
                    ? "border-input bg-background"
                    : c.author_role === "admin"
                      ? "border-primary/40 bg-primary/5"
                      : "border-input bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant={
                      isMine ? "outline" : c.author_role === "admin" ? "default" : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{_fmt(c.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-1.5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("feedback.comments.placeholder")}
          rows={2}
          maxLength={5000}
          disabled={post.isPending}
          data-feedback-id="feedback.comments.draft"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={onSend}
            disabled={post.isPending || draft.trim().length === 0}
            data-feedback-id="feedback.comments.send"
          >
            <Send className="mr-1 h-3.5 w-3.5" />
            {post.isPending ? t("feedback.comments.sending") : t("feedback.comments.send")}
          </Button>
        </div>
      </div>
    </section>
  );
}
