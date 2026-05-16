/**
 * Chat-first feedback sheet — v1.0.0 shell-hybrid (S3F).
 *
 * Re-architected per spec
 * `docs/specs/2026-05-14-feedback-widget-shell-hybrid-design.md`:
 * the OLD widget chrome (header + tabs + CAPTURE picker + footer) is
 * preserved and now wraps the chat zone. The form-fields area is the
 * only thing the chat replaces.
 *
 * Layout:
 *
 *   ┌─ SheetHeader (RL3 mark + title + description) ─────────┐
 *   │ ┌─ FeedbackTabs (Nuevo feedback / Mis feedbacks) ────┐ │
 *   │ ┌─ CapturePicker (Whole page / Select element) ────-─┐ │  ← compose tab only
 *   │ ┌─ Chat scroll area (timeline + synthesis card) ─-───┐ │
 *   │ ┌─ Composer (textarea + send) ────────────-──────────┐ │  ← discovery states
 *   │ ┌─ FooterActions (Sigamos iterando / Confirmar) ─────┐ │  ← synthesis states
 *   └────────────────────────────────────────────────────────┘
 *
 * Bottom buttons live in `FooterActions`, NOT inside `SynthesisCard`.
 * Visibility is purely state-driven by `useFeedbackChat.state`.
 *
 * The "Conversaciones previas" header (S3C `<PreviousConversations>`)
 * is replaced by the Mis feedbacks tab + `<MineFeedTab>` (S3F).
 */

import { type ReactElement, useCallback, useEffect, useState } from "react";

import { useFeedbackAdapter } from "../FeedbackProvider";
import { Rl3Mark } from "../Rl3Mark";
import { useUploadChatAttachmentMutation } from "../adapter";
import {
  useMyPendingActionCount,
  useMyTicketsTotalCount,
} from "../hooks/useMyPendingActionCount";
import { useResizableSheet } from "../hooks/useResizableSheet";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";

import { CapturePicker, type LockedElementInfo } from "./CapturePicker";
import { AttachmentTray } from "./AttachmentTray";
import { ChatTimeline } from "./ChatTimeline";
import { Composer } from "./Composer";
import { FeedbackTabs } from "./FeedbackTabs";
import { FooterActions } from "./FooterActions";
import { MineFeedTab } from "./MineFeedTab";
import { TicketDetail } from "./TicketDetail";
import { VoiceRecorder } from "./VoiceRecorder";
import type { ChatState } from "./types";
import { useFeedbackChat } from "./useFeedbackChat";
import {
  useApproveSynthesisMutation,
  useEditSynthesisMutation,
} from "../adapter";

export interface FeedbackChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** External locked element coming from `FeedbackButton`'s picker
   * round-trip. Mirrored into the hook on every render so the
   * CapturePicker badge and the auto_context payload stay in sync. */
  locked: LockedElementInfo | null;
  /** Hand control back to the parent so it can mount the ElementSelector
   * overlay. The sheet closes (visually) while the picker is on. */
  onActivatePicker: () => void;
  /** Drop the external locked element. Called when the user clicks the
   * ✕ next to the locked-element pill. */
  onClearLocked: () => void;
}

// Sheet width is now driven by ``useResizableSheet`` per the 2026-05-16
// minimalist redesign — the legacy responsive class was replaced by a
// pixel-based width with a drag handle on the left edge. Kept here as
// a doc anchor to make the change easy to grep for during reviews.

function _thinkingLabel(state: ChatState): string | undefined {
  if (state === "synthesizing") return "Sintetizando…";
  if (state === "opening") return "Preparando…";
  return undefined;
}

function _isThinking(state: ChatState): boolean {
  return state === "bot_thinking" || state === "synthesizing" || state === "opening";
}

function _showFooter(state: ChatState): boolean {
  return (
    state === "confirming" ||
    state === "synthesizing" ||
    state === "finalizing" ||
    state === "error"
  );
}

function _showComposer(state: ChatState): boolean {
  return state === "awaiting_user" || state === "user_typing" || state === "bot_thinking";
}

export function FeedbackChatSheet({
  open,
  onOpenChange,
  locked,
  onActivatePicker,
  onClearLocked,
}: FeedbackChatSheetProps): ReactElement {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const chat = useFeedbackChat();
  const mineCount = useMyTicketsTotalCount();
  const mineActionRequired = useMyPendingActionCount();
  const resize = useResizableSheet();
  const uploadAttachment = useUploadChatAttachmentMutation();
  const approveSynthesis = useApproveSynthesisMutation();
  const editSynthesis = useEditSynthesisMutation();
  const {
    openSheet,
    closeSheet,
    sendUserMessage,
    confirmSynthesis,
    abandonSession,
    adjustSynthesis,
    newConversation,
    state,
    messages,
    error,
    synthesis,
    captureMode,
    lockedElement,
    activeTab,
    screenshotBlob,
    clearScreenshot,
    setMode,
    clearLocked: clearHookLocked,
    acceptLocked,
    selectTab,
    voiceState,
    voiceDurationMs,
    voiceError,
    getVoiceAudioLevels,
    startVoice,
    stopVoice,
    cancelVoice,
    composerValue,
    setComposerValue,
    composerAutoFocus,
    sessionId: activeSessionId,
    updateSynthesisMsg,
  } = chat;

  // S3E — when the user picks a row in Mis feedbacks, the right pane
  // swaps from the list to <TicketDetail/>. Local to the sheet because
  // the chat hook is scoped to compose-tab lifecycle.
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);

  // Reset the detail selection when leaving the mine tab so the list
  // is what you see next time you click back in.
  useEffect(() => {
    if (activeTab !== "mine") setSelectedFeedbackId(null);
  }, [activeTab]);

  // Drive the session lifecycle from the open prop. openSheet itself
  // guards against re-entry via openingRef so re-renders are harmless.
  // biome-ignore lint/correctness/useExhaustiveDependencies: openSheet/closeSheet are stable callbacks; firing only on the `open` edge is intentional
  useEffect(() => {
    if (open) {
      void openSheet();
    } else {
      closeSheet();
    }
  }, [open]);

  // Mirror the external `locked` prop coming from FeedbackButton into
  // the hook so CapturePicker + auto_context see the same value.
  // biome-ignore lint/correctness/useExhaustiveDependencies: hook setters are stable; mirroring fires only on locked-prop change
  useEffect(() => {
    if (locked) acceptLocked(locked);
    else clearHookLocked();
  }, [locked]);

  // Auto-dismiss when the bot says goodbye. 3 s gives the user time to
  // read the thank-you turn before the sheet vanishes.
  useEffect(() => {
    if (state !== "done") return;
    const tid = window.setTimeout(() => onOpenChange(false), 3000);
    return () => window.clearTimeout(tid);
  }, [state, onOpenChange]);

  // When the user closes the sheet mid-conversation (NOT after the bot
  // already confirmed), fire-and-forget the abandon endpoint so analytics
  // pick up the drop-off. We explicitly exclude `done` (post-confirm
  // auto-close) and `idle` (never started) to avoid spurious abandons.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && state !== "done" && state !== "idle") {
        void abandonSession();
      }
      onOpenChange(next);
    },
    [state, abandonSession, onOpenChange],
  );

  const synthesisBusy = approveSynthesis.isPending || editSynthesis.isPending;

  const onApproveSynthesis = useCallback(
    async (ts: string) => {
      if (!activeSessionId) return;
      // Forward the locally-captured screenshot so the BE persists it
      // as a SCREENSHOT attachment — without this the TicketDetail
      // view has no visual context of where the user reported from.
      let screenshotB64: string | null = null;
      let screenshotCt: string | null = null;
      if (screenshotBlob) {
        try {
          const buf = await screenshotBlob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let bin = "";
          for (const b of bytes) bin += String.fromCharCode(b);
          screenshotB64 = btoa(bin);
          screenshotCt = screenshotBlob.type || "image/png";
        } catch {
          screenshotB64 = null;
        }
      }
      try {
        await approveSynthesis.mutateAsync({
          sessionId: activeSessionId,
          synthesisTs: ts,
          screenshotB64,
          screenshotContentType: screenshotCt,
        });
        updateSynthesisMsg(ts, { confirmed: true });
      } catch (err) {
        adapter.toast.error(
          err instanceof Error ? err.message : "Could not approve spec.",
        );
      }
    },
    [
      activeSessionId,
      approveSynthesis,
      updateSynthesisMsg,
      adapter.toast,
      screenshotBlob,
    ],
  );

  const onEditSynthesis = useCallback(
    async (
      ts: string,
      patch: {
        title?: string;
        summary?: string;
        user_story?: string;
        acceptance_criteria?: string[];
      },
    ) => {
      if (!activeSessionId) return;
      try {
        const res = await editSynthesis.mutateAsync({
          sessionId: activeSessionId,
          synthesisTs: ts,
          patch,
        });
        updateSynthesisMsg(ts, {
          synthesis: res.synthesis as unknown as Parameters<
            typeof updateSynthesisMsg
          >[1]["synthesis"],
        });
      } catch (err) {
        adapter.toast.error(
          err instanceof Error ? err.message : "Could not save edit.",
        );
      }
    },
    [activeSessionId, editSynthesis, updateSynthesisMsg, adapter.toast],
  );

  // ``synthesis`` is now derived from the latest synthesis msg in
  // ``messages``; the standalone SynthesisCard render outside the
  // timeline was removed in favour of inline timeline bubbles.
  void synthesis;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        widthPx={resize.width}
        isDragging={resize.isDragging}
        onResizeStart={resize.isMobile ? undefined : resize.startResize}
        className="rl3-feedback-scope dark flex h-full flex-col gap-0 border-l border-input/50 bg-background/95 backdrop-blur-xl p-0 shadow-2xl"
        data-feedback-widget-root="true"
      >
        <SheetHeader className="border-b border-input/60 px-4 pt-4 pb-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Rl3Mark className="h-6 w-6 shrink-0" />
            <span>{t("feedback.panel_title")}</span>
          </SheetTitle>
          {/* Minimalist redesign 2026-05-16 — subtitle dropped; the
              greeting bubble already prompts the user and a duplicate
              "Tell us what's on your mind" header just adds vertical
              chrome. ``SheetDescription`` stays as a visually-hidden
              accessibility label for screen readers. */}
          <SheetDescription className="sr-only">
            {t("feedback.panel_description")}
          </SheetDescription>
        </SheetHeader>

        {/* Single-line nav row: tabs left + capture toggle right.
            Saves ~50px of vertical chrome vs. the prior two-row
            layout. The capture controls only render when the user is
            on the "New feedback" tab — they have no meaning on the
            ticket-browsing tab. */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <div className="flex-1 min-w-0">
            <FeedbackTabs
              activeTab={activeTab}
              mineTotalCount={mineCount}
              unreadAdminRepliesCount={mineActionRequired}
              onTabChange={selectTab}
            />
          </div>
          {activeTab === "compose" ? (
            <CapturePicker
              mode={captureMode}
              locked={lockedElement}
              onActivatePicker={onActivatePicker}
              onClearLocked={onClearLocked}
              onModeChange={setMode}
              compact
            />
          ) : null}
        </div>

        {activeTab === "compose" ? (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ChatTimeline
                messages={messages}
                isThinking={_isThinking(state)}
                thinkingLabel={_thinkingLabel(state)}
                onApproveSynthesis={onApproveSynthesis}
                onEditSynthesis={onEditSynthesis}
                synthesisBusy={synthesisBusy}
              />
              {error ? (
                <div className="mx-4 my-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              ) : null}
              {voiceError ? (
                <div className="mx-4 my-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {voiceError}
                </div>
              ) : null}
            </div>

            <AttachmentTray
              sessionId={activeSessionId}
              screenshotBlob={screenshotBlob}
              captureMode={captureMode}
              elementSelector={lockedElement?.selector ?? null}
              onClearScreenshot={clearScreenshot}
            />

            {voiceState === "recording" || voiceState === "transcribing" ? (
              <VoiceRecorder
                state={voiceState === "transcribing" ? "transcribing" : "recording"}
                duration_ms={voiceDurationMs}
                getAudioLevels={getVoiceAudioLevels}
                onStop={() => void stopVoice()}
                onCancel={cancelVoice}
              />
            ) : _showComposer(state) ? (
              <Composer
                onSend={sendUserMessage}
                disabled={state === "bot_thinking"}
                onVoiceToggle={() => void startVoice()}
                onAttachFiles={
                  activeSessionId
                    ? (files) => {
                        for (const f of files) {
                          uploadAttachment.mutate(
                            { sessionId: activeSessionId, file: f },
                            {
                              onError: (err) => {
                                adapter.toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : "Could not upload the file.",
                                );
                              },
                            },
                          );
                        }
                      }
                    : undefined
                }
                attachDisabled={uploadAttachment.isPending}
                value={composerValue}
                onValueChange={setComposerValue}
                autoFocus={composerAutoFocus}
              />
            ) : null}

            {_showFooter(state) ? (
              <FooterActions
                state={state}
                onConfirm={() => void confirmSynthesis()}
                onAdjust={adjustSynthesis}
                onRetry={() => void newConversation()}
              />
            ) : null}
          </>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
            {selectedFeedbackId ? (
              <TicketDetail
                feedbackId={selectedFeedbackId}
                onBack={() => setSelectedFeedbackId(null)}
              />
            ) : (
              <MineFeedTab onSelectFeedback={(fid) => setSelectedFeedbackId(fid)} />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
