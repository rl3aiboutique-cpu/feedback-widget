import {
  Badge
} from "./chunk-QNP56VDF.js";
import {
  Button,
  FeedbackApiError,
  Textarea,
  cn,
  redactString,
  useFeedbackAdapter,
  useFeedbackCommentsQuery,
  usePostFeedbackCommentMutation
} from "./chunk-62ILORMJ.js";

// src/version.ts
var VERSION = "0.7.0";

// src/capture/consoleWrap.ts
var DEFAULT_CAPACITY = 50;
var _buffer = [];
var _capacity = DEFAULT_CAPACITY;
var _installed = false;
function _sanitize(args) {
  const parts = args.map((arg) => {
    if (typeof arg === "string") return redactString(arg);
    if (arg === null) return "null";
    if (arg === void 0) return "undefined";
    if (typeof arg === "object") {
      try {
        return redactString(JSON.stringify(arg));
      } catch {
        return Object.prototype.toString.call(arg);
      }
    }
    return redactString(String(arg));
  });
  const joined = parts.join(" ");
  return joined.length > 4096 ? `${joined.slice(0, 4096)}...[truncated]` : joined;
}
function _push(entry) {
  _buffer.push(entry);
  while (_buffer.length > _capacity) _buffer.shift();
}
function installConsoleWrap(capacity = DEFAULT_CAPACITY) {
  if (_installed) return;
  _capacity = capacity;
  _installed = true;
  const originals = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
  };
  for (const level of ["log", "info", "warn", "error"]) {
    const original = originals[level];
    console[level] = function patched(...args) {
      try {
        _push({
          level,
          message: _sanitize(args),
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch {
      }
      return original.apply(console, args);
    };
  }
}
function getConsoleTail() {
  return [..._buffer];
}

// src/capture/networkWrap.ts
var DEFAULT_CAPACITY2 = 20;
var DEFAULT_SUCCESS_CAPACITY = 30;
var SLOW_SUCCESS_THRESHOLD_MS = 1e3;
var _buffer2 = [];
var _success_buffer = [];
var _capacity2 = DEFAULT_CAPACITY2;
var _success_capacity = DEFAULT_SUCCESS_CAPACITY;
var _installed2 = false;
function _push2(entry) {
  _buffer2.push(entry);
  while (_buffer2.length > _capacity2) _buffer2.shift();
}
function _pushSuccess(entry) {
  _success_buffer.push(entry);
  while (_success_buffer.length > _success_capacity) _success_buffer.shift();
}
function _excerpt(text) {
  const redacted = redactString(text);
  return redacted.length > 512 ? `${redacted.slice(0, 512)}...[truncated]` : redacted;
}
function installNetworkWrap(capacity = DEFAULT_CAPACITY2) {
  if (_installed2 || typeof window === "undefined") return;
  _capacity2 = capacity;
  _installed2 = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(input, init) {
    const start = performance.now();
    const method = (init?.method ?? "GET").toUpperCase();
    const url = typeof input === "string" ? input : input.toString();
    let response;
    try {
      response = await originalFetch(input, init);
    } catch (err) {
      const duration2 = performance.now() - start;
      _push2({
        method,
        url,
        status: 0,
        duration_ms: Math.round(duration2),
        response_excerpt: _excerpt(String(err)),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      throw err;
    }
    const duration = performance.now() - start;
    if (response.status >= 400) {
      let excerpt = "";
      try {
        excerpt = await response.clone().text();
      } catch {
        excerpt = "(no body)";
      }
      _push2({
        method,
        url,
        status: response.status,
        duration_ms: Math.round(duration),
        response_excerpt: _excerpt(excerpt),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else if (duration >= SLOW_SUCCESS_THRESHOLD_MS) {
      _pushSuccess({
        method,
        url,
        status: response.status,
        duration_ms: Math.round(duration),
        response_excerpt: "",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return response;
  };
}
function getNetworkTail() {
  return [..._buffer2];
}
function getNetworkSuccessTail() {
  return [..._success_buffer];
}

// src/capture/errorWrap.ts
var DEFAULT_CAPACITY3 = 20;
var MAX_STACK_BYTES = 4096;
var _buffer3 = [];
var _capacity3 = DEFAULT_CAPACITY3;
var _installed3 = false;
function _truncStack(stack) {
  if (!stack) return null;
  const redacted = redactString(stack);
  if (redacted.length > MAX_STACK_BYTES) {
    return `${redacted.slice(0, MAX_STACK_BYTES)}...[truncated]`;
  }
  return redacted;
}
function _push3(entry) {
  _buffer3.push(entry);
  while (_buffer3.length > _capacity3) _buffer3.shift();
}
function installErrorWrap(capacity = DEFAULT_CAPACITY3) {
  if (_installed3 || typeof window === "undefined") return;
  _capacity3 = capacity;
  _installed3 = true;
  window.addEventListener("error", (ev) => {
    _push3({
      kind: "error",
      message: redactString(String(ev.message ?? ev.error?.message ?? "(no message)")),
      source: ev.filename ? redactString(ev.filename) : null,
      lineno: typeof ev.lineno === "number" ? ev.lineno : null,
      colno: typeof ev.colno === "number" ? ev.colno : null,
      stack: _truncStack(ev.error?.stack),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    let message = "(no message)";
    let stack = null;
    if (reason instanceof Error) {
      message = reason.message || reason.name || message;
      stack = _truncStack(reason.stack);
    } else if (typeof reason === "string") {
      message = reason;
    } else {
      try {
        message = JSON.stringify(reason);
      } catch {
        message = Object.prototype.toString.call(reason);
      }
    }
    _push3({
      kind: "unhandledrejection",
      message: redactString(message),
      source: null,
      lineno: null,
      colno: null,
      stack,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
}
function getErrorsTail() {
  return [..._buffer3];
}

// src/Rl3Mark.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function Rl3Mark({
  className,
  gradientId = "rl3-feedback-grad"
}) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      className,
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 32 32",
      fill: "none",
      role: "img",
      "aria-label": "RL3",
      children: [
        /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs(
          "linearGradient",
          {
            id: gradientId,
            x1: "0",
            y1: "0",
            x2: "32",
            y2: "32",
            gradientUnits: "userSpaceOnUse",
            children: [
              /* @__PURE__ */ jsx("stop", { offset: "0%", stopColor: "#14b8a6" }),
              /* @__PURE__ */ jsx("stop", { offset: "100%", stopColor: "#0ea5e9" })
            ]
          }
        ) }),
        /* @__PURE__ */ jsx("rect", { width: "32", height: "32", rx: "8", fill: `url(#${gradientId})` }),
        /* @__PURE__ */ jsx(
          "text",
          {
            x: "16",
            y: "22",
            textAnchor: "middle",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: "15",
            fontWeight: "800",
            fill: "#ffffff",
            letterSpacing: "-0.5",
            children: "RL3"
          }
        )
      ]
    }
  );
}

// src/ui/input.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
function Input({ className, type, ...props }) {
  return /* @__PURE__ */ jsx2(
    "input",
    {
      type,
      "data-slot": "input",
      className: cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      ),
      ...props
    }
  );
}

// src/ui/select.tsx
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function Select({ ...props }) {
  return /* @__PURE__ */ jsx3(SelectPrimitive.Root, { "data-slot": "select", ...props });
}
function SelectValue({ ...props }) {
  return /* @__PURE__ */ jsx3(SelectPrimitive.Value, { "data-slot": "select-value", ...props });
}
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs2(
    SelectPrimitive.Trigger,
    {
      "data-slot": "select-trigger",
      "data-size": size,
      className: cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      ),
      ...props,
      children: [
        children,
        /* @__PURE__ */ jsx3(SelectPrimitive.Icon, { asChild: true, children: /* @__PURE__ */ jsx3(ChevronDownIcon, { className: "size-4 opacity-50" }) })
      ]
    }
  );
}
function SelectContent({
  className,
  children,
  position = "popper",
  align = "center",
  ...props
}) {
  return /* @__PURE__ */ jsx3(SelectPrimitive.Portal, { children: /* @__PURE__ */ jsxs2(
    SelectPrimitive.Content,
    {
      "data-slot": "select-content",
      className: cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
        position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      ),
      position,
      align,
      ...props,
      children: [
        /* @__PURE__ */ jsx3(SelectScrollUpButton, {}),
        /* @__PURE__ */ jsx3(
          SelectPrimitive.Viewport,
          {
            className: cn(
              "p-1",
              position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1"
            ),
            children
          }
        ),
        /* @__PURE__ */ jsx3(SelectScrollDownButton, {})
      ]
    }
  ) });
}
function SelectItem({
  className,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs2(
    SelectPrimitive.Item,
    {
      "data-slot": "select-item",
      className: cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      ),
      ...props,
      children: [
        /* @__PURE__ */ jsx3("span", { className: "absolute right-2 flex size-3.5 items-center justify-center", children: /* @__PURE__ */ jsx3(SelectPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx3(CheckIcon, { className: "size-4" }) }) }),
        /* @__PURE__ */ jsx3(SelectPrimitive.ItemText, { children })
      ]
    }
  );
}
function SelectScrollUpButton({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx3(
    SelectPrimitive.ScrollUpButton,
    {
      "data-slot": "select-scroll-up-button",
      className: cn("flex cursor-default items-center justify-center py-1", className),
      ...props,
      children: /* @__PURE__ */ jsx3(ChevronUpIcon, { className: "size-4" })
    }
  );
}
function SelectScrollDownButton({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx3(
    SelectPrimitive.ScrollDownButton,
    {
      "data-slot": "select-scroll-down-button",
      className: cn("flex cursor-default items-center justify-center py-1", className),
      ...props,
      children: /* @__PURE__ */ jsx3(ChevronDownIcon, { className: "size-4" })
    }
  );
}

// src/comments/CommentThread.tsx
import { Send } from "lucide-react";
import { useState } from "react";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function _fmt(dt) {
  if (!dt) return "\u2014";
  return dt.slice(0, 16).replace("T", " ");
}
function CommentThread({ feedbackId }) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const currentUser = adapter.useCurrentUser();
  const query = useFeedbackCommentsQuery(feedbackId);
  const post = usePostFeedbackCommentMutation();
  const [draft, setDraft] = useState("");
  const onSend = () => {
    const body = draft.trim();
    if (!body) return;
    post.mutate(
      { feedbackId, body },
      {
        onSuccess: () => {
          setDraft("");
        },
        onError: (err) => {
          if (err instanceof FeedbackApiError) {
            if (err.status === 429) {
              const seconds = err.retryAfter ?? "?";
              adapter.toast.error(t("feedback.toast_error_429", { seconds: String(seconds) }));
              return;
            }
            if (err.status === 401 || err.status === 403) {
              adapter.toast.error(t("feedback.comments.send_unauthorized"));
              return;
            }
          }
          adapter.toast.error(t("feedback.comments.send_error"));
        }
      }
    );
  };
  return /* @__PURE__ */ jsxs3("section", { className: "space-y-2", children: [
    /* @__PURE__ */ jsx4("h4", { className: "text-xs font-semibold uppercase tracking-wide text-foreground", children: t("feedback.comments.thread_title") }),
    query.isLoading ? /* @__PURE__ */ jsx4("p", { className: "text-xs text-muted-foreground", children: t("feedback.comments.loading") }) : query.isError ? /* @__PURE__ */ jsx4("p", { className: "text-xs text-destructive", children: t("feedback.comments.error") }) : (query.data?.data?.length ?? 0) === 0 ? /* @__PURE__ */ jsx4("p", { className: "text-xs italic text-muted-foreground", children: t("feedback.comments.empty") }) : /* @__PURE__ */ jsx4("ul", { className: "space-y-2", children: query.data?.data.map((c) => {
      const isMine = currentUser !== null && c.author_user_id === currentUser.id;
      const label = isMine ? t("feedback.comments.you_label") : c.author_role === "admin" ? t("feedback.comments.admin_label") : t("feedback.comments.submitter_label");
      return /* @__PURE__ */ jsxs3(
        "li",
        {
          className: `rounded-md border p-2 text-xs ${isMine ? "border-input bg-background" : c.author_role === "admin" ? "border-primary/40 bg-primary/5" : "border-input bg-muted/40"}`,
          children: [
            /* @__PURE__ */ jsxs3("div", { className: "flex items-center gap-2 mb-1", children: [
              /* @__PURE__ */ jsx4(
                Badge,
                {
                  variant: isMine ? "outline" : c.author_role === "admin" ? "default" : "secondary",
                  className: "text-[10px]",
                  children: label
                }
              ),
              /* @__PURE__ */ jsx4("span", { className: "text-[10px] text-muted-foreground", children: _fmt(c.created_at) })
            ] }),
            /* @__PURE__ */ jsx4("p", { className: "whitespace-pre-wrap", children: c.body })
          ]
        },
        c.id
      );
    }) }),
    /* @__PURE__ */ jsxs3("div", { className: "space-y-1.5", children: [
      /* @__PURE__ */ jsx4(
        Textarea,
        {
          value: draft,
          onChange: (e) => setDraft(e.target.value),
          placeholder: t("feedback.comments.placeholder"),
          rows: 2,
          maxLength: 5e3,
          disabled: post.isPending,
          "data-feedback-id": "feedback.comments.draft"
        }
      ),
      /* @__PURE__ */ jsx4("div", { className: "flex justify-end", children: /* @__PURE__ */ jsxs3(
        Button,
        {
          type: "button",
          size: "sm",
          onClick: onSend,
          disabled: post.isPending || draft.trim().length === 0,
          "data-feedback-id": "feedback.comments.send",
          children: [
            /* @__PURE__ */ jsx4(Send, { className: "mr-1 h-3.5 w-3.5" }),
            post.isPending ? t("feedback.comments.sending") : t("feedback.comments.send")
          ]
        }
      ) })
    ] })
  ] });
}

export {
  VERSION,
  installConsoleWrap,
  getConsoleTail,
  installNetworkWrap,
  getNetworkTail,
  getNetworkSuccessTail,
  installErrorWrap,
  getErrorsTail,
  Input,
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  Rl3Mark,
  CommentThread
};
//# sourceMappingURL=chunk-NDEW5SME.js.map