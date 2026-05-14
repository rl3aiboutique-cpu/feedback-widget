/**
 * Single chat message bubble for the chat-first feedback flow.
 *
 * Voice is neutral (no avatar / name) per D-011. User bubbles right-
 * aligned with primary tint; assistant bubbles left-aligned, muted bg.
 *
 * S3E adds a third role — `"admin"` — for admin replies inside the
 * `TicketDetail` thread (Mis feedbacks → ticket view). From the
 * submitter's perspective: his own comments render with `role="user"`
 * (right, primary tint), admin replies render with `role="admin"`
 * (left, distinct violet tint + "Equipo" badge).
 *
 * Tailwind classes only — no inline styles (per codi-react rules).
 */

import { Users } from "lucide-react";
import type { ReactElement } from "react";

export interface ChatBubbleProps {
  role: "user" | "assistant" | "admin";
  text: string;
  /** Optional caption shown above admin bubbles (e.g. "Equipo · 2026-05-13"). */
  caption?: string;
}

export function ChatBubble({ role, text, caption }: ChatBubbleProps): ReactElement {
  const isUser = role === "user";
  const isAdmin = role === "admin";
  const isAssistant = role === "assistant";

  const bubbleClass = isUser
    ? "border-primary/30 bg-primary/10 text-foreground"
    : isAdmin
      ? "border-violet-500/40 bg-violet-500/10 text-foreground"
      : "border-input bg-muted/40 text-foreground";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="flex max-w-[85%] flex-col gap-1">
        {isAdmin && caption ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-700">
            <Users className="h-3 w-3" aria-hidden="true" />
            {caption}
          </span>
        ) : null}
        <div
          className={[
            "whitespace-pre-wrap break-words rounded-2xl border px-3 py-2 text-sm leading-snug",
            bubbleClass,
          ].join(" ")}
          data-feedback-id={
            isAdmin
              ? "feedback.chat_bubble.admin"
              : isAssistant
                ? "feedback.chat_bubble.assistant"
                : "feedback.chat_bubble.user"
          }
        >
          {text}
        </div>
      </div>
    </div>
  );
}
