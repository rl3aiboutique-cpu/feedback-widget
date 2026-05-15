/**
 * Single chat message bubble for the chat-first feedback flow.
 *
 * Modern UX (post-baseline-audit 2026-05-15):
 *
 *   - Assistant bubbles carry an RL3 gradient avatar pill on the left
 *     so the source of each reply is unambiguous; the bubble itself
 *     uses an elevated surface (zinc-800/60 dark, zinc-100 light) with
 *     a softened top-left corner.
 *   - User bubbles stay right-aligned with a primary-tinted surface
 *     and a softened top-right corner, matching the conversational
 *     direction.
 *   - Admin bubbles (S3E TicketDetail thread) get a violet tint + a
 *     "Equipo" badge.
 *
 * Tailwind classes only — no inline styles (codi-react rule).
 */

import { Users } from "lucide-react";
import type { ReactElement } from "react";

export interface ChatBubbleProps {
  role: "user" | "assistant" | "admin";
  text: string;
  /** Optional caption shown above admin bubbles (e.g. "Equipo · 2026-05-13"). */
  caption?: string;
}

function AssistantAvatar(): ReactElement {
  return (
    <div
      className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-primary/90 to-primary/60 text-[10px] font-bold text-primary-foreground shadow-sm"
      aria-hidden="true"
    >
      RL3
    </div>
  );
}

export function ChatBubble({ role, text, caption }: ChatBubbleProps): ReactElement {
  const isUser = role === "user";
  const isAdmin = role === "admin";
  const isAssistant = role === "assistant";

  // Surface styling per role. Assistant uses an elevated muted surface
  // with a softened top-left corner so it visually anchors next to the
  // avatar. User mirrors with top-right. Admin keeps its violet tint.
  const bubbleClass = isUser
    ? "rounded-2xl rounded-tr-md border-primary/30 bg-primary/10 text-foreground"
    : isAdmin
      ? "rounded-2xl rounded-tl-md border-violet-500/40 bg-violet-500/10 text-foreground"
      : "rounded-2xl rounded-tl-md border-input/60 bg-muted/60 text-foreground shadow-sm";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      {(isAssistant || isAdmin) ? <div className="mr-2 mt-0.5"><AssistantAvatar /></div> : null}
      <div className={`flex max-w-[78%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {isAdmin && caption ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-700">
            <Users className="h-3 w-3" aria-hidden="true" />
            {caption}
          </span>
        ) : null}
        <div
          className={[
            "whitespace-pre-wrap break-words border px-3.5 py-2 text-sm leading-relaxed",
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
