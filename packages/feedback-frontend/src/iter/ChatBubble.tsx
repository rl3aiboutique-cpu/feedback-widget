/**
 * Chat bubble primitive — base for the v0.7 Copilot panel.
 *
 * Three variants:
 *
 *   bot     — left-aligned, 🤖 avatar, card-style fill. Used for AI
 *             messages and assumption-cards-in-bubbles.
 *   user    — right-aligned, 👤 avatar, primary-tinted fill.
 *   system  — subtle, centered, italic. Used for synthetic events
 *             (running status, auto-iter countdown, prompt for
 *             Mark ready, etc.).
 *
 * Children are rendered as the bubble body. The bubble owns the
 * avatar + meta (timestamp); callers decide what goes inside.
 *
 * Density-tuned for IDE feel: small font, tight line-height, room
 * for an inline AssumptionCard without making the card cramped.
 *
 * v0.7.0 — Copilot Chat redesign.
 */

import { type ReactElement, type ReactNode, useMemo } from "react";

export type ChatBubbleVariant = "bot" | "user" | "system";

export interface ChatBubbleProps {
  variant: ChatBubbleVariant;
  /** ISO timestamp (or ms epoch); rendered as a tiny "hh:mm" stamp
   * in the bubble's meta line. Optional for system bubbles. */
  ts?: string | number;
  /** Bubble body content. Can be plain text or richer JSX (e.g. an
   * AssumptionCard). */
  children: ReactNode;
  /** Compact variant — used for the resolved-summary collapse so
   * the chat doesn't accumulate huge cards. */
  compact?: boolean;
}

const _AVATAR: Record<ChatBubbleVariant, string> = {
  bot: "🤖",
  user: "👤",
  system: "⏳",
};

export function ChatBubble({
  variant,
  ts,
  children,
  compact = false,
}: ChatBubbleProps): ReactElement {
  const stamp = useMemo(() => _formatStamp(ts), [ts]);

  if (variant === "system") {
    return (
      <div
        className="my-1 flex items-center gap-2 px-2 italic text-muted-foreground"
        style={{ fontSize: "0.65rem" }}
      >
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span aria-hidden="true">{_AVATAR.system}</span>
        <span>{children}</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
    );
  }

  const isBot = variant === "bot";
  return (
    <div className={`flex gap-2 ${isBot ? "" : "flex-row-reverse"}`}>
      <div
        className={[
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          isBot
            ? "bg-primary/10 text-primary"
            : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
        ].join(" ")}
        aria-hidden="true"
        style={{ fontSize: "0.75rem" }}
      >
        {_AVATAR[variant]}
      </div>
      <div
        className={["flex min-w-0 flex-col gap-1", isBot ? "items-start" : "items-end"].join(" ")}
      >
        {stamp ? (
          <span
            className="text-muted-foreground"
            style={{ fontSize: "0.55rem", lineHeight: "1.2" }}
          >
            {stamp}
          </span>
        ) : null}
        <div
          className={[
            "max-w-[90%] rounded-md border leading-snug",
            compact ? "px-2 py-1" : "px-2.5 py-2",
            isBot
              ? "border-input bg-card text-foreground"
              : "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-100",
          ].join(" ")}
          style={{ fontSize: compact ? "0.7rem" : "0.75rem" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function _formatStamp(ts: string | number | undefined): string | null {
  if (ts === undefined) return null;
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  // hh:mm in the user's locale.
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
