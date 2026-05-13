/**
 * Single chat message bubble for the chat-first feedback flow.
 *
 * Voice is neutral (no avatar / name) per D-011. User bubbles right-
 * aligned with primary tint; assistant bubbles left-aligned, muted bg.
 *
 * Tailwind classes only — no inline styles (per codi-react rules).
 */

import type { ReactElement } from "react";

export interface ChatBubbleProps {
  role: "user" | "assistant";
  text: string;
}

export function ChatBubble({ role, text }: ChatBubbleProps): ReactElement {
  const isUser = role === "user";
  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl border px-3 py-2 text-sm leading-snug",
          isUser
            ? "border-primary/30 bg-primary/10 text-foreground"
            : "border-input bg-muted/40 text-foreground",
        ].join(" ")}
      >
        {text}
      </div>
    </div>
  );
}
