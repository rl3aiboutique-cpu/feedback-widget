/**
 * Scrolling chat timeline for the feedback chat sheet.
 *
 * Auto-scrolls to bottom whenever a new message lands or the bot is
 * thinking. Crucially does NOT render `partial_text` — the streaming
 * delta events carry raw JSON, which the user must never see. We only
 * show a 3-dot thinking indicator while the bot is composing.
 *
 * Empty-state hint (post-baseline-audit 2026-05-15): when the timeline
 * is empty (turn 0) we render a soft helper card below the greeting so
 * the user understands the flow before they start typing — "Te haré
 * 1-2 preguntas para entender qué buscas".
 */

import { type ReactElement, useEffect, useMemo, useRef } from "react";

import { ChatBubble } from "./ChatBubble";
import { SynthesisCard } from "./SynthesisCard";
import type { ChatMessage } from "./types";

export interface ChatTimelineProps {
  messages: ChatMessage[];
  /** Backend is mid-stream — show a thinking indicator. */
  isThinking?: boolean;
  /** Optional label rendered with the thinking indicator (e.g. "Sintetizando…"). */
  thinkingLabel?: string;
  /** Approve a synthesis card by its ts. Omit to render synthesis cards
   *  read-only (e.g. terminal status). */
  onApproveSynthesis?: (ts: string) => void | Promise<void>;
  /** Edit a synthesis card by its ts. Omit to disable manual edit. */
  onEditSynthesis?: (
    ts: string,
    patch: {
      title?: string;
      summary?: string;
      user_story?: string;
      acceptance_criteria?: string[];
    },
  ) => void | Promise<void>;
  /** Disables synthesis-card buttons while a mutation is in-flight. */
  synthesisBusy?: boolean;
}

export function ChatTimeline({
  messages,
  isThinking = false,
  thinkingLabel,
  onApproveSynthesis,
  onEditSynthesis,
  synthesisBusy = false,
}: ChatTimelineProps): ReactElement {
  const endRef = useRef<HTMLDivElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps drive scroll-to-bottom on change, the effect body itself only reads the ref
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isThinking]);

  // Single-card rule (2026-05-16): the user wants ONE canonical spec
  // card in the timeline at any time, not one per iteration. Identify
  // the latest synthesis msg index — all earlier ones get hidden so
  // the user sees only the current state of the spec. The DB still
  // keeps every version (audit + revert) but the UI surfaces the
  // active one only.
  const latestSynthesisIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "synthesis" && messages[i].synthesis) return i;
    }
    return -1;
  }, [messages]);

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {messages.map((m, idx) => {
        if (m.role === "synthesis" && m.synthesis) {
          // Skip non-latest synthesis msgs — the latest one is the
          // canonical spec card; older iterations are noise in the UI.
          if (idx !== latestSynthesisIdx) return null;
          const tsKey = String(m.ts);
          return (
            <SynthesisCard
              key={`synthesis-${tsKey}-${idx}`}
              synthesis={m.synthesis}
              confirmed={m.confirmed === true}
              lockedByOtherWinner={false}
              onApprove={
                onApproveSynthesis
                  ? () => onApproveSynthesis(tsKey)
                  : undefined
              }
              onEdit={
                onEditSynthesis
                  ? (patch) => onEditSynthesis(tsKey, patch)
                  : undefined
              }
              busy={synthesisBusy}
            />
          );
        }
        return (
          <ChatBubble
            key={`${m.role}-${m.ts}-${idx}`}
            role={m.role as "user" | "assistant" | "admin"}
            text={m.text}
          />
        );
      })}
      {isThinking ? <_ThinkingIndicator label={thinkingLabel} /> : null}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}

function _ThinkingIndicator({ label }: { label?: string }): ReactElement {
  return (
    <div className="flex w-full justify-start">
      <div className="flex items-center gap-2 rounded-2xl border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
        </span>
        {label ? <span className="text-xs">{label}</span> : null}
      </div>
    </div>
  );
}
