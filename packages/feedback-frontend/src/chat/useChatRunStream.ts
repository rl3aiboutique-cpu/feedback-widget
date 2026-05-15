/**
 * SSE consumer for POST /chat/sessions/{sid}/messages.
 *
 * The backend streams strict JSON per turn (D-015) as a sequence of:
 *
 *   delta          — accumulates raw JSON characters (NOT rendered)
 *   turn_done      — carries the parsed turn dict
 *   synthesizing   — server is persisting the final synthesis
 *   synthesis      — carries the final synthesis dict
 *   error          — terminal failure
 *
 * We can't use the native EventSource because it doesn't support
 * custom headers (CSRF, Authorization) and only allows GET. So we
 * fetch with `body` and parse the SSE frames manually from the
 * ReadableStream — same pattern as `client/iter.ts`.
 */

import { useCallback, useRef, useState } from "react";

import type { FeedbackHostBindings } from "../adapter";
import { newIdempotencyKey } from "../client/idempotency";
import type { ChatMessage, ChatState, ChatTurn, Synthesis } from "./types";

export interface ChatRunStreamResult {
  state: ChatState;
  messages: ChatMessage[];
  /** Raw streaming JSON buffer — internal, NOT shown to the user. */
  partial_text: string;
  synthesis: Synthesis | null;
  error: string | null;
  sendMessage: (content: string, via?: "text" | "voice") => Promise<void>;
  reset: () => void;
  /** Seed the timeline with the initial assistant greeting. */
  pushAssistantGreeting: (text: string) => void;
  /** Append a synthetic assistant turn (used by the Ajustar flow to
   * re-inject the bot back into the conversation without a server roundtrip). */
  pushAssistantMessage: (text: string) => void;
  /** Force the state machine into a given state — escape hatch for terminal
   * transitions driven by the parent hook (confirm / adjust). */
  setStateExternal: (next: ChatState) => void;
  /** Drop the synthesis payload — used after Ajustar so the next synthesize
   * turn lands on a clean slot. */
  clearSynthesis: () => void;
  /** Replace the entire timeline + synthesis with a server-provided
   * snapshot. Used by `loadConversation` to rebuild a chat sheet that
   * the user resumed mid-conversation (S3C). */
  seedConversation: (args: {
    messages: ChatMessage[];
    synthesis?: Synthesis | null;
    nextState?: ChatState;
  }) => void;
}

interface UseChatRunStreamArgs {
  bindings: FeedbackHostBindings;
  /** Null until the session has been created. */
  sessionId: string | null;
}

function _base(b: FeedbackHostBindings): string {
  return b.apiBaseUrl.replace(/\/$/, "");
}

function _prefix(b: FeedbackHostBindings): string {
  return b.apiPathPrefix ?? "/api/v1/feedback";
}

async function _authHeaders(b: FeedbackHostBindings): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const csrf = await b.getCsrfToken();
    if (csrf) out["X-CSRF-Token"] = csrf;
  } catch {
    // host's broken CSRF callback shouldn't tank the request
  }
  if (b.authHeader) {
    try {
      const auth = await b.authHeader();
      if (auth) out.Authorization = auth;
    } catch {
      /* same — degrade gracefully */
    }
  }
  return out;
}

interface SseFrame {
  event: string;
  data: unknown;
}

function _parseSseFrame(raw: string): SseFrame | null {
  if (raw.startsWith(":")) return null; // heartbeat / comment
  let event: string | null = null;
  let dataStr: string | null = null;
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataStr = (dataStr ?? "") + line.slice(5).trim();
    }
  }
  if (!event || dataStr === null) return null;
  try {
    return { event, data: JSON.parse(dataStr) };
  } catch {
    return null;
  }
}

export function useChatRunStream(args: UseChatRunStreamArgs): ChatRunStreamResult {
  const { bindings, sessionId } = args;
  const [state, setState] = useState<ChatState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partial_text, setPartialText] = useState("");
  const [synthesis, setSynthesis] = useState<Synthesis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle");
    setMessages([]);
    setPartialText("");
    setSynthesis(null);
    setError(null);
  }, []);

  const pushAssistantGreeting = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: "assistant", text, ts: Date.now() }]);
    setState("awaiting_user");
  }, []);

  const pushAssistantMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: "assistant", text, ts: Date.now() }]);
  }, []);

  const setStateExternal = useCallback((next: ChatState) => {
    setState(next);
  }, []);

  const clearSynthesis = useCallback(() => {
    setSynthesis(null);
  }, []);

  const seedConversation = useCallback(
    (args: {
      messages: ChatMessage[];
      synthesis?: Synthesis | null;
      nextState?: ChatState;
    }) => {
      abortRef.current?.abort();
      abortRef.current = null;
      setMessages(args.messages);
      setSynthesis(args.synthesis ?? null);
      setPartialText("");
      setError(null);
      setState(args.nextState ?? "awaiting_user");
    },
    [],
  );

  const sendMessage = useCallback(
    async (content: string, via: "text" | "voice" = "text") => {
      if (!sessionId) {
        setError("session not initialised");
        setState("error");
        return;
      }
      const trimmed = content.trim();
      if (!trimmed) return;

      // Append user turn immediately for instant feedback.
      setMessages((prev) => [...prev, { role: "user", text: trimmed, ts: Date.now() }]);
      setPartialText("");
      setError(null);
      setState("bot_thinking");

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const url =
        `${_base(bindings)}${_prefix(bindings)}` +
        `/chat/sessions/${encodeURIComponent(sessionId)}/messages`;

      try {
        const resp = await fetch(url, {
          method: "POST",
          credentials: "include",
          signal: ctrl.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "Idempotency-Key": newIdempotencyKey(),
            ...(await _authHeaders(bindings)),
          },
          body: JSON.stringify({ content: trimmed, via }),
        });
        if (!resp.ok) {
          const detail = await resp.text().catch(() => "");
          throw new Error(`chat stream failed (${resp.status}): ${detail || resp.statusText}`);
        }
        if (!resp.body) {
          throw new Error("chat stream: no response body");
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let bufferedPartial = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let split = buffer.indexOf("\n\n");
          while (split !== -1) {
            const raw = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            const frame = _parseSseFrame(raw);
            if (frame) {
              if (frame.event === "delta") {
                const txt = (frame.data as { text?: string })?.text ?? "";
                bufferedPartial += txt;
                setPartialText(bufferedPartial);
              } else if (frame.event === "turn_done") {
                const turn = (frame.data as { turn?: ChatTurn })?.turn;
                if (turn) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      text: turn.reply,
                      ts: Date.now(),
                      mode: turn.mode,
                      covered: turn.covered,
                      active_branch: turn.active_branch,
                      inferred: turn.inferred,
                    },
                  ]);
                  bufferedPartial = "";
                  setPartialText("");
                  // If the turn is in synthesize mode, the server will
                  // emit a `synthesizing` event next — leave the state
                  // alone and let that branch flip it.
                  if (turn.mode !== "synthesize") {
                    setState("awaiting_user");
                  }
                }
              } else if (frame.event === "synthesizing") {
                setState("synthesizing");
              } else if (frame.event === "synthesis") {
                const data = (frame.data as { data?: Synthesis })?.data;
                if (data) {
                  setSynthesis(data);
                  setState("confirming");
                }
              } else if (frame.event === "error") {
                const detail = (frame.data as { detail?: string })?.detail ?? "stream error";
                setError(detail);
                setState("error");
              }
            }
            split = buffer.indexOf("\n\n");
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(String((err as Error).message ?? err));
        setState("error");
      } finally {
        abortRef.current = null;
      }
    },
    [bindings, sessionId],
  );

  return {
    state,
    messages,
    partial_text,
    synthesis,
    error,
    sendMessage,
    reset,
    pushAssistantGreeting,
    pushAssistantMessage,
    setStateExternal,
    clearSynthesis,
    seedConversation,
  };
}
