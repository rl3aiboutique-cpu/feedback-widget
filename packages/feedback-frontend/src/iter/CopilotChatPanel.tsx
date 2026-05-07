/**
 * Right panel of the v0.7 focus view — a real chat interface with
 * the BA Copilot.
 *
 * Layout:
 *
 *   ┌───────────────────────────────────────────┐
 *   │ 🤖 BA Copilot                  [✓ ready]  │  ← header
 *   ├───────────────────────────────────────────┤
 *   │ chronological timeline of bubbles         │
 *   │ (auto-scroll to bottom on new content;    │
 *   │  user-scroll above bottom pauses auto)    │
 *   ├───────────────────────────────────────────┤
 *   │ [textarea: escribe tu desacuerdo…]  [↗]   │  ← input
 *   └───────────────────────────────────────────┘
 *
 * Sources of bubbles:
 *
 *   1. `useChatTimeline` events (persisted) — version_done,
 *      user_message, assumption.
 *   2. Live synthetic system bubbles, recomputed each render from
 *      `IterStreamState` + auto-iter countdown:
 *        - 'Incorporando feedback…' while a stream is running.
 *        - Auto-iter countdown bubble when 0 open assumptions and
 *          a version exists.
 *        - '¿Marco como listo?' proactive prompt, same trigger.
 *
 * Send:
 *   - Pressing Enter (without Shift) submits the textarea.
 *   - Submitting fires `onRunIteration(message)` — auto-fire path,
 *     no separate Run iteration button.
 *   - The textarea is disabled while a stream is in flight.
 *
 * v0.7.0 — replaces ChatStrip + QuestionStackPanel.
 */

import { Loader2, Send } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { IterAssumptionRead } from "../client/types";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { AssumptionCard } from "./AssumptionCard";
import { ChatBubble } from "./ChatBubble";
import type { ChatTimelineEvent } from "./useChatTimeline";
import type { IterStreamStatus } from "./useIterRunStream";

export interface CopilotChatPanelProps {
  events: ChatTimelineEvent[];
  /** Stream status — drives the live "Incorporando feedback…"
   * bubble. */
  streamStatus: IterStreamStatus;
  /** Whether the user is allowed to chat. False during finalized /
   * abandoned. */
  disabled: boolean;
  /** Mark-ready proactive bubble fires when this is true (open === 0
   * AND a version exists AND not finalized). */
  showReadyPrompt: boolean;
  /** Auto-iter countdown — bubble shows when this is non-null. */
  autoIterCountdown: number | null;
  isComplete: boolean;
  /** Called when user resolves an inline assumption card. */
  onResolveAssumption: (
    assumptionId: string,
    body: { status: "confirmed" | "corrected" | "irrelevant"; user_response?: string },
  ) => Promise<unknown> | undefined;
  /** Called when user clicks "Skip" on a card. */
  onSkipAssumption: (a: IterAssumptionRead) => Promise<unknown> | undefined;
  /** Send button / Enter key handler — fires an iter with the
   * textarea content as `user_message`. */
  onSend: (message: string) => Promise<unknown> | undefined;
  /** Cancel auto-iter countdown. */
  onCancelAutoIter: () => void;
  /** Mark ready / Abandon — surfaced in the ready prompt bubble. */
  onMarkReady: () => Promise<unknown> | undefined;
}

export function CopilotChatPanel(props: CopilotChatPanelProps): ReactElement {
  const {
    events,
    streamStatus,
    disabled,
    showReadyPrompt,
    autoIterCountdown,
    isComplete,
    onResolveAssumption,
    onSkipAssumption,
    onSend,
    onCancelAutoIter,
    onMarkReady,
  } = props;

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const userScrolledUpRef = useRef(false);

  // Auto-scroll to bottom on new event UNLESS the user scrolled up.
  // We measure "near bottom" with a 5% threshold of scrollHeight so
  // small wiggles don't flip the flag.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = fromBottom > el.clientHeight * 0.05;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps used as triggers, not values — re-run scroll-to-bottom whenever any of these changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!userScrolledUpRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events.length, streamStatus, autoIterCountdown, showReadyPrompt]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const submit = async () => {
    const msg = draft.trim();
    if (!msg) return;
    setBusy(true);
    try {
      await onSend(msg);
      setDraft("");
      // Send always scrolls to bottom — user wants to see the
      // response stream in.
      userScrolledUpRef.current = false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden border-l border-input"
      aria-label="BA Copilot"
    >
      <header className="flex items-center gap-2 border-b border-input px-3 py-2">
        <span aria-hidden="true">🤖</span>
        <span
          className="font-semibold tracking-tight"
          style={{ fontSize: "clamp(0.8rem, 0.7rem + 0.3cqi, 0.95rem)" }}
        >
          BA Copilot
        </span>
        {isComplete ? (
          <span
            className="ml-auto rounded-full bg-emerald-100 px-1.5 py-0.5 font-mono text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200"
            style={{ fontSize: "0.6rem" }}
          >
            ✓ ready
          </span>
        ) : null}
      </header>

      {/* Timeline — scrollable, sticky bottom. */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 min-h-0 overflow-auto p-2.5 space-y-2"
      >
        {events.length === 0 ? (
          <ChatBubble variant="system">
            La conversación arrancará cuando el AI termine de leer tu feedback.
          </ChatBubble>
        ) : null}

        {events.map((ev) => {
          if (ev.kind === "version_done") {
            const v = ev.version;
            return (
              <ChatBubble key={`v-${v.id}`} variant="bot" ts={ev.ts}>
                <div className="space-y-1">
                  <p>
                    <strong className="font-semibold">Spec v{v.version_number}</strong> listo.{" "}
                    {v.changes_summary || "Lo tienes a la izquierda."}
                  </p>
                  {v.is_complete && v.completion_reason ? (
                    <p className="text-emerald-700 dark:text-emerald-300">{v.completion_reason}</p>
                  ) : null}
                </div>
              </ChatBubble>
            );
          }

          if (ev.kind === "user_message") {
            return (
              <ChatBubble key={`u-${ev.versionId}`} variant="user" ts={ev.ts}>
                {ev.message}
              </ChatBubble>
            );
          }

          // assumption — bot bubble with the AssumptionCard inline.
          // The card itself handles open vs resolved rendering and
          // exposes "Change my answer" for re-opening.
          const a = ev.assumption;
          return (
            <ChatBubble key={`a-${a.id}`} variant="bot" ts={ev.ts}>
              <div className="-m-1">
                <AssumptionCard
                  assumption={a}
                  disabled={disabled}
                  onResolve={(body) => onResolveAssumption(a.id, body)}
                  onSkip={() => onSkipAssumption(a)}
                />
              </div>
            </ChatBubble>
          );
        })}

        {/* Live synthetic events — recomputed each render. */}
        {streamStatus === "running" ? (
          <ChatBubble variant="bot">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden="true" />
              Incorporando feedback…
            </div>
          </ChatBubble>
        ) : null}

        {autoIterCountdown !== null ? (
          <ChatBubble variant="bot">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-primary" aria-hidden="true" />
              <span>
                Auto-iter en <strong>{autoIterCountdown}s</strong>.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={onCancelAutoIter}
                className="ml-auto h-6 px-2"
                style={{ fontSize: "0.65rem" }}
                title="Cancelar (Esc)"
              >
                Cancelar
              </Button>
            </div>
          </ChatBubble>
        ) : showReadyPrompt && !isComplete ? (
          <ChatBubble variant="bot">
            <div className="space-y-1.5">
              <p>
                Has resuelto todas las preguntas. ¿<strong>Marcamos como listo</strong> o seguimos
                refinando?
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onMarkReady()}
                  className="h-7 px-2"
                  style={{ fontSize: "0.7rem" }}
                >
                  Mark ready
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  style={{ fontSize: "0.7rem" }}
                  onClick={() => {
                    // No-op CTA — just makes it clear the user can
                    // keep typing in the chat below.
                    scrollRef.current?.scrollTo({
                      top: scrollRef.current.scrollHeight,
                      behavior: "smooth",
                    });
                  }}
                >
                  Seguir refinando
                </Button>
              </div>
            </div>
          </ChatBubble>
        ) : null}
      </div>

      {/* Chat input — fixed at the bottom of the panel. */}
      <div className="flex items-end gap-2 border-t border-input p-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          disabled={disabled || busy || streamStatus === "running"}
          placeholder={
            disabled
              ? "Sesión cerrada."
              : "Escribe tu desacuerdo, idea nueva o cambio (Enter envía, Shift+Enter salto)…"
          }
          className="flex-1 resize-none"
          style={{ fontSize: "0.8rem" }}
        />
        <Button
          size="sm"
          onClick={submit}
          disabled={disabled || busy || streamStatus === "running" || !draft.trim()}
          title="Enviar (Enter)"
          className="shrink-0"
        >
          {busy || streamStatus === "running" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </section>
  );
}
