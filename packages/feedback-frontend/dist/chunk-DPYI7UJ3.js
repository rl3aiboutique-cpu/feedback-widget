import {
  Button,
  DEFAULT_REDACTION_SELECTORS,
  Textarea,
  cn,
  newIdempotencyKey,
  useFeedbackAdapter,
  useFeedbackBindings,
  useMyFeedbackQuery
} from "./chunk-JOGE5WUF.js";

// src/chat/FeedbackChatSheet.tsx
import { useEffect as useEffect2 } from "react";

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

// src/ui/sheet.tsx
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function Sheet({ ...props }) {
  return /* @__PURE__ */ jsx2(SheetPrimitive.Root, { "data-slot": "sheet", ...props });
}
function SheetPortal({ ...props }) {
  return /* @__PURE__ */ jsx2(SheetPrimitive.Portal, { "data-slot": "sheet-portal", ...props });
}
function SheetOverlay({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx2(
    SheetPrimitive.Overlay,
    {
      "data-slot": "sheet-overlay",
      className: cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      ),
      ...props
    }
  );
}
function SheetContent({
  className,
  children,
  side = "right",
  ...props
}) {
  return /* @__PURE__ */ jsxs2(SheetPortal, { children: [
    /* @__PURE__ */ jsx2(SheetOverlay, {}),
    /* @__PURE__ */ jsxs2(
      SheetPrimitive.Content,
      {
        "data-slot": "sheet-content",
        className: cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" && "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          side === "left" && "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          side === "top" && "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" && "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className
        ),
        ...props,
        children: [
          children,
          /* @__PURE__ */ jsxs2(SheetPrimitive.Close, { className: "ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none", children: [
            /* @__PURE__ */ jsx2(XIcon, { className: "size-4" }),
            /* @__PURE__ */ jsx2("span", { className: "sr-only", children: "Close" })
          ] })
        ]
      }
    )
  ] });
}
function SheetHeader({ className, ...props }) {
  return /* @__PURE__ */ jsx2(
    "div",
    {
      "data-slot": "sheet-header",
      className: cn("flex flex-col gap-1.5 p-4", className),
      ...props
    }
  );
}
function SheetTitle({ className, ...props }) {
  return /* @__PURE__ */ jsx2(
    SheetPrimitive.Title,
    {
      "data-slot": "sheet-title",
      className: cn("text-foreground font-semibold", className),
      ...props
    }
  );
}
function SheetDescription({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx2(
    SheetPrimitive.Description,
    {
      "data-slot": "sheet-description",
      className: cn("text-muted-foreground text-sm", className),
      ...props
    }
  );
}

// src/chat/CapturePicker.tsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function CapturePicker({
  mode,
  locked,
  onActivatePicker,
  onClearLocked,
  onModeChange,
  readOnly = false
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  if (readOnly) {
    return /* @__PURE__ */ jsxs3("div", { className: "flex items-center gap-2 text-[11px] text-muted-foreground", children: [
      /* @__PURE__ */ jsx3("span", { className: "uppercase tracking-wide", children: t("feedback.mode_label") }),
      mode === "element" && locked ? /* @__PURE__ */ jsxs3("code", { className: "font-mono truncate max-w-[220px] rounded bg-muted px-1.5 py-0.5", children: [
        "\u{1F4CD} ",
        locked.selector
      ] }) : /* @__PURE__ */ jsxs3("span", { className: "rounded bg-muted px-1.5 py-0.5", children: [
        "\u{1F310} ",
        t("feedback.mode_whole_page")
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs3("div", { className: "flex flex-wrap items-center gap-2", children: [
    /* @__PURE__ */ jsx3("span", { className: "text-[11px] uppercase tracking-wide text-muted-foreground", children: t("feedback.mode_label") }),
    /* @__PURE__ */ jsx3(
      Button,
      {
        type: "button",
        variant: mode === "page" ? "default" : "outline",
        size: "sm",
        onClick: () => {
          onModeChange("page");
          onClearLocked();
        },
        "data-feedback-id": "feedback.mode_whole_page",
        children: t("feedback.mode_whole_page")
      }
    ),
    /* @__PURE__ */ jsx3(
      Button,
      {
        type: "button",
        variant: mode === "element" ? "default" : "outline",
        size: "sm",
        onClick: onActivatePicker,
        "data-feedback-id": "feedback.mode_select_element",
        children: t("feedback.mode_select_element")
      }
    ),
    mode === "element" && locked ? /* @__PURE__ */ jsxs3("span", { className: "ml-auto inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[11px]", children: [
      /* @__PURE__ */ jsx3("code", { className: "font-mono truncate max-w-[180px]", children: locked.selector }),
      /* @__PURE__ */ jsx3(
        "button",
        {
          type: "button",
          onClick: () => {
            onClearLocked();
            onModeChange("page");
          },
          className: "text-primary underline-offset-2 hover:underline",
          "data-feedback-id": "feedback.clear_element",
          "aria-label": "Clear locked element",
          children: "\u2715"
        }
      )
    ] }) : null
  ] });
}

// src/chat/ChatTimeline.tsx
import { useEffect, useRef } from "react";

// src/chat/ChatBubble.tsx
import { jsx as jsx4 } from "react/jsx-runtime";
function ChatBubble({ role, text }) {
  const isUser = role === "user";
  return /* @__PURE__ */ jsx4("div", { className: `flex w-full ${isUser ? "justify-end" : "justify-start"}`, children: /* @__PURE__ */ jsx4(
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
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function ChatTimeline({
  messages,
  isThinking = false,
  thinkingLabel
}) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isThinking]);
  return /* @__PURE__ */ jsxs4("div", { className: "flex flex-col gap-3 px-4 py-3", children: [
    messages.map((m, idx) => /* @__PURE__ */ jsx5(ChatBubble, { role: m.role, text: m.text }, `${m.role}-${m.ts}-${idx}`)),
    isThinking ? /* @__PURE__ */ jsx5(_ThinkingIndicator, { label: thinkingLabel }) : null,
    /* @__PURE__ */ jsx5("div", { ref: endRef, "aria-hidden": "true" })
  ] });
}
function _ThinkingIndicator({ label }) {
  return /* @__PURE__ */ jsx5("div", { className: "flex w-full justify-start", children: /* @__PURE__ */ jsxs4("div", { className: "flex items-center gap-2 rounded-2xl border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground", children: [
    /* @__PURE__ */ jsxs4("span", { className: "flex items-center gap-1", "aria-hidden": "true", children: [
      /* @__PURE__ */ jsx5("span", { className: "h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" }),
      /* @__PURE__ */ jsx5("span", { className: "h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" }),
      /* @__PURE__ */ jsx5("span", { className: "h-1.5 w-1.5 animate-bounce rounded-full bg-current" })
    ] }),
    label ? /* @__PURE__ */ jsx5("span", { className: "text-xs", children: label }) : null
  ] }) });
}

// src/chat/Composer.tsx
import { SendHorizontal } from "lucide-react";
import { useCallback, useState } from "react";
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs5("div", { className: "flex items-end gap-2 border-t border-input bg-background px-3 py-3", children: [
    /* @__PURE__ */ jsx6(
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
    /* @__PURE__ */ jsx6(
      Button,
      {
        type: "button",
        size: "sm",
        onClick: () => void submit(),
        disabled: disabled || value.trim().length === 0,
        "aria-label": "Enviar",
        "data-feedback-id": "feedback.chat_send",
        children: /* @__PURE__ */ jsx6(SendHorizontal, { className: "h-4 w-4" })
      }
    )
  ] });
}

// src/chat/FeedbackTabs.tsx
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
function FeedbackTabs({
  activeTab,
  mineTotalCount,
  unreadAdminRepliesCount = 0,
  onTabChange
}) {
  return /* @__PURE__ */ jsxs6(
    "div",
    {
      className: "grid grid-cols-2 gap-1 p-1 rounded-md bg-muted text-xs font-medium",
      role: "tablist",
      children: [
        /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": activeTab === "compose",
            onClick: () => onTabChange("compose"),
            className: `px-3 py-1.5 rounded transition-colors ${activeTab === "compose" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
            "data-feedback-id": "feedback.tab.compose",
            children: "\u270E Nuevo feedback"
          }
        ),
        /* @__PURE__ */ jsxs6(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": activeTab === "mine",
            onClick: () => onTabChange("mine"),
            className: `flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition-colors ${activeTab === "mine" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
            "data-feedback-id": "feedback.tab.mine",
            children: [
              /* @__PURE__ */ jsx7("span", { children: "\u{1F4CB} Mis feedbacks" }),
              mineTotalCount > 0 ? /* @__PURE__ */ jsx7(
                "span",
                {
                  className: `rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${unreadAdminRepliesCount > 0 ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15 text-muted-foreground"}`,
                  title: unreadAdminRepliesCount > 0 ? `${unreadAdminRepliesCount} con respuesta del equipo` : `${mineTotalCount} en total`,
                  children: unreadAdminRepliesCount > 0 ? unreadAdminRepliesCount : mineTotalCount
                }
              ) : null
            ]
          }
        )
      ]
    }
  );
}

// src/chat/FooterActions.tsx
import { Check, Loader2, RotateCcw } from "lucide-react";
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
function FooterActions({
  state,
  onConfirm,
  onAdjust,
  onRetry
}) {
  if (state === "error") {
    return /* @__PURE__ */ jsx8("div", { className: "flex gap-2 px-3 py-3 border-t border-border bg-background", children: /* @__PURE__ */ jsx8(Button, { type: "button", variant: "default", onClick: onRetry, className: "w-full", children: "\u21BB Reintentar" }) });
  }
  if (state === "confirming" || state === "synthesizing" || state === "finalizing") {
    const disabled = state !== "confirming";
    return /* @__PURE__ */ jsxs7("div", { className: "flex gap-2 px-3 py-3 border-t border-border bg-background", children: [
      /* @__PURE__ */ jsxs7(
        Button,
        {
          type: "button",
          variant: "outline",
          onClick: onAdjust,
          disabled,
          className: "flex-1",
          "data-feedback-id": "feedback.footer.adjust",
          children: [
            state === "synthesizing" ? /* @__PURE__ */ jsx8(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx8(RotateCcw, { className: "h-4 w-4 mr-1" }),
            "\u21BA Sigamos iterando"
          ]
        }
      ),
      /* @__PURE__ */ jsxs7(
        Button,
        {
          type: "button",
          variant: "default",
          onClick: onConfirm,
          disabled,
          className: "flex-1",
          "data-feedback-id": "feedback.footer.confirm",
          children: [
            state === "finalizing" ? /* @__PURE__ */ jsx8(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx8(Check, { className: "h-4 w-4 mr-1" }),
            "\u2713 Confirmar"
          ]
        }
      )
    ] });
  }
  return null;
}

// src/ui/badge.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { jsx as jsx9 } from "react/jsx-runtime";
var badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive: "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);
function Badge({
  className,
  variant,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "span";
  return /* @__PURE__ */ jsx9(Comp, { "data-slot": "badge", className: cn(badgeVariants({ variant }), className), ...props });
}

// src/chat/MineFeedTab.tsx
import { jsx as jsx10, jsxs as jsxs8 } from "react/jsx-runtime";
function statusVariant(s) {
  if (s === "new") return "default";
  if (s === "triaged" || s === "in_progress") return "secondary";
  if (s === "wont_fix") return "destructive";
  return "outline";
}
function humanStatus(s) {
  switch (s) {
    case "new":
      return "Submitted";
    case "triaged":
      return "Triaged";
    case "in_progress":
      return "In progress";
    case "done":
      return "Resolved";
    case "wont_fix":
      return "Closed";
    default:
      return s;
  }
}
function MineFeedTab({ onSelectFeedback }) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const query = useMyFeedbackQuery(25);
  if (query.isLoading) {
    return /* @__PURE__ */ jsx10("p", { className: "text-sm text-muted-foreground p-4", children: t("feedback.mine.loading") });
  }
  if (query.isError) {
    return /* @__PURE__ */ jsx10("p", { className: "text-sm text-destructive p-4", children: t("feedback.mine.error") });
  }
  const rows = query.data ?? [];
  if (rows.length === 0) {
    return /* @__PURE__ */ jsx10("p", { className: "text-sm text-muted-foreground p-4", children: t("feedback.mine.empty") });
  }
  return /* @__PURE__ */ jsx10("ul", { className: "space-y-2 p-1", children: rows.map((r) => /* @__PURE__ */ jsx10("li", { children: /* @__PURE__ */ jsxs8(
    "button",
    {
      type: "button",
      onClick: () => onSelectFeedback?.(r.id),
      className: "w-full p-2 text-sm flex items-center gap-2 rounded-md border border-input hover:bg-accent text-left",
      "data-feedback-id": "feedback.mine.row",
      children: [
        /* @__PURE__ */ jsx10("code", { className: "font-mono text-xs px-1 py-0.5 rounded bg-muted shrink-0", children: r.ticket_code || "\u2014" }),
        /* @__PURE__ */ jsx10(Badge, { variant: statusVariant(r.status), className: "shrink-0", children: humanStatus(r.status) }),
        /* @__PURE__ */ jsx10("span", { className: "truncate flex-1 font-medium", children: r.title })
      ]
    }
  ) }, r.id)) });
}

// src/chat/SynthesisCard.tsx
import { jsx as jsx11, jsxs as jsxs9 } from "react/jsx-runtime";
function SynthesisCard({ synthesis }) {
  return /* @__PURE__ */ jsxs9(
    "div",
    {
      className: "mx-4 my-3 flex flex-col gap-3 rounded-lg border border-input bg-card p-4 shadow-sm",
      "data-feedback-id": "feedback.chat_synthesis_card",
      children: [
        /* @__PURE__ */ jsx11("h3", { className: "text-base font-bold text-foreground", children: synthesis.title }),
        /* @__PURE__ */ jsx11("p", { className: "text-sm text-muted-foreground", children: synthesis.summary }),
        /* @__PURE__ */ jsx11("blockquote", { className: "border-l-2 border-primary pl-3 text-sm italic text-foreground", children: synthesis.user_story }),
        synthesis.acceptance_criteria.length > 0 ? /* @__PURE__ */ jsxs9("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx11("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Criterios de aceptaci\xF3n" }),
          /* @__PURE__ */ jsx11("ul", { className: "list-disc space-y-1 pl-5 text-sm text-foreground", children: synthesis.acceptance_criteria.map((ac, idx) => /* @__PURE__ */ jsx11("li", { children: ac }, `ac-${idx}-${ac.slice(0, 16)}`)) })
        ] }) : null,
        synthesis.open_questions.length > 0 ? /* @__PURE__ */ jsxs9("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx11("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Preguntas abiertas" }),
          /* @__PURE__ */ jsx11("ul", { className: "list-disc space-y-1 pl-5 text-sm text-muted-foreground", children: synthesis.open_questions.map((q, idx) => /* @__PURE__ */ jsx11("li", { children: q }, `oq-${idx}-${q.slice(0, 16)}`)) })
        ] }) : null
      ]
    }
  );
}

// src/chat/useFeedbackChat.ts
import { useCallback as useCallback3, useRef as useRef3, useState as useState3 } from "react";

// src/capture/screenshot.ts
var DEFAULT_MAX_PIXELS = 1920 * 1080 * 2;
var DEFAULT_TYPE = "image/png";
var DEFAULT_EXCLUDE_PREDICATE = (node) => node.dataset?.feedbackWidgetRoot === "true" || Boolean(node.closest?.('[data-feedback-widget-root="true"]'));
function _blackoutRedactedNodes(root, selectors) {
  const overlays = [];
  if (typeof document === "undefined") return { restore: () => void 0 };
  const matches = /* @__PURE__ */ new Set();
  for (const sel of selectors) {
    let nodes;
    try {
      nodes = root.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const n of Array.from(nodes)) {
      if (n instanceof HTMLElement) matches.add(n);
    }
  }
  for (const node of matches) {
    const rect = node.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.setAttribute("data-feedback-blackout", "true");
    overlay.style.cssText = [
      "position:fixed",
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      "background:#000",
      "z-index:2147483646",
      "pointer-events:none"
    ].join(";");
    document.body.appendChild(overlay);
    overlays.push(overlay);
  }
  return {
    restore() {
      for (const o of overlays) o.remove();
    }
  };
}
async function _renderToBlob(target, options) {
  const exclude = options.excludePredicate ?? DEFAULT_EXCLUDE_PREDICATE;
  const filter = (node) => {
    if (!(node instanceof HTMLElement)) return true;
    if (node.dataset?.feedbackBlackout === "true") return true;
    return !exclude(node);
  };
  const blackout = _blackoutRedactedNodes(target, options.redactionSelectors);
  try {
    const lib = await import("html-to-image");
    const blob = await lib.toBlob(target, {
      filter,
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      cacheBust: true,
      pixelRatio: window.devicePixelRatio || 1,
      type: DEFAULT_TYPE
    });
    if (!blob) {
      throw new Error("Screenshot capture returned no Blob");
    }
    const rect = target.getBoundingClientRect();
    let width = Math.round(rect.width);
    let height = Math.round(rect.height);
    if (width * height > DEFAULT_MAX_PIXELS) {
      const scale = Math.sqrt(DEFAULT_MAX_PIXELS / (width * height));
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
    }
    return { blob, width, height };
  } finally {
    blackout.restore();
  }
}
async function capturePageScreenshot(options) {
  if (typeof document === "undefined") {
    throw new Error("Screenshot capture requires a browser environment");
  }
  return _renderToBlob(document.body, options);
}
function describeElement(el) {
  const rect = el.getBoundingClientRect();
  const selector = _cssSelectorOf(el);
  const xpath = _xpathOf(el);
  const accessibleName = el.getAttribute("aria-label") ?? el.getAttribute("title") ?? el.innerText?.trim().slice(0, 80) ?? null;
  const role = el.getAttribute("role");
  const outerHtml = el.outerHTML.slice(0, 500);
  return {
    selector,
    xpath,
    tag: el.tagName.toLowerCase(),
    role,
    accessible_name: accessibleName,
    bounding_box: {
      x: rect.x,
      y: rect.y,
      w: rect.width,
      h: rect.height
    },
    outer_html_excerpt: outerHtml
  };
}
function _cssSelectorOf(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts = [];
  let cur = el;
  while (cur && cur !== document.body && parts.length < 8) {
    let part = cur.tagName.toLowerCase();
    if (cur.classList.length > 0) {
      part += `.${Array.from(cur.classList).slice(0, 2).map((c) => CSS.escape(c)).join(".")}`;
    }
    const parent = cur.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((s) => s.tagName === cur?.tagName);
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
    }
    parts.unshift(part);
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}
function _xpathOf(el) {
  if (typeof document === "undefined") return null;
  const segments = [];
  let node = el;
  while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body) {
    const elNode = node;
    let index = 1;
    let sibling = elNode.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === elNode.tagName) index += 1;
      sibling = sibling.previousElementSibling;
    }
    segments.unshift(`${elNode.tagName.toLowerCase()}[${index}]`);
    node = elNode.parentNode;
  }
  return segments.length > 0 ? `/${segments.join("/")}` : null;
}

// src/chat/useChatRunStream.ts
import { useCallback as useCallback2, useRef as useRef2, useState as useState2 } from "react";
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
  const [state, setState] = useState2("idle");
  const [messages, setMessages] = useState2([]);
  const [partial_text, setPartialText] = useState2("");
  const [synthesis, setSynthesis] = useState2(null);
  const [error, setError] = useState2(null);
  const abortRef = useRef2(null);
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
    screenshot_attachment_id: null,
    // S3F shell-hybrid: forward the locked element so backend can hang
    // turn context (and downstream feedback row) off the right DOM node.
    // Backend pydantic config ignores unknown fields today (S5 lands
    // first-class support).
    element_selector: args.locked?.selector ?? null,
    element_xpath: args.locked?.xpath ?? null,
    element_bounding_box: args.locked?.bounding_box ?? null
  };
}
function useFeedbackChat() {
  const bindings = useFeedbackBindings();
  const adapter = useFeedbackAdapter();
  const user = adapter.useCurrentUser();
  const [sessionId, setSessionId] = useState3(null);
  const stream = useChatRunStream({ bindings, sessionId });
  const [overrideState, setOverrideState] = useState3(null);
  const [openError, setOpenError] = useState3(null);
  const openingRef = useRef3(false);
  const [captureMode, setCaptureMode] = useState3("page");
  const [lockedElement, setLockedElement] = useState3(null);
  const [activeTab, setActiveTab] = useState3("compose");
  const setMode = useCallback3((mode) => {
    setCaptureMode(mode);
  }, []);
  const clearLocked = useCallback3(() => {
    setLockedElement(null);
    setCaptureMode("page");
  }, []);
  const acceptLocked = useCallback3((info) => {
    setLockedElement(info);
    setCaptureMode("element");
  }, []);
  const selectTab = useCallback3((tab) => {
    setActiveTab(tab);
  }, []);
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
        userRole: user?.role ?? null,
        locked: lockedElement
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
  }, [adapter.appVersion, adapter.gitSha, bindings, stream, user?.role, lockedElement]);
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
    newConversation,
    captureMode,
    lockedElement,
    activeTab,
    setMode,
    clearLocked,
    acceptLocked,
    selectTab
  };
}

// src/chat/FeedbackChatSheet.tsx
import { Fragment, jsx as jsx12, jsxs as jsxs10 } from "react/jsx-runtime";
var _SHEET_WIDTH = "w-full sm:max-w-md md:max-w-lg lg:max-w-[520px]";
function _thinkingLabel(state) {
  if (state === "synthesizing") return "Sintetizando\u2026";
  if (state === "opening") return "Preparando\u2026";
  return void 0;
}
function _isThinking(state) {
  return state === "bot_thinking" || state === "synthesizing" || state === "opening";
}
function _showFooter(state) {
  return state === "confirming" || state === "synthesizing" || state === "finalizing" || state === "error";
}
function _showComposer(state) {
  return state === "awaiting_user" || state === "user_typing" || state === "bot_thinking";
}
function FeedbackChatSheet({
  open,
  onOpenChange,
  locked,
  onActivatePicker,
  onClearLocked
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const chat = useFeedbackChat();
  const {
    openSheet,
    closeSheet,
    sendUserMessage,
    confirmSynthesis,
    adjustSynthesis,
    newConversation,
    state,
    messages,
    error,
    synthesis,
    captureMode,
    lockedElement,
    activeTab,
    setMode,
    clearLocked: clearHookLocked,
    acceptLocked,
    selectTab
  } = chat;
  useEffect2(() => {
    if (open) {
      void openSheet();
    } else {
      closeSheet();
    }
  }, [open]);
  useEffect2(() => {
    if (locked) acceptLocked(locked);
    else clearHookLocked();
  }, [locked]);
  useEffect2(() => {
    if (state !== "done") return;
    const tid = window.setTimeout(() => onOpenChange(false), 3e3);
    return () => window.clearTimeout(tid);
  }, [state, onOpenChange]);
  const showSynthesis = state === "confirming" && synthesis !== null;
  return /* @__PURE__ */ jsx12(Sheet, { open, onOpenChange, children: /* @__PURE__ */ jsxs10(
    SheetContent,
    {
      side: "right",
      className: `${_SHEET_WIDTH} flex h-full flex-col gap-0 p-0`,
      "data-feedback-widget-root": "true",
      children: [
        /* @__PURE__ */ jsxs10(SheetHeader, { className: "border-b border-input px-4 pt-4 pb-2", children: [
          /* @__PURE__ */ jsxs10(SheetTitle, { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx12(Rl3Mark, { className: "h-6 w-6 shrink-0" }),
            /* @__PURE__ */ jsx12("span", { children: t("feedback.panel_title") })
          ] }),
          /* @__PURE__ */ jsx12(SheetDescription, { className: "text-xs", children: t("feedback.panel_description") })
        ] }),
        /* @__PURE__ */ jsx12("div", { className: "px-4 pt-3 pb-2", children: /* @__PURE__ */ jsx12(
          FeedbackTabs,
          {
            activeTab,
            mineTotalCount: 0,
            onTabChange: selectTab
          }
        ) }),
        activeTab === "compose" ? /* @__PURE__ */ jsxs10(Fragment, { children: [
          /* @__PURE__ */ jsx12("div", { className: "px-4 pb-2", children: /* @__PURE__ */ jsx12(
            CapturePicker,
            {
              mode: captureMode,
              locked: lockedElement,
              onActivatePicker,
              onClearLocked,
              onModeChange: setMode
            }
          ) }),
          /* @__PURE__ */ jsxs10("div", { className: "flex-1 min-h-0 overflow-y-auto", children: [
            /* @__PURE__ */ jsx12(
              ChatTimeline,
              {
                messages,
                isThinking: _isThinking(state),
                thinkingLabel: _thinkingLabel(state)
              }
            ),
            error ? /* @__PURE__ */ jsx12("div", { className: "mx-4 my-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive", children: error }) : null,
            showSynthesis ? /* @__PURE__ */ jsx12(SynthesisCard, { synthesis }) : null
          ] }),
          _showComposer(state) ? /* @__PURE__ */ jsx12(Composer, { onSend: sendUserMessage, disabled: state === "bot_thinking" }) : null,
          _showFooter(state) ? /* @__PURE__ */ jsx12(
            FooterActions,
            {
              state,
              onConfirm: () => void confirmSynthesis(),
              onAdjust: adjustSynthesis,
              onRetry: () => void newConversation()
            }
          ) : null
        ] }) : /* @__PURE__ */ jsx12("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-4", children: /* @__PURE__ */ jsx12(
          MineFeedTab,
          {
            onSelectFeedback: (_fid) => {
              selectTab("compose");
            }
          }
        ) })
      ]
    }
  ) });
}

export {
  Badge,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Rl3Mark,
  describeElement,
  CapturePicker,
  FeedbackTabs,
  FooterActions,
  MineFeedTab,
  SynthesisCard,
  FeedbackChatSheet
};
//# sourceMappingURL=chunk-DPYI7UJ3.js.map