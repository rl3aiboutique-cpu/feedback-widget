/**
 * Chat-first feedback sheet — v1.0.0 (D-007, D-011, D-012, D-015).
 *
 * Single Sheet on the right with three regions:
 *
 *   header   — title + close affordance (provided by SheetContent)
 *   timeline — scrolling chat history (auto-scrolls on new messages)
 *   composer — textarea + send button, sticky bottom
 *
 * On open we:
 *   1. capture an auto-screenshot client-side (D-007)
 *   2. POST /chat/sessions to create a session
 *   3. seed the timeline with the server-provided greeting
 *
 * Synthesis card + Ajustar flow + screenshot upload are Batch B.
 */

import { type ReactElement, useEffect } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { ChatTimeline } from "./ChatTimeline";
import { Composer } from "./Composer";
import { PreviousConversations } from "./PreviousConversations";
import { SynthesisCard } from "./SynthesisCard";
import type { ChatState, PreviousConversationItem } from "./types";
import { useFeedbackChat } from "./useFeedbackChat";
import { useMyConversations } from "./useMyConversations";

export interface FeedbackChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const _SHEET_WIDTH = "w-full sm:max-w-md md:max-w-lg lg:max-w-[480px]";

function _isComposerDisabled(state: ChatState): boolean {
  return (
    state === "opening" ||
    state === "bot_thinking" ||
    state === "synthesizing" ||
    state === "confirming" ||
    state === "finalizing" ||
    state === "done"
  );
}

/** Composer is hidden (not just disabled) while the user is reviewing
 * the synthesis card so the only choice is Confirmar / Ajustar. The
 * thank-you state (done) also hides the composer so it doesn't flash
 * before the sheet auto-closes. */
function _isComposerHidden(state: ChatState): boolean {
  return state === "confirming" || state === "finalizing" || state === "done";
}

function _thinkingLabel(state: ChatState): string | undefined {
  if (state === "synthesizing") return "Sintetizando…";
  if (state === "opening") return "Preparando…";
  return undefined;
}

function _isThinking(state: ChatState): boolean {
  return state === "bot_thinking" || state === "synthesizing" || state === "opening";
}

/** Decide whether the "Conversaciones previas" header should open
 * automatically when the sheet appears. Per F1 in the task brief, the
 * header is collapsed by default unless we have a strong cue:
 *
 *  - any item has unread admin replies (red badge), OR
 *  - the most recent item is an in-progress chat the user can resume.
 *
 * Computed off the items list AT the moment of opening — using
 * useState's initialiser pattern in the consumer is overkill, so we
 * just derive a key from the open state. */
function _shouldExpand(items: PreviousConversationItem[]): boolean {
  if (items.some((it) => (it.unread_admin_replies ?? 0) > 0)) return true;
  const first = items[0];
  if (first && first.kind === "in_progress") return true;
  return false;
}

export function FeedbackChatSheet({ open, onOpenChange }: FeedbackChatSheetProps): ReactElement {
  const chat = useFeedbackChat();
  const {
    openSheet,
    closeSheet,
    sendUserMessage,
    confirmSynthesis,
    adjustSynthesis,
    loadConversation,
    state,
    messages,
    error,
    synthesis,
  } = chat;
  const conversations = useMyConversations();

  // Drive the session lifecycle from the open prop. We intentionally
  // only fire openSheet on the open→true edge; openSheet itself guards
  // against re-entry via openingRef so re-renders are harmless, but we
  // still don't want it in the deps array because that would re-fire on
  // every render of the parent.
  // biome-ignore lint/correctness/useExhaustiveDependencies: openSheet/closeSheet are stable callbacks; firing only on the `open` edge is intentional
  useEffect(() => {
    if (open) {
      void openSheet();
    } else {
      closeSheet();
    }
  }, [open]);

  // Auto-dismiss when the bot says goodbye. 3 s gives the user time to
  // read the thank-you turn before the sheet vanishes.
  useEffect(() => {
    if (state !== "done") return;
    const t = window.setTimeout(() => onOpenChange(false), 3000);
    return () => window.clearTimeout(t);
  }, [state, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={`${_SHEET_WIDTH} flex h-full flex-col gap-0 p-0`}
        data-feedback-widget-root="true"
      >
        <SheetHeader className="border-b border-input">
          <SheetTitle>Feedback</SheetTitle>
          <SheetDescription className="text-xs">
            Cuéntame qué tienes en mente. Pulsa Enter para enviar.
          </SheetDescription>
        </SheetHeader>

        <PreviousConversations
          items={conversations.items}
          onSelectItem={(it) => void loadConversation(it)}
          defaultExpanded={_shouldExpand(conversations.items)}
        />

        <div className="flex-1 overflow-y-auto">
          <ChatTimeline
            messages={messages}
            isThinking={_isThinking(state)}
            thinkingLabel={_thinkingLabel(state)}
          />
          {error ? (
            <div className="mx-4 my-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
          {state === "confirming" && synthesis !== null ? (
            <SynthesisCard
              synthesis={synthesis}
              onConfirm={() => void confirmSynthesis()}
              onAdjust={adjustSynthesis}
              busy={false}
            />
          ) : null}
        </div>

        {_isComposerHidden(state) ? null : (
          <Composer onSend={sendUserMessage} disabled={_isComposerDisabled(state)} />
        )}
      </SheetContent>
    </Sheet>
  );
}
