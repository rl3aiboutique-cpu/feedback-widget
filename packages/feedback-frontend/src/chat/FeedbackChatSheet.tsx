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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";

import { CapturePicker, type LockedElementInfo } from "./CapturePicker";
import { ChatTimeline } from "./ChatTimeline";
import { Composer } from "./Composer";
import { FeedbackTabs } from "./FeedbackTabs";
import { FooterActions } from "./FooterActions";
import { MineFeedTab } from "./MineFeedTab";
import { SynthesisCard } from "./SynthesisCard";
import { TicketDetail } from "./TicketDetail";
import { VoiceRecorder } from "./VoiceRecorder";
import type { ChatState } from "./types";
import { useFeedbackChat } from "./useFeedbackChat";

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

const _SHEET_WIDTH = "w-full sm:max-w-md md:max-w-lg lg:max-w-[520px]";

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

  const showSynthesis = state === "confirming" && synthesis !== null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className={`${_SHEET_WIDTH} flex h-full flex-col gap-0 p-0`}
        data-feedback-widget-root="true"
      >
        <SheetHeader className="border-b border-input px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Rl3Mark className="h-6 w-6 shrink-0" />
            <span>{t("feedback.panel_title")}</span>
          </SheetTitle>
          <SheetDescription className="text-xs">{t("feedback.panel_description")}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pt-3 pb-2">
          <FeedbackTabs
            activeTab={activeTab}
            // MineFeedTab queries its own count for the empty/loaded UI;
            // the tab badge stays neutral until S3E lands a real count.
            mineTotalCount={0}
            onTabChange={selectTab}
          />
        </div>

        {activeTab === "compose" ? (
          <>
            <div className="px-4 pb-2">
              <CapturePicker
                mode={captureMode}
                locked={lockedElement}
                onActivatePicker={onActivatePicker}
                onClearLocked={onClearLocked}
                onModeChange={setMode}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <ChatTimeline
                messages={messages}
                isThinking={_isThinking(state) || voiceState === "transcribing"}
                thinkingLabel={
                  voiceState === "transcribing" ? "Transcribiendo…" : _thinkingLabel(state)
                }
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
              {showSynthesis ? <SynthesisCard synthesis={synthesis} /> : null}
            </div>

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
