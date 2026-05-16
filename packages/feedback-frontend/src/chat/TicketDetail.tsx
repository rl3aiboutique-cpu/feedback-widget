/**
 * TicketDetail — full conversational workspace for one ticket.
 *
 * Mirrors the EXACT chat experience of the "New feedback" tab:
 * ChatTimeline + AttachmentTray + Composer (paperclip + mic + send
 * pill). The header carries status/code/meta; the admin actions
 * panel sits AT THE TOP right under the header so reviewers see
 * controls before they scroll the conversation; the synthesis card
 * renders when the ticket has been confirmed; attachments are
 * clickable thumbnails (open in lightbox / native browser).
 *
 * The conversation is hydrated from the detail query and then driven
 * by the same ``useChatRunStream`` hook the new-feedback flow uses,
 * so streaming deltas, retries, and synthesis events all behave
 * identically across both entry points.
 */

import { AlertTriangle, Download, Send, Trash2, User } from "lucide-react";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useFeedbackAdapter, useFeedbackBindings } from "../FeedbackProvider";
import {
  downloadFeedbackBundleViaBindings,
  downloadOwnFeedbackBundleViaBindings,
  useAdminHardDeleteTicketMutation,
  useAdminSoftDeleteTicketMutation,
  useApproveSynthesisMutation,
  useEditSynthesisMutation,
  useFeedbackDetailQuery,
  usePostFeedbackAdminActionMutation,
  useSoftDeleteTicketMutation,
  useUploadChatAttachmentMutation,
} from "../adapter";
import type { FeedbackStatus } from "../client";
import { useCanTriageFeedback } from "../hooks/useCanTriageFeedback";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

import { AttachmentTray } from "./AttachmentTray";
import { ChatTimeline } from "./ChatTimeline";
import { Composer } from "./Composer";
import { StatusPill } from "./StatusPill";
import { VoiceRecorder } from "./VoiceRecorder";
import { useChatRunStream } from "./useChatRunStream";
import { useVoiceFlow } from "./useVoiceFlow";
import type { ChatMessage } from "./types";

const _ADMIN_STATUSES: FeedbackStatus[] = [
  "open",
  "in_review",
  "in_progress",
  "waiting_for_user",
  "resolved",
  "wont_fix",
  "closed",
];

const _TERMINAL_STATUSES = new Set<FeedbackStatus>([
  "resolved",
  "wont_fix",
  "closed",
]);

export interface TicketDetailProps {
  feedbackId: string;
  onBack: () => void;
}

function _formatTs(dt: string | null | undefined): string {
  if (!dt) return "";
  return dt.slice(0, 16).replace("T", " ");
}

function _shortId(id: string | null | undefined): string {
  if (!id || id.length <= 10) return id ?? "?";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function _hydrateMessages(raw: unknown[] | null | undefined): ChatMessage[] {
  if (!raw) return [];
  const out: ChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const role = o.role;
    const tsRaw = o.ts;
    if (
      role !== "user" &&
      role !== "assistant" &&
      role !== "admin" &&
      role !== "synthesis"
    )
      continue;
    if (role === "synthesis") {
      const synth = o.synthesis;
      if (!synth || typeof synth !== "object") continue;
      // Keep the original ISO ts string so approve/edit endpoints
      // address the right msg server-side.
      const tsStr =
        typeof tsRaw === "string" ? tsRaw : new Date().toISOString();
      out.push({
        role: "synthesis",
        text: "",
        ts: tsStr,
        synthesis: synth as ChatMessage["synthesis"],
        confirmed: o.confirmed === true,
      });
      continue;
    }
    const text = o.text;
    if (typeof text !== "string") continue;
    let ts: number | string = Date.now();
    if (typeof tsRaw === "string") {
      const parsed = Date.parse(tsRaw);
      if (!Number.isNaN(parsed)) ts = parsed;
    } else if (typeof tsRaw === "number") {
      ts = tsRaw;
    }
    out.push({ role, text, ts });
  }
  return out;
}

export function TicketDetail({ feedbackId, onBack }: TicketDetailProps): ReactElement {
  const adapter = useFeedbackAdapter();
  const bindings = useFeedbackBindings();
  const t = adapter.useTranslation();
  const currentUser = adapter.useCurrentUser();

  const detail = useFeedbackDetailQuery(feedbackId);
  const adminAction = usePostFeedbackAdminActionMutation();
  const softDelete = useSoftDeleteTicketMutation();
  const adminSoftDelete = useAdminSoftDeleteTicketMutation();
  const adminHardDelete = useAdminHardDeleteTicketMutation();
  // Typed-confirmation modal state for the admin hard-delete flow.
  // Two state flags to avoid an extra component: open=true shows the
  // overlay, ``hardDeleteInput`` holds the typed text; we accept only
  // exact "DELETE" to prevent accidental clicks.
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false);
  const [hardDeleteInput, setHardDeleteInput] = useState("");
  const uploadAttachment = useUploadChatAttachmentMutation();
  const stream = useChatRunStream({ bindings, sessionId: feedbackId });

  // Controlled composer + voice flow — same UX as the new-feedback
  // sheet so the reply experience inside an open ticket matches the
  // first-turn capture. Voice transcripts land in ``composerValue``
  // for inline edit before the user hits Send.
  const [composerValue, setComposerValue] = useState("");
  const [composerAutoFocus, setComposerAutoFocus] = useState(false);
  const voice = useVoiceFlow({
    bindings,
    sessionId: feedbackId,
    onTranscript: (text) => {
      setComposerValue((prev) => (prev ? `${prev} ${text}`.trim() : text));
      setComposerAutoFocus(true);
    },
  });
  useEffect(() => {
    if (composerAutoFocus) {
      const t = window.setTimeout(() => setComposerAutoFocus(false), 50);
      return () => window.clearTimeout(t);
    }
  }, [composerAutoFocus]);

  const isAdmin = useCanTriageFeedback();
  const isOwner = !!(
    detail.data && currentUser && detail.data.user_id === currentUser.id
  );
  const isTerminal = detail.data
    ? _TERMINAL_STATUSES.has(detail.data.status)
    : false;
  const needsUserReply = !!(
    detail.data && detail.data.user_action_required && isOwner
  );

  // Hydrate the stream timeline from the detail payload once per
  // ticket. The streaming hook keeps the running messages array
  // after that — sendMessage appends locally, the SSE turn_done
  // adds the assistant reply, and ticket-detail refetches keep the
  // long-term snapshot in sync with the DB.
  const hydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!detail.data) return;
    const key = `${detail.data.id}::${detail.data.updated_at ?? ""}::${
      (detail.data.messages ?? []).length
    }`;
    if (hydratedRef.current === key) return;
    const hydrated = _hydrateMessages(detail.data.messages ?? null);
    stream.seedConversation({
      messages: hydrated,
      nextState: "awaiting_user",
    });
    hydratedRef.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data?.id, detail.data?.updated_at, detail.data?.messages?.length]);

  const [adminDraft, setAdminDraft] = useState("");

  const onSendAdmin = (): void => {
    const body = adminDraft.trim();
    if (!body) return;
    adminAction.mutate(
      { feedbackId, payload: { message_text: body } },
      {
        onSuccess: () => {
          setAdminDraft("");
          hydratedRef.current = null;
        },
        onError: () => adapter.toast.error(t("feedback.comments.send_error")),
      },
    );
  };

  const onAdminStatusChange = (next: FeedbackStatus): void => {
    if (!detail.data || next === detail.data.status) return;
    adminAction.mutate(
      { feedbackId, payload: { to_status: next } },
      { onSuccess: () => (hydratedRef.current = null) },
    );
  };

  const onSendUser = async (content: string): Promise<void> => {
    await stream.sendMessage(content, "text", null, null);
    hydratedRef.current = null;
  };

  const onAttachFiles = (files: File[]): void => {
    for (const f of files) {
      uploadAttachment.mutate(
        { sessionId: feedbackId, file: f },
        {
          onError: (err) =>
            adapter.toast.error(
              err instanceof Error ? err.message : "Upload failed.",
            ),
        },
      );
    }
  };

  // ZIP download — goes through fetch + bindings auth so it works in
  // hosts using Bearer tokens (a plain ``<a href>`` would never send
  // ``Authorization`` because browser link navigation only forwards
  // cookies, not custom headers).
  const triggerBlobDownload = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const onDownloadOwn = async (): Promise<void> => {
    try {
      const { blob, filename } = await downloadOwnFeedbackBundleViaBindings(
        bindings,
        feedbackId,
      );
      triggerBlobDownload(blob, filename);
    } catch (err) {
      adapter.toast.error(
        err instanceof Error ? err.message : "Download failed.",
      );
    }
  };

  const onDownloadAdmin = async (): Promise<void> => {
    try {
      const { blob, filename } = await downloadFeedbackBundleViaBindings(
        bindings,
        feedbackId,
      );
      triggerBlobDownload(blob, filename);
    } catch (err) {
      adapter.toast.error(
        err instanceof Error ? err.message : "Download failed.",
      );
    }
  };

  const approveSynthesis = useApproveSynthesisMutation();
  const editSynthesis = useEditSynthesisMutation();
  const synthesisBusy =
    approveSynthesis.isPending || editSynthesis.isPending;

  const onApproveSynthesis = async (ts: string): Promise<void> => {
    try {
      await approveSynthesis.mutateAsync({
        sessionId: feedbackId,
        synthesisTs: ts,
      });
      stream.updateSynthesisMsg(ts, { confirmed: true });
      hydratedRef.current = null;
    } catch (err) {
      adapter.toast.error(
        err instanceof Error ? err.message : "Could not approve spec.",
      );
    }
  };

  const onEditSynthesis = async (
    ts: string,
    patch: {
      title?: string;
      summary?: string;
      user_story?: string;
      acceptance_criteria?: string[];
    },
  ): Promise<void> => {
    try {
      const res = await editSynthesis.mutateAsync({
        sessionId: feedbackId,
        synthesisTs: ts,
        patch,
      });
      stream.updateSynthesisMsg(ts, {
        synthesis: res.synthesis as unknown as Parameters<
          typeof stream.updateSynthesisMsg
        >[1]["synthesis"],
      });
      hydratedRef.current = null;
    } catch (err) {
      adapter.toast.error(
        err instanceof Error ? err.message : "Could not save edit.",
      );
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 px-2 pt-2 pb-2 bg-card/50">
        <div className="flex items-center justify-between gap-2">
          {detail.data ? (
            <div className="flex items-center gap-2">
              {detail.data.user_action_required ? (
                <span
                  className="inline-flex h-2 w-2 rounded-full bg-amber-500"
                  title="Action required"
                  aria-label="Action required"
                />
              ) : null}
              <StatusPill status={detail.data.status} />
            </div>
          ) : <span />}
          <div className="flex items-center gap-1">
            {/* Owner inline actions — Download + Delete as icon-only
                ghost buttons so the chat layout below (tray + composer)
                stays clean. Tooltips explain on hover. */}
            {isOwner ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onDownloadOwn}
                  title="Download ZIP"
                  aria-label="Download ZIP"
                  className="h-7 w-7 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                  data-feedback-id="feedback.ticket_detail.download_mine"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Delete ticket"
                  aria-label="Delete ticket"
                  className="h-7 w-7 rounded-md text-destructive hover:bg-destructive/10"
                  disabled={softDelete.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        "Delete this ticket? It will be hidden from your list. Admins can restore or permanently delete it.",
                      )
                    ) {
                      softDelete.mutate(
                        { ticketId: feedbackId },
                        { onSuccess: onBack },
                      );
                    }
                  }}
                  data-feedback-id="feedback.ticket_detail.delete_mine_inline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
        {detail.data ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-[11px] text-muted-foreground">
                {detail.data.ticket_code || "—"}
              </code>
              <h2 className="truncate text-sm font-semibold text-foreground">
                {detail.data.title ?? (
                  <span className="italic text-muted-foreground">
                    (no title yet)
                  </span>
                )}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                {isOwner ? "You" : (
                  <code className="font-mono">{_shortId(detail.data.user_id)}</code>
                )}
              </span>
              {detail.data.created_at ? (
                <span>created {_formatTs(detail.data.created_at)}</span>
              ) : null}
              {detail.data.last_admin_msg_at ? (
                <span className="text-primary">
                  team replied {_formatTs(detail.data.last_admin_msg_at)}
                </span>
              ) : null}
              {detail.data.type ? <span>type: {detail.data.type}</span> : null}
              {detail.data.severity ? (
                <span>severity: {detail.data.severity}</span>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {/* Content sections — admin panel, synthesis, timeline scroll
          inside this padded zone. AttachmentTray + Composer sit
          flush below (same structure as new-feedback) so spacing
          matches pixel-for-pixel between tabs. */}
      {detail.isLoading ? (
        <p className="p-4 text-sm text-muted-foreground">
          {t("feedback.mine.loading")}
        </p>
      ) : detail.isError || !detail.data ? (
        <p className="p-4 text-sm text-destructive">{t("feedback.mine.error")}</p>
      ) : (
        <>
          {/* Padded scrollable middle zone (admin panel + synthesis +
              timeline). Mirrors FeedbackChatSheet body — composer +
              tray sit FLUSH below this. */}
          <div className="flex flex-col gap-2 px-2 pt-2 pb-2 flex-1 min-h-0 overflow-y-auto">
          {/* ── Admin actions panel — ARRIBA, justo bajo el header ─ */}
          {isAdmin ? (
            <details
              className="rounded-md bg-primary/10 p-2"
              open
            >
              <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-primary">
                Admin actions
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">Status</span>
                    <select
                      value={detail.data.status}
                      disabled={adminAction.isPending}
                      onChange={(e) =>
                        onAdminStatusChange(e.target.value as FeedbackStatus)
                      }
                      data-feedback-id="feedback.ticket_detail.status_select"
                      className="rounded-md bg-secondary px-1.5 py-0.5 text-xs"
                    >
                      {_ADMIN_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onDownloadAdmin}
                    data-feedback-id="feedback.ticket_detail.download"
                  >
                    <Download className="h-3 w-3 mr-1" /> ZIP
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    disabled={adminSoftDelete.isPending}
                    onClick={() => {
                      if (confirm("Soft-delete this ticket? (reversible via /restore)")) {
                        adminSoftDelete.mutate(
                          { ticketId: feedbackId },
                          { onSuccess: onBack },
                        );
                      }
                    }}
                    data-feedback-id="feedback.ticket_detail.delete"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Soft delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive border border-destructive/40 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => {
                      setHardDeleteInput("");
                      setHardDeleteOpen(true);
                    }}
                    data-feedback-id="feedback.ticket_detail.hard_delete"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Hard delete
                  </Button>
                </div>
                <Textarea
                  value={adminDraft}
                  onChange={(e) => setAdminDraft(e.target.value)}
                  placeholder="Reply as admin · this lands inside the chat and the LLM sees it on the next user turn"
                  rows={2}
                  maxLength={5000}
                  disabled={adminAction.isPending}
                  data-feedback-id="feedback.ticket_detail.admin_draft"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={onSendAdmin}
                    disabled={adminAction.isPending || adminDraft.trim().length === 0}
                    data-feedback-id="feedback.ticket_detail.admin_send"
                  >
                    <Send className="mr-1 h-3.5 w-3.5" />
                    {adminAction.isPending
                      ? t("feedback.comments.sending")
                      : "Inject into chat"}
                  </Button>
                </div>
              </div>
            </details>
          ) : null}

          {/* ── Action-required banner (owner only) ──────────────── */}
          {needsUserReply ? (
            <div className="flex items-center gap-2 rounded-md bg-amber-500/15 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">The team is waiting for your reply.</span>{" "}
                Send a message below to continue the conversation.
              </span>
            </div>
          ) : null}

          {/* ── Conversation timeline (synthesis cards live inline) ─ */}
          <ChatTimeline
            messages={stream.messages}
            isThinking={stream.state === "bot_thinking"}
            thinkingLabel="Thinking…"
            onApproveSynthesis={isOwner ? onApproveSynthesis : undefined}
            onEditSynthesis={isOwner ? onEditSynthesis : undefined}
            synthesisBusy={synthesisBusy}
          />
          {stream.error ? (
            <div className="mx-4 my-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {stream.error}
            </div>
          ) : null}
          </div>

          {/* ── Attachment tray (screenshot + uploaded files) ──── */}
          <AttachmentTray
            sessionId={feedbackId}
            screenshotBlob={null}
            captureMode="page"
            elementSelector={null}
            canRemove={isOwner}
            includeScreenshots={true}
          />

          {/* Owner actions (Delete + Download ZIP) moved up to the
                 header strip so the tray + composer stack stays
                 visually identical to the new-feedback tab. */}

          {/* ── Owner reply composer — SAME pill as new-feedback ──
                 incluyendo paperclip + mic + send con misma morfología
                 brand. Voice flow propio (useVoiceFlow) porque
                 TicketDetail vive fuera de useFeedbackChat. */}
          {isOwner && !isTerminal ? (
            voice.state === "recording" || voice.state === "transcribing" ? (
              <VoiceRecorder
                state={
                  voice.state === "transcribing" ? "transcribing" : "recording"
                }
                duration_ms={voice.duration_ms}
                getAudioLevels={voice.getAudioLevels}
                onStop={() => void voice.stopVoice()}
                onCancel={voice.cancelVoice}
              />
            ) : (
              <Composer
                onSend={async (content) => {
                  await onSendUser(content);
                  setComposerValue("");
                }}
                disabled={stream.state === "bot_thinking"}
                placeholder={
                  needsUserReply
                    ? "Reply to the team's question…"
                    : "Continue the conversation…"
                }
                onAttachFiles={onAttachFiles}
                attachDisabled={uploadAttachment.isPending}
                onVoiceToggle={() => void voice.startVoice()}
                value={composerValue}
                onValueChange={setComposerValue}
                autoFocus={composerAutoFocus}
              />
            )
          ) : null}
          {voice.error ? (
            <p
              className="mx-3 text-[10px] text-destructive"
              data-feedback-id="feedback.ticket_detail.voice_error"
            >
              {voice.error}
            </p>
          ) : null}

          {/* ── Owner footer (terminal — just the read-only label;
                 the Delete button moved up to the always-visible
                 owner row next to Download ZIP). */}
          {isOwner && isTerminal ? (
            <div className="flex items-center justify-end gap-2 pt-2">
              <span className="text-[10px] italic text-muted-foreground">
                Ticket is {detail.data.status} — closed for replies.
              </span>
            </div>
          ) : null}
        </>
      )}

      {/* ── Admin hard-delete typed-confirmation modal ──────────────
             Sits at the bottom of the component tree (rendered as a
             portal-style fixed overlay) so it covers the sheet. The
             user must type the literal "DELETE" string before the
             permanent action is enabled — prevents accidental clicks
             that would unwind the audit trail and S3 attachments. */}
      {hardDeleteOpen && typeof document !== "undefined"
        ? createPortal(
        <div
          className="rl3-feedback-scope dark fixed inset-0 z-[2147483600] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setHardDeleteOpen(false)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="w-full max-w-md rounded-lg border border-destructive/50 bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-destructive">
              Permanently delete this ticket?
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              This drops the ticket row + every S3 attachment + the chat
              history. <span className="font-semibold">Not reversible.</span>{" "}
              Prefer "Soft delete" unless you are certain.
            </p>
            <p className="mt-3 text-xs">
              To confirm, type <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">DELETE</code> below:
            </p>
            <input
              type="text"
              value={hardDeleteInput}
              onChange={(e) => setHardDeleteInput(e.target.value)}
              autoFocus
              className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono outline-none focus:border-destructive"
              placeholder="DELETE"
              data-feedback-id="feedback.ticket_detail.hard_delete_confirm_input"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setHardDeleteOpen(false)}
                disabled={adminHardDelete.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={
                  hardDeleteInput !== "DELETE" || adminHardDelete.isPending
                }
                onClick={() => {
                  adminHardDelete.mutate(
                    { ticketId: feedbackId },
                    {
                      onSuccess: () => {
                        setHardDeleteOpen(false);
                        onBack();
                      },
                      onError: (err) =>
                        adapter.toast.error(
                          err instanceof Error
                            ? err.message
                            : "Hard delete failed.",
                        ),
                    },
                  );
                }}
                data-feedback-id="feedback.ticket_detail.hard_delete_confirm"
              >
                <Trash2 className="h-3 w-3 mr-1" /> Permanently delete
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )
      : null}
    </div>
  );
}
