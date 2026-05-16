import {
  CapturePicker,
  DEFAULT_API_PATH_PREFIX,
  FeedbackChatSheet,
  FeedbackProvider,
  FeedbackTabs,
  FooterActions,
  MineFeedTab,
  Rl3Mark,
  StatusPill,
  SubmitFeedbackError,
  SynthesisCard,
  TicketDetail,
  createAdapter,
  describeElement,
  newIdempotencyKey,
  redactString,
  useCanTriageFeedback,
  useFeedbackAdapter,
  useFeedbackBindings,
  useFeedbackConfig,
  useMyPendingActionCount
} from "./chunk-W6TIQ26E.js";

// src/version.ts
var VERSION = "1.0.0";

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

// src/FeedbackButton.tsx
import { Suspense, lazy, useCallback, useEffect as useEffect2, useState as useState2 } from "react";

// src/ElementSelector.tsx
import { useEffect, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var MIN_HIGHLIGHT_SIZE = 8;
function _isInsideWidget(el) {
  return Boolean(el.closest('[data-feedback-widget-root="true"]'));
}
function _accessibleName(el) {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  const title = el.getAttribute("title");
  if (title) return title;
  if (el instanceof HTMLElement && el.innerText) {
    return el.innerText.trim().slice(0, 60);
  }
  return el.tagName.toLowerCase();
}
function ElementSelector({ onLock, onCancel }) {
  const [rect, setRect] = useState(null);
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const currentRef = useRef(null);
  useEffect(() => {
    if (typeof document === "undefined") return void 0;
    const onMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || !(el instanceof HTMLElement) || _isInsideWidget(el)) {
        currentRef.current = null;
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width < MIN_HIGHLIGHT_SIZE || r.height < MIN_HIGHLIGHT_SIZE) {
        currentRef.current = null;
        setRect(null);
        return;
      }
      currentRef.current = el;
      setRect({
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        label: `${el.tagName.toLowerCase()} \xB7 ${_accessibleName(el)}`
      });
    };
    const onClick = (e) => {
      const target = currentRef.current;
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        onLock(target);
      } else {
        onCancel();
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onLock, onCancel]);
  return (
    // Not role="dialog" on purpose: this layer is pointer-events:none and
    // does NOT trap focus — a real dialog would. The aria-live="polite"
    // banner communicates the picker mode.
    /* @__PURE__ */ jsxs(
      "div",
      {
        "data-feedback-widget-root": "true",
        "aria-label": t("feedback.element_selector_active"),
        "aria-live": "polite",
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 2147483645,
          pointerEvents: "none"
        },
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              style: {
                position: "fixed",
                left: "50%",
                top: 16,
                transform: "translateX(-50%)",
                background: "#1E40AF",
                color: "#ffffff",
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                boxShadow: "0 6px 16px rgba(0,0,0,0.25)"
              },
              children: t("feedback.element_selector_hint")
            }
          ),
          rect ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  position: "fixed",
                  left: rect.x,
                  top: rect.y,
                  width: rect.w,
                  height: rect.h,
                  border: "2px solid #1E40AF",
                  borderRadius: 4,
                  boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.35)",
                  transition: "all 80ms ease-out"
                }
              }
            ),
            /* @__PURE__ */ jsx(
              "div",
              {
                style: {
                  position: "fixed",
                  left: rect.x,
                  top: Math.max(0, rect.y - 26),
                  background: "#1E40AF",
                  color: "#ffffff",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  maxWidth: 360,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                },
                children: rect.label
              }
            )
          ] }) : null
        ]
      }
    )
  );
}

// src/FeedbackButton.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var FeedbackChatSheetLazy = lazy(
  () => import("./FeedbackChatSheet-EYQCAFWR.js").then((m) => ({ default: m.FeedbackChatSheet }))
);
var POSITION_CLASSES = {
  bottom_right: "bottom-24 right-6",
  bottom_left: "bottom-24 left-6",
  top_right: "top-6 right-6",
  top_left: "top-6 left-6"
};
function FeedbackButton() {
  const config = useFeedbackConfig();
  const adapter = useFeedbackAdapter();
  const bindings = useFeedbackBindings();
  const t = adapter.useTranslation();
  const [open, setOpen] = useState2(false);
  const [pickerActive, setPickerActive] = useState2(false);
  const [locked, setLocked] = useState2(null);
  const [hostEnabled, setHostEnabled] = useState2(true);
  useEffect2(() => {
    let cancelled = false;
    const cb = bindings.isEnabled;
    if (!cb) {
      setHostEnabled(true);
      return;
    }
    Promise.resolve(cb()).then((v) => {
      if (!cancelled) setHostEnabled(v !== false);
    });
    return () => {
      cancelled = true;
    };
  }, [bindings]);
  const handlePickerLock = useCallback((el) => {
    setLocked({ el, info: describeElement(el) });
    setPickerActive(false);
    setOpen(true);
  }, []);
  const handlePickerCancel = useCallback(() => {
    setPickerActive(false);
    setOpen(true);
  }, []);
  const handleActivatePicker = useCallback(() => {
    setPickerActive(true);
    setOpen(false);
  }, []);
  const handleClearLocked = useCallback(() => {
    setLocked(null);
  }, []);
  const pendingCount = useMyPendingActionCount();
  if (!config.enabled) return null;
  if (!hostEnabled) return null;
  const cornerClass = POSITION_CLASSES[config.position] ?? POSITION_CLASSES.bottom_right;
  const accentStyle = config.brandPrimaryHex ? { "--feedback-brand": config.brandPrimaryHex } : void 0;
  const sheetActuallyOpen = open && !pickerActive;
  const launcherHidden = sheetActuallyOpen;
  return /* @__PURE__ */ jsxs2("div", { "data-feedback-widget-root": "true", className: "rl3-feedback-scope", children: [
    launcherHidden ? null : /* @__PURE__ */ jsxs2(
      "button",
      {
        type: "button",
        onClick: () => setOpen(true),
        "aria-label": t("feedback.open_button"),
        title: pendingCount > 0 ? t("feedback.open_button_with_pending", {
          count: String(pendingCount)
        }) : t("feedback.open_button"),
        "data-feedback-id": "feedback.open_button",
        className: `fixed z-[2147483640] flex items-center gap-2 rounded-full pl-2 pr-4 py-1.5 shadow-lg
                    bg-background border border-input text-foreground hover:bg-accent
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                    focus-visible:ring-offset-2 transition-all hover:scale-[1.02] hover:shadow-xl
                    ${cornerClass}`,
        style: accentStyle,
        children: [
          /* @__PURE__ */ jsxs2("span", { className: "relative", children: [
            /* @__PURE__ */ jsx2(Rl3Mark, { className: "h-7 w-7 shrink-0" }),
            pendingCount > 0 ? /* @__PURE__ */ jsx2(
              "span",
              {
                "aria-hidden": "true",
                className: "absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-2 ring-background",
                children: pendingCount > 9 ? "9+" : pendingCount
              }
            ) : null
          ] }),
          /* @__PURE__ */ jsx2("span", { className: "text-sm font-semibold", children: t("feedback.button_label") })
        ]
      }
    ),
    open || pickerActive ? /* @__PURE__ */ jsx2(Suspense, { fallback: null, children: /* @__PURE__ */ jsx2(
      FeedbackChatSheetLazy,
      {
        open: open && !pickerActive,
        onOpenChange: setOpen,
        locked: locked?.info ?? null,
        onActivatePicker: handleActivatePicker,
        onClearLocked: handleClearLocked
      }
    ) }) : null,
    pickerActive ? /* @__PURE__ */ jsx2(ElementSelector, { onLock: handlePickerLock, onCancel: handlePickerCancel }) : null
  ] });
}
var FeedbackButton_default = FeedbackButton;

// src/FeedbackDiscoveryHint.tsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var _DEFAULT_TITLE = "Beta feedback triage";
var _DEFAULT_DESCRIPTION = "Click the floating RL3 Feedback button (bottom-right), open the My tickets tab, then toggle the scope to All to browse every ticket in the tenant \u2014 screenshots, attachments, spec card, and admin actions all live inside the sheet.";
function FeedbackDiscoveryHint({
  variant = "admin",
  className,
  title,
  description
}) {
  if (variant === "inline") {
    return /* @__PURE__ */ jsxs3("span", { className, "data-feedback-id": "feedback.discovery.inline", children: [
      "usa el bot\xF3n flotante",
      " ",
      /* @__PURE__ */ jsx3("span", { className: "font-semibold text-primary", children: "RL3 Feedback" }),
      " ",
      "(esquina inferior derecha)"
    ] });
  }
  return /* @__PURE__ */ jsx3(
    "div",
    {
      className: [
        "flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-4",
        className ?? ""
      ].join(" "),
      "data-feedback-id": "feedback.discovery.admin",
      children: /* @__PURE__ */ jsxs3("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ jsx3(
          "span",
          {
            "aria-hidden": "true",
            className: "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-primary",
            children: "\u2726"
          }
        ),
        /* @__PURE__ */ jsxs3("div", { children: [
          /* @__PURE__ */ jsx3("h2", { className: "font-semibold", children: title ?? _DEFAULT_TITLE }),
          /* @__PURE__ */ jsx3("p", { className: "text-sm text-muted-foreground", children: description ?? _DEFAULT_DESCRIPTION })
        ] })
      ] })
    }
  );
}
export {
  CapturePicker,
  DEFAULT_API_PATH_PREFIX,
  FeedbackButton,
  FeedbackButton_default as FeedbackButtonDefault,
  FeedbackChatSheet,
  FeedbackDiscoveryHint,
  FeedbackProvider,
  FeedbackTabs,
  FooterActions,
  MineFeedTab,
  StatusPill,
  SubmitFeedbackError,
  SynthesisCard,
  TicketDetail,
  VERSION,
  createAdapter,
  installConsoleWrap,
  installErrorWrap,
  installNetworkWrap,
  newIdempotencyKey,
  useCanTriageFeedback,
  useFeedbackAdapter,
  useFeedbackBindings,
  useFeedbackConfig
};
//# sourceMappingURL=index.js.map