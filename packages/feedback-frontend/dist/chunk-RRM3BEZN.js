import {
  Badge,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  capturePageScreenshot
} from "./chunk-QNP56VDF.js";
import {
  Button,
  DEFAULT_REDACTION_SELECTORS,
  Textarea,
  newIdempotencyKey,
  useFeedbackAdapter,
  useFeedbackBindings
} from "./chunk-62ILORMJ.js";

// src/chat/FeedbackChatSheet.tsx
import { useEffect as useEffect4 } from "react";

// src/chat/ChatTimeline.tsx
import { useEffect, useRef } from "react";

// src/chat/ChatBubble.tsx
import { jsx } from "react/jsx-runtime";
function ChatBubble({ role, text }) {
  const isUser = role === "user";
  return /* @__PURE__ */ jsx("div", { className: `flex w-full ${isUser ? "justify-end" : "justify-start"}`, children: /* @__PURE__ */ jsx(
    "div",
    {
      className: [
        "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl border px-3 py-2 text-sm leading-snug",
        isUser ? "border-primary/30 bg-primary/10 text-foreground" : "border-input bg-muted/40 text-foreground"
      ].join(" "),
      children: text
    }
  ) });
}

// src/chat/ChatTimeline.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function ChatTimeline({
  messages,
  isThinking = false,
  thinkingLabel
}) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isThinking]);
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 px-4 py-3", children: [
    messages.map((m, idx) => /* @__PURE__ */ jsx2(ChatBubble, { role: m.role, text: m.text }, `${m.role}-${m.ts}-${idx}`)),
    isThinking ? /* @__PURE__ */ jsx2(_ThinkingIndicator, { label: thinkingLabel }) : null,
    /* @__PURE__ */ jsx2("div", { ref: endRef, "aria-hidden": "true" })
  ] });
}
function _ThinkingIndicator({ label }) {
  return /* @__PURE__ */ jsx2("div", { className: "flex w-full justify-start", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 rounded-2xl border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground", children: [
    /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", "aria-hidden": "true", children: [
      /* @__PURE__ */ jsx2("span", { className: "h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" }),
      /* @__PURE__ */ jsx2("span", { className: "h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" }),
      /* @__PURE__ */ jsx2("span", { className: "h-1.5 w-1.5 animate-bounce rounded-full bg-current" })
    ] }),
    label ? /* @__PURE__ */ jsx2("span", { className: "text-xs", children: label }) : null
  ] }) });
}

// src/chat/Composer.tsx
import { SendHorizontal } from "lucide-react";
import { useCallback, useState } from "react";
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var DEFAULT_PLACEHOLDER = "Escribe lo que tienes en mente\u2026";
function Composer({ onSend, disabled = false, placeholder }) {
  const [value, setValue] = useState("");
  const submit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue("");
    await onSend(trimmed);
  }, [disabled, onSend, value]);
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void submit();
      }
    },
    [submit]
  );
  return /* @__PURE__ */ jsxs2("div", { className: "flex items-end gap-2 border-t border-input bg-background px-3 py-3", children: [
    /* @__PURE__ */ jsx3(
      Textarea,
      {
        value,
        onChange: (e) => setValue(e.target.value),
        onKeyDown: handleKeyDown,
        disabled,
        placeholder: placeholder ?? DEFAULT_PLACEHOLDER,
        rows: 2,
        className: "max-h-40 min-h-[2.5rem] resize-none text-sm",
        "data-feedback-id": "feedback.chat_composer"
      }
    ),
    /* @__PURE__ */ jsx3(
      Button,
      {
        type: "button",
        size: "sm",
        onClick: () => void submit(),
        disabled: disabled || value.trim().length === 0,
        "aria-label": "Enviar",
        "data-feedback-id": "feedback.chat_send",
        children: /* @__PURE__ */ jsx3(SendHorizontal, { className: "h-4 w-4" })
      }
    )
  ] });
}

// src/chat/PreviousConversations.tsx
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect as useEffect2, useRef as useRef2, useState as useState2 } from "react";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function _statusVariant(status) {
  if (status === "new") return "default";
  if (status === "triaged" || status === "in_progress") return "secondary";
  if (status === "wont_fix") return "destructive";
  return "outline";
}
function _humanStatus(status) {
  switch (status) {
    case "new":
      return "Submitted";
    case "triaged":
      return "Triaged";
    case "in_progress":
      return "In progress";
    case "done":
      return "Resolved";
    case "wont_fix":
      return "Won't fix";
    default:
      return status ?? "\u2014";
  }
}
function _relativeTime(iso) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  if (diffMs < 0) return "ahora";
  const sec = Math.floor(diffMs / 1e3);
  if (sec < 60) return "hace unos s";
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `hace ${day} d`;
  return new Date(then).toLocaleDateString();
}
function PreviousConversations({
  items,
  onSelectItem,
  defaultExpanded = false
}) {
  const [expanded, setExpanded] = useState2(defaultExpanded);
  const appliedRef = useRef2(false);
  useEffect2(() => {
    if (appliedRef.current) return;
    if (items.length === 0) return;
    appliedRef.current = true;
    setExpanded(defaultExpanded);
  }, [items.length, defaultExpanded]);
  const unreadCount = items.reduce((acc, it) => acc + (it.unread_admin_replies ?? 0), 0);
  const hasUnread = unreadCount > 0;
  const count = items.length;
  return /* @__PURE__ */ jsxs3("div", { className: "border-b border-input bg-muted/20", children: [
    /* @__PURE__ */ jsxs3(
      "button",
      {
        type: "button",
        onClick: () => setExpanded((p) => !p),
        "aria-expanded": expanded,
        className: "flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-accent",
        "data-feedback-id": "feedback.chat.previous-toggle",
        children: [
          expanded ? /* @__PURE__ */ jsx4(ChevronUp, { className: "h-4 w-4 shrink-0 text-muted-foreground", "aria-hidden": "true" }) : /* @__PURE__ */ jsx4(ChevronDown, { className: "h-4 w-4 shrink-0 text-muted-foreground", "aria-hidden": "true" }),
          /* @__PURE__ */ jsx4("span", { className: "font-medium", children: "Conversaciones previas" }),
          /* @__PURE__ */ jsxs3("span", { className: "text-xs text-muted-foreground", children: [
            "(",
            count,
            ")"
          ] }),
          hasUnread ? /* @__PURE__ */ jsx4(
            "span",
            {
              className: "ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground",
              "aria-label": `${unreadCount} respuestas sin leer`,
              children: unreadCount
            }
          ) : null
        ]
      }
    ),
    expanded ? /* @__PURE__ */ jsx4("div", { className: "max-h-64 overflow-y-auto px-2 pb-2", children: items.length === 0 ? /* @__PURE__ */ jsx4("p", { className: "px-2 py-3 text-xs text-muted-foreground", children: "No tienes conversaciones previas. Empieza una abajo." }) : /* @__PURE__ */ jsx4("ul", { className: "flex flex-col gap-1", children: items.map((it) => {
      const key = it.kind === "submitted" ? `s-${it.feedback_id}` : `c-${it.session_id}`;
      const unread = (it.unread_admin_replies ?? 0) > 0;
      return /* @__PURE__ */ jsx4("li", { children: /* @__PURE__ */ jsxs3(
        "button",
        {
          type: "button",
          onClick: () => onSelectItem(it),
          className: "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent",
          "data-feedback-id": "feedback.chat.previous-row",
          children: [
            it.kind === "submitted" && it.ticket_code ? /* @__PURE__ */ jsx4("code", { className: "shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[10px]", children: it.ticket_code }) : null,
            /* @__PURE__ */ jsx4(Badge, { variant: _statusVariant(it.status), className: "shrink-0 text-[10px]", children: _humanStatus(it.status) }),
            /* @__PURE__ */ jsx4("span", { className: "flex-1 truncate font-medium", children: it.title }),
            /* @__PURE__ */ jsx4("span", { className: "shrink-0 text-[10px] text-muted-foreground", children: _relativeTime(it.updated_at) }),
            unread ? /* @__PURE__ */ jsx4(
              "span",
              {
                "aria-label": "respuesta sin leer",
                className: "h-2 w-2 shrink-0 rounded-full bg-destructive"
              }
            ) : null
          ]
        }
      ) }, key);
    }) }) }) : null
  ] });
}

// src/chat/SynthesisCard.tsx
import { Check, Pencil } from "lucide-react";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function SynthesisCard({
  synthesis,
  onConfirm,
  onAdjust,
  busy = false
}) {
  return /* @__PURE__ */ jsxs4(
    "div",
    {
      className: "mx-4 my-3 flex flex-col gap-3 rounded-lg border border-input bg-card p-4 shadow-sm",
      "data-feedback-id": "feedback.chat_synthesis_card",
      children: [
        /* @__PURE__ */ jsx5("h3", { className: "text-base font-bold text-foreground", children: synthesis.title }),
        /* @__PURE__ */ jsx5("p", { className: "text-sm text-muted-foreground", children: synthesis.summary }),
        /* @__PURE__ */ jsx5("blockquote", { className: "border-l-2 border-primary pl-3 text-sm italic text-foreground", children: synthesis.user_story }),
        synthesis.acceptance_criteria.length > 0 ? /* @__PURE__ */ jsxs4("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx5("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Criterios de aceptaci\xF3n" }),
          /* @__PURE__ */ jsx5("ul", { className: "list-disc space-y-1 pl-5 text-sm text-foreground", children: synthesis.acceptance_criteria.map((ac, idx) => /* @__PURE__ */ jsx5("li", { children: ac }, `ac-${idx}-${ac.slice(0, 16)}`)) })
        ] }) : null,
        synthesis.open_questions.length > 0 ? /* @__PURE__ */ jsxs4("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx5("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Preguntas abiertas" }),
          /* @__PURE__ */ jsx5("ul", { className: "list-disc space-y-1 pl-5 text-sm text-muted-foreground", children: synthesis.open_questions.map((q, idx) => /* @__PURE__ */ jsx5("li", { children: q }, `oq-${idx}-${q.slice(0, 16)}`)) })
        ] }) : null,
        /* @__PURE__ */ jsxs4("div", { className: "mt-1 flex items-center justify-end gap-2 border-t border-input pt-3", children: [
          /* @__PURE__ */ jsxs4(
            Button,
            {
              type: "button",
              variant: "secondary",
              size: "sm",
              onClick: onAdjust,
              disabled: busy,
              "data-feedback-id": "feedback.chat_synthesis_adjust",
              children: [
                /* @__PURE__ */ jsx5(Pencil, { className: "mr-1 h-4 w-4", "aria-hidden": "true" }),
                "Ajustar"
              ]
            }
          ),
          /* @__PURE__ */ jsxs4(
            Button,
            {
              type: "button",
              size: "sm",
              onClick: onConfirm,
              disabled: busy,
              "data-feedback-id": "feedback.chat_synthesis_confirm",
              children: [
                /* @__PURE__ */ jsx5(Check, { className: "mr-1 h-4 w-4", "aria-hidden": "true" }),
                "Confirmar"
              ]
            }
          )
        ] })
      ]
    }
  );
}

// src/chat/useFeedbackChat.ts
import { useCallback as useCallback3, useRef as useRef4, useState as useState4 } from "react";

// src/chat/useChatRunStream.ts
import { useCallback as useCallback2, useRef as useRef3, useState as useState3 } from "react";
function _base(b) {
  return b.apiBaseUrl.replace(/\/$/, "");
}
function _prefix(b) {
  return b.apiPathPrefix ?? "/api/v1/feedback";
}
async function _authHeaders(b) {
  const out = {};
  try {
    const csrf = await b.getCsrfToken();
    if (csrf) out["X-CSRF-Token"] = csrf;
  } catch {
  }
  if (b.authHeader) {
    try {
      const auth = await b.authHeader();
      if (auth) out.Authorization = auth;
    } catch {
    }
  }
  return out;
}
function _parseSseFrame(raw) {
  if (raw.startsWith(":")) return null;
  let event = null;
  let dataStr = null;
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
function useChatRunStream(args) {
  const { bindings, sessionId } = args;
  const [state, setState] = useState3("idle");
  const [messages, setMessages] = useState3([]);
  const [partial_text, setPartialText] = useState3("");
  const [synthesis, setSynthesis] = useState3(null);
  const [error, setError] = useState3(null);
  const abortRef = useRef3(null);
  const reset = useCallback2(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle");
    setMessages([]);
    setPartialText("");
    setSynthesis(null);
    setError(null);
  }, []);
  const pushAssistantGreeting = useCallback2((text) => {
    setMessages((prev) => [...prev, { role: "assistant", text, ts: Date.now() }]);
    setState("awaiting_user");
  }, []);
  const pushAssistantMessage = useCallback2((text) => {
    setMessages((prev) => [...prev, { role: "assistant", text, ts: Date.now() }]);
  }, []);
  const setStateExternal = useCallback2((next) => {
    setState(next);
  }, []);
  const clearSynthesis = useCallback2(() => {
    setSynthesis(null);
  }, []);
  const seedConversation = useCallback2(
    (args2) => {
      abortRef.current?.abort();
      abortRef.current = null;
      setMessages(args2.messages);
      setSynthesis(args2.synthesis ?? null);
      setPartialText("");
      setError(null);
      setState(args2.nextState ?? "awaiting_user");
    },
    []
  );
  const sendMessage = useCallback2(
    async (content) => {
      if (!sessionId) {
        setError("session not initialised");
        setState("error");
        return;
      }
      const trimmed = content.trim();
      if (!trimmed) return;
      setMessages((prev) => [...prev, { role: "user", text: trimmed, ts: Date.now() }]);
      setPartialText("");
      setError(null);
      setState("bot_thinking");
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const url = `${_base(bindings)}${_prefix(bindings)}/chat/sessions/${encodeURIComponent(sessionId)}/messages`;
      try {
        const resp = await fetch(url, {
          method: "POST",
          credentials: "include",
          signal: ctrl.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            "Idempotency-Key": newIdempotencyKey(),
            ...await _authHeaders(bindings)
          },
          body: JSON.stringify({ content: trimmed, via: "text" })
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
                const txt = frame.data?.text ?? "";
                bufferedPartial += txt;
                setPartialText(bufferedPartial);
              } else if (frame.event === "turn_done") {
                const turn = frame.data?.turn;
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
                      inferred: turn.inferred
                    }
                  ]);
                  bufferedPartial = "";
                  setPartialText("");
                  if (turn.mode !== "synthesize") {
                    setState("awaiting_user");
                  }
                }
              } else if (frame.event === "synthesizing") {
                setState("synthesizing");
              } else if (frame.event === "synthesis") {
                const data = frame.data?.data;
                if (data) {
                  setSynthesis(data);
                  setState("confirming");
                }
              } else if (frame.event === "error") {
                const detail = frame.data?.detail ?? "stream error";
                setError(detail);
                setState("error");
              }
            }
            split = buffer.indexOf("\n\n");
          }
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(String(err.message ?? err));
        setState("error");
      } finally {
        abortRef.current = null;
      }
    },
    [bindings, sessionId]
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
    seedConversation
  };
}

// src/chat/useFeedbackChat.ts
function _buildAutoContext(args) {
  const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}` : "";
  const route = typeof window !== "undefined" ? window.location.pathname + window.location.search + window.location.hash : null;
  const viewport = typeof window !== "undefined" ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio } : null;
  return {
    url,
    route,
    viewport,
    app_version: args.appVersion || null,
    git_commit_sha: args.gitSha || null,
    user_role: args.userRole,
    console_tail: [],
    // Batch A: client captures screenshot but does NOT upload. Batch B
    // adds the multipart/form-data upload → returns attachment_id →
    // wires it through this field. TODO(S3-B).
    screenshot_attachment_id: null
  };
}
function useFeedbackChat() {
  const bindings = useFeedbackBindings();
  const adapter = useFeedbackAdapter();
  const user = adapter.useCurrentUser();
  const [sessionId, setSessionId] = useState4(null);
  const stream = useChatRunStream({ bindings, sessionId });
  const [overrideState, setOverrideState] = useState4(null);
  const [openError, setOpenError] = useState4(null);
  const openingRef = useRef4(false);
  const openSheet = useCallback3(async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOverrideState("opening");
    setOpenError(null);
    try {
      try {
        await capturePageScreenshot({
          redactionSelectors: DEFAULT_REDACTION_SELECTORS
        });
      } catch (err) {
        if (typeof console !== "undefined") {
          console.warn("[feedback-chat] screenshot capture failed", err);
        }
      }
      const auto_context = _buildAutoContext({
        appVersion: adapter.appVersion,
        gitSha: adapter.gitSha,
        userRole: user?.role ?? null
      });
      const base = bindings.apiBaseUrl.replace(/\/$/, "");
      const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
      const url = `${base}${prefix}/chat/sessions`;
      const headers = { "Content-Type": "application/json" };
      try {
        const csrf = await bindings.getCsrfToken();
        if (csrf) headers["X-CSRF-Token"] = csrf;
      } catch {
      }
      if (bindings.authHeader) {
        try {
          const auth = await bindings.authHeader();
          if (auth) headers.Authorization = auth;
        } catch {
        }
      }
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ mode: "capture", auto_context })
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        throw new Error(`create session failed (${resp.status}): ${detail || resp.statusText}`);
      }
      const body = await resp.json();
      setSessionId(body.session_id);
      stream.pushAssistantGreeting(body.greeting);
      setOverrideState(null);
    } catch (err) {
      setOpenError(String(err.message ?? err));
      setOverrideState("error");
    } finally {
      openingRef.current = false;
    }
  }, [adapter.appVersion, adapter.gitSha, bindings, stream, user?.role]);
  const closeSheet = useCallback3(() => {
    stream.reset();
    setSessionId(null);
    setOverrideState(null);
    setOpenError(null);
    openingRef.current = false;
  }, [stream]);
  const sendUserMessage = useCallback3(
    async (content) => {
      await stream.sendMessage(content);
    },
    [stream]
  );
  const confirmSynthesis = useCallback3(async () => {
    stream.setStateExternal("finalizing");
    await new Promise((r) => setTimeout(r, 250));
    stream.pushAssistantMessage("\xA1Gracias! Hemos registrado tu feedback.");
    stream.setStateExternal("done");
  }, [stream]);
  const loadConversation = useCallback3(
    async (item) => {
      if (item.kind === "submitted") {
        const code = item.ticket_code ?? "\u2014";
        const status = item.status ?? "\u2014";
        const text = `Este es el ticket ${code} \u2014 ${item.title}. Estado: ${status}. (Los comentarios inline llegan en S3E.)`;
        setSessionId(null);
        stream.seedConversation({
          messages: [{ role: "assistant", text, ts: Date.now() }],
          synthesis: null,
          nextState: "awaiting_user"
        });
        setOverrideState(null);
        setOpenError(null);
        return;
      }
      const sid = item.session_id;
      if (!sid) {
        setOpenError("session id missing on previous conversation item");
        setOverrideState("error");
        return;
      }
      setOverrideState("opening");
      setOpenError(null);
      try {
        const base = bindings.apiBaseUrl.replace(/\/$/, "");
        const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
        const url = `${base}${prefix}/chat/sessions/${encodeURIComponent(sid)}`;
        const headers = {};
        try {
          const csrf = await bindings.getCsrfToken();
          if (csrf) headers["X-CSRF-Token"] = csrf;
        } catch {
        }
        if (bindings.authHeader) {
          try {
            const auth = await bindings.authHeader();
            if (auth) headers.Authorization = auth;
          } catch {
          }
        }
        const resp = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers
        });
        if (!resp.ok) {
          const detail = await resp.text().catch(() => "");
          throw new Error(`resume session failed (${resp.status}): ${detail || resp.statusText}`);
        }
        const body = await resp.json();
        const messages = [];
        for (const m of body.messages ?? []) {
          const role = m.role === "user" || m.role === "assistant" ? m.role : null;
          if (!role) continue;
          const text = typeof m.text === "string" ? m.text : "";
          const ts = typeof m.ts === "string" ? Date.parse(m.ts) || Date.now() : Date.now();
          const msg = { role, text, ts };
          if (role === "assistant") {
            if (m.mode === "discover" || m.mode === "synthesize") msg.mode = m.mode;
            if (typeof m.active_branch === "string") msg.active_branch = m.active_branch;
            if (m.covered && typeof m.covered === "object") {
              msg.covered = m.covered;
            }
            if (m.inferred && typeof m.inferred === "object") {
              msg.inferred = m.inferred;
            }
          }
          messages.push(msg);
        }
        const synth = body.synthesis_json ?? null;
        const nextState = synth && body.status === "awaiting_confirm" ? "confirming" : "awaiting_user";
        setSessionId(sid);
        stream.seedConversation({ messages, synthesis: synth, nextState });
        setOverrideState(null);
      } catch (err) {
        setOpenError(String(err.message ?? err));
        setOverrideState("error");
      }
    },
    [bindings, stream]
  );
  const newConversation = useCallback3(async () => {
    stream.reset();
    setSessionId(null);
    setOverrideState(null);
    setOpenError(null);
    await openSheet();
  }, [stream, openSheet]);
  const adjustSynthesis = useCallback3(() => {
    stream.clearSynthesis();
    stream.pushAssistantMessage("\xBFQu\xE9 cambiar\xEDas del resumen?");
    stream.setStateExternal("awaiting_user");
  }, [stream]);
  const effectiveState = overrideState ?? stream.state;
  const effectiveError = openError ?? stream.error;
  return {
    state: effectiveState,
    messages: stream.messages,
    partialText: stream.partial_text,
    synthesis: stream.synthesis,
    error: effectiveError,
    openSheet,
    closeSheet,
    sendUserMessage,
    confirmSynthesis,
    adjustSynthesis,
    loadConversation,
    newConversation
  };
}

// src/chat/useMyConversations.ts
import { useCallback as useCallback4, useEffect as useEffect3, useState as useState5 } from "react";
function _base2(b) {
  return b.apiBaseUrl.replace(/\/$/, "");
}
function _prefix2(b) {
  return b.apiPathPrefix ?? "/api/v1/feedback";
}
async function _authHeaders2(b) {
  const out = {};
  try {
    const csrf = await b.getCsrfToken();
    if (csrf) out["X-CSRF-Token"] = csrf;
  } catch {
  }
  if (b.authHeader) {
    try {
      const auth = await b.authHeader();
      if (auth) out.Authorization = auth;
    } catch {
    }
  }
  return out;
}
async function _getJson(b, path) {
  const url = `${_base2(b)}${_prefix2(b)}${path}`;
  const headers = await _authHeaders2(b);
  const resp = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`GET ${path} failed (${resp.status}): ${detail || resp.statusText}`);
  }
  return await resp.json();
}
function _mapInProgress(s) {
  return {
    kind: "in_progress",
    session_id: s.session_id,
    title: s.last_message_preview?.trim() || "Conversaci\xF3n en curso",
    status: "in_progress",
    updated_at: s.updated_at,
    // In-progress chats have no admin comments yet — the unread cue
    // only applies to submitted tickets.
    unread_admin_replies: 0
  };
}
function _mapSubmitted(f) {
  const unread = f.status === "in_progress" ? 1 : 0;
  return {
    kind: "submitted",
    feedback_id: f.id,
    ticket_code: f.ticket_code,
    title: f.title,
    status: f.status,
    updated_at: f.updated_at ?? f.created_at ?? (/* @__PURE__ */ new Date(0)).toISOString(),
    unread_admin_replies: unread
  };
}
function useMyConversations() {
  const bindings = useFeedbackBindings();
  const [items, setItems] = useState5([]);
  const [isLoading, setIsLoading] = useState5(true);
  const [error, setError] = useState5(null);
  const refetch = useCallback4(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [inProgressRes, submittedRes] = await Promise.allSettled([
        _getJson(bindings, "/chat/sessions/in-progress"),
        _getJson(bindings, "/mine?limit=25")
      ]);
      const merged = [];
      if (inProgressRes.status === "fulfilled") {
        for (const s of inProgressRes.value.sessions) {
          merged.push(_mapInProgress(s));
        }
      } else if (typeof console !== "undefined") {
        console.warn("[feedback-chat] in-progress fetch failed", inProgressRes.reason);
      }
      if (submittedRes.status === "fulfilled") {
        for (const f of submittedRes.value) {
          merged.push(_mapSubmitted(f));
        }
      } else if (typeof console !== "undefined") {
        console.warn("[feedback-chat] /mine fetch failed", submittedRes.reason);
      }
      merged.sort((a, b) => a.updated_at < b.updated_at ? 1 : -1);
      setItems(merged);
      if (inProgressRes.status === "rejected" && submittedRes.status === "rejected") {
        setError(String(inProgressRes.reason?.message ?? "fetch failed"));
      }
    } catch (err) {
      setError(String(err.message ?? err));
    } finally {
      setIsLoading(false);
    }
  }, [bindings]);
  useEffect3(() => {
    void refetch();
  }, [refetch]);
  return { items, isLoading, error, refetch };
}

// src/chat/FeedbackChatSheet.tsx
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
var _SHEET_WIDTH = "w-full sm:max-w-md md:max-w-lg lg:max-w-[480px]";
function _isComposerDisabled(state) {
  return state === "opening" || state === "bot_thinking" || state === "synthesizing" || state === "confirming" || state === "finalizing" || state === "done";
}
function _isComposerHidden(state) {
  return state === "confirming" || state === "finalizing" || state === "done";
}
function _thinkingLabel(state) {
  if (state === "synthesizing") return "Sintetizando\u2026";
  if (state === "opening") return "Preparando\u2026";
  return void 0;
}
function _isThinking(state) {
  return state === "bot_thinking" || state === "synthesizing" || state === "opening";
}
function _shouldExpand(items) {
  if (items.some((it) => (it.unread_admin_replies ?? 0) > 0)) return true;
  const first = items[0];
  if (first && first.kind === "in_progress") return true;
  return false;
}
function FeedbackChatSheet({ open, onOpenChange }) {
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
    synthesis
  } = chat;
  const conversations = useMyConversations();
  useEffect4(() => {
    if (open) {
      void openSheet();
    } else {
      closeSheet();
    }
  }, [open]);
  useEffect4(() => {
    if (state !== "done") return;
    const t = window.setTimeout(() => onOpenChange(false), 3e3);
    return () => window.clearTimeout(t);
  }, [state, onOpenChange]);
  return /* @__PURE__ */ jsx6(Sheet, { open, onOpenChange, children: /* @__PURE__ */ jsxs5(
    SheetContent,
    {
      side: "right",
      className: `${_SHEET_WIDTH} flex h-full flex-col gap-0 p-0`,
      "data-feedback-widget-root": "true",
      children: [
        /* @__PURE__ */ jsxs5(SheetHeader, { className: "border-b border-input", children: [
          /* @__PURE__ */ jsx6(SheetTitle, { children: "Feedback" }),
          /* @__PURE__ */ jsx6(SheetDescription, { className: "text-xs", children: "Cu\xE9ntame qu\xE9 tienes en mente. Pulsa Enter para enviar." })
        ] }),
        /* @__PURE__ */ jsx6(
          PreviousConversations,
          {
            items: conversations.items,
            onSelectItem: (it) => void loadConversation(it),
            defaultExpanded: _shouldExpand(conversations.items)
          }
        ),
        /* @__PURE__ */ jsxs5("div", { className: "flex-1 overflow-y-auto", children: [
          /* @__PURE__ */ jsx6(
            ChatTimeline,
            {
              messages,
              isThinking: _isThinking(state),
              thinkingLabel: _thinkingLabel(state)
            }
          ),
          error ? /* @__PURE__ */ jsx6("div", { className: "mx-4 my-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive", children: error }) : null,
          state === "confirming" && synthesis !== null ? /* @__PURE__ */ jsx6(
            SynthesisCard,
            {
              synthesis,
              onConfirm: () => void confirmSynthesis(),
              onAdjust: adjustSynthesis,
              busy: false
            }
          ) : null
        ] }),
        _isComposerHidden(state) ? null : /* @__PURE__ */ jsx6(Composer, { onSend: sendUserMessage, disabled: _isComposerDisabled(state) })
      ]
    }
  ) });
}

export {
  SynthesisCard,
  FeedbackChatSheet
};
//# sourceMappingURL=chunk-RRM3BEZN.js.map