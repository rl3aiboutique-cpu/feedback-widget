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

import { Sparkles } from "lucide-react";
import { type ReactElement, useEffect, useRef } from "react";

import { ChatBubble } from "./ChatBubble";
import type { ChatMessage } from "./types";

export interface ChatTimelineProps {
  messages: ChatMessage[];
  /** Backend is mid-stream — show a thinking indicator. */
  isThinking?: boolean;
  /** Optional label rendered with the thinking indicator (e.g. "Sintetizando…"). */
  thinkingLabel?: string;
}

export function ChatTimeline({
  messages,
  isThinking = false,
  thinkingLabel,
}: ChatTimelineProps): ReactElement {
  const endRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new messages or thinking-state changes. Deps are
  // used as triggers, not values — same pattern as iter's CopilotChatPanel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps drive scroll-to-bottom on change, the effect body itself only reads the ref
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isThinking]);

  const isEmpty = messages.length === 0 && !isThinking;
  const hasOnlyGreeting =
    messages.length === 1 && messages[0]?.role === "assistant" && !isThinking;

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {messages.map((m, idx) => (
        <ChatBubble key={`${m.role}-${m.ts}-${idx}`} role={m.role} text={m.text} />
      ))}
      {isThinking ? <_ThinkingIndicator label={thinkingLabel} /> : null}
      {(isEmpty || hasOnlyGreeting) ? <_HelperHint /> : null}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}

function _HelperHint(): ReactElement {
  return (
    <div className="mx-auto mt-2 flex max-w-[85%] flex-col items-center gap-1 rounded-xl border border-dashed border-input/50 bg-muted/20 px-4 py-3 text-center">
      <Sparkles className="h-4 w-4 text-primary/70" aria-hidden="true" />
      <p className="text-xs text-muted-foreground">
        Te haré 1-2 preguntas cortas para entender qué buscas. Empieza
        contándome qué pasó.
      </p>
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
