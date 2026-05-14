/**
 * Submitter-facing ticket detail view — opens when the user clicks a
 * row in Mis feedbacks (S3E).
 *
 * Layout:
 *
 *   ┌─ ← Volver  | ticket_code | <StatusPill> ─────────┐
 *   │ Title                                              │
 *   │ ┌─ Summary card (description) ──────────────────┐ │
 *   │ ┌─ Conversation (admin ↔ submitter bubbles) ────┐ │
 *   │ ┌─ Reply composer (textarea + send) ────────────┐ │
 *   └────────────────────────────────────────────────────┘
 *
 * Bubble routing from the submitter's perspective:
 *   - own comments  → role="user"  (right, primary tint)
 *   - admin comments → role="admin" (left, violet tint + "Equipo" badge)
 *
 * Polling is delegated to `useFeedbackCommentsQuery` (30s refresh) so
 * admin replies surface near-live without an explicit refresh.
 *
 * NOTE on synthesis: ``FeedbackRead`` does not currently expose
 * ``synthesis_json`` — the backend stores it on
 * ``feedback_chat_session`` and never serializes it on the feedback
 * row. For S3E we render ``title`` + ``description`` (always present)
 * as the read-only summary. Wiring the structured synthesis is a
 * follow-up (needs the FeedbackRead schema to gain ``synthesis_json``).
 */

import { Send } from "lucide-react";
import { type ReactElement, useState } from "react";

import { useFeedbackAdapter } from "../FeedbackProvider";
import {
  FeedbackApiError,
  useFeedbackCommentsQuery,
  useFeedbackDetailQuery,
  usePostFeedbackCommentMutation,
} from "../adapter";
import type { FeedbackCommentRead } from "../client";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

import { ChatBubble } from "./ChatBubble";
import { StatusPill } from "./StatusPill";

export interface TicketDetailProps {
  feedbackId: string;
  onBack: () => void;
}

function _formatTs(dt: string | null | undefined): string {
  if (!dt) return "";
  return dt.slice(0, 16).replace("T", " ");
}

export function TicketDetail({ feedbackId, onBack }: TicketDetailProps): ReactElement {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const currentUser = adapter.useCurrentUser();

  const detail = useFeedbackDetailQuery(feedbackId);
  const comments = useFeedbackCommentsQuery(feedbackId);
  const post = usePostFeedbackCommentMutation();

  const [draft, setDraft] = useState("");

  const onSend = (): void => {
    const body = draft.trim();
    if (!body) return;
    post.mutate(
      { feedbackId, body },
      {
        onSuccess: () => setDraft(""),
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
    <div className="flex h-full flex-col gap-3 p-1">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground"
          data-feedback-id="feedback.ticket_detail.back"
        >
          ← Volver
        </button>
        {detail.data ? (
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted shrink-0">
              {detail.data.ticket_code || "—"}
            </code>
            <StatusPill status={detail.data.status} />
          </div>
        ) : null}
      </div>

      {detail.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("feedback.mine.loading")}</p>
      ) : detail.isError || !detail.data ? (
        <p className="text-sm text-destructive">{t("feedback.mine.error")}</p>
      ) : (
        <>
          <section
            className="flex flex-col gap-2 rounded-lg border border-input bg-card p-3 shadow-sm"
            data-feedback-id="feedback.ticket_detail.summary"
          >
            <h3 className="text-base font-bold text-foreground">{detail.data.title}</h3>
            {detail.data.description ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {detail.data.description}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                {t("feedback.mine.no_description")}
              </p>
            )}
            {detail.data.triage_note ? (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
                <p className="font-semibold uppercase tracking-wide text-primary mb-1">
                  {t("feedback.mine.triage_note")}
                </p>
                <p className="whitespace-pre-wrap text-foreground">{detail.data.triage_note}</p>
              </div>
            ) : null}
          </section>

          <section className="flex flex-1 min-h-0 flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
              {t("feedback.comments.thread_title")}
            </h4>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {comments.isLoading ? (
                <p className="text-xs text-muted-foreground">{t("feedback.comments.loading")}</p>
              ) : comments.isError ? (
                <p className="text-xs text-destructive">{t("feedback.comments.error")}</p>
              ) : (comments.data?.data?.length ?? 0) === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  {t("feedback.comments.empty")}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {comments.data?.data.map((c: FeedbackCommentRead) => {
                    const isMine = currentUser !== null && c.author_user_id === currentUser.id;
                    const role: "user" | "admin" = isMine ? "user" : "admin";
                    const caption =
                      role === "admin"
                        ? `${t("feedback.comments.admin_label")} · ${_formatTs(c.created_at)}`
                        : undefined;
                    return (
                      <li key={c.id}>
                        <ChatBubble role={role} text={c.body} caption={caption} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <div className="space-y-1.5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("feedback.comments.placeholder")}
              rows={2}
              maxLength={5000}
              disabled={post.isPending}
              data-feedback-id="feedback.ticket_detail.draft"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={onSend}
                disabled={post.isPending || draft.trim().length === 0}
                data-feedback-id="feedback.ticket_detail.send"
              >
                <Send className="mr-1 h-3.5 w-3.5" />
                {post.isPending ? t("feedback.comments.sending") : t("feedback.comments.send")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
