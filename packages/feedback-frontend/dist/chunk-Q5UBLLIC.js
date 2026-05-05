import {
  Button,
  FeedbackApiError,
  Textarea,
  cn,
  useFeedbackAdapter,
  useFeedbackCommentsQuery,
  useMyFeedbackQuery,
  usePostFeedbackCommentMutation
} from "./chunk-G7QBSJFP.js";

// src/ui/sheet.tsx
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";
function Sheet({ ...props }) {
  return /* @__PURE__ */ jsx(SheetPrimitive.Root, { "data-slot": "sheet", ...props });
}
function SheetPortal({ ...props }) {
  return /* @__PURE__ */ jsx(SheetPrimitive.Portal, { "data-slot": "sheet-portal", ...props });
}
function SheetOverlay({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
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
  return /* @__PURE__ */ jsxs(SheetPortal, { children: [
    /* @__PURE__ */ jsx(SheetOverlay, {}),
    /* @__PURE__ */ jsxs(
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
          /* @__PURE__ */ jsxs(SheetPrimitive.Close, { className: "ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none", children: [
            /* @__PURE__ */ jsx(XIcon, { className: "size-4" }),
            /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Close" })
          ] })
        ]
      }
    )
  ] });
}
function SheetHeader({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-slot": "sheet-header",
      className: cn("flex flex-col gap-1.5 p-4", className),
      ...props
    }
  );
}
function SheetFooter({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-slot": "sheet-footer",
      className: cn("mt-auto flex flex-col gap-2 p-4", className),
      ...props
    }
  );
}
function SheetTitle({ className, ...props }) {
  return /* @__PURE__ */ jsx(
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
  return /* @__PURE__ */ jsx(
    SheetPrimitive.Description,
    {
      "data-slot": "sheet-description",
      className: cn("text-muted-foreground text-sm", className),
      ...props
    }
  );
}

// src/Rl3Mark.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function Rl3Mark({
  className,
  gradientId = "rl3-feedback-grad"
}) {
  return /* @__PURE__ */ jsxs2(
    "svg",
    {
      className,
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 32 32",
      fill: "none",
      role: "img",
      "aria-label": "RL3",
      children: [
        /* @__PURE__ */ jsx2("defs", { children: /* @__PURE__ */ jsxs2(
          "linearGradient",
          {
            id: gradientId,
            x1: "0",
            y1: "0",
            x2: "32",
            y2: "32",
            gradientUnits: "userSpaceOnUse",
            children: [
              /* @__PURE__ */ jsx2("stop", { offset: "0%", stopColor: "#14b8a6" }),
              /* @__PURE__ */ jsx2("stop", { offset: "100%", stopColor: "#0ea5e9" })
            ]
          }
        ) }),
        /* @__PURE__ */ jsx2("rect", { width: "32", height: "32", rx: "8", fill: `url(#${gradientId})` }),
        /* @__PURE__ */ jsx2(
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

// src/MyTicketsPanel.tsx
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState as useState2 } from "react";

// src/comments/CommentThread.tsx
import { Send } from "lucide-react";
import { useState } from "react";

// src/ui/badge.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { jsx as jsx3 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsx3(Comp, { "data-slot": "badge", className: cn(badgeVariants({ variant }), className), ...props });
}

// src/comments/CommentThread.tsx
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

// src/MyTicketsPanel.tsx
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
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
      return "Closed (won't fix)";
    default:
      return s;
  }
}
function MyTicketsPanel({ onSelectTicket }) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const query = useMyFeedbackQuery(25);
  const [expandedId, setExpandedId] = useState2(null);
  if (query.isLoading) {
    return /* @__PURE__ */ jsx5("p", { className: "text-sm text-muted-foreground", children: t("feedback.mine.loading") });
  }
  if (query.isError) {
    return /* @__PURE__ */ jsx5("p", { className: "text-sm text-destructive", children: t("feedback.mine.error") });
  }
  const rows = query.data ?? [];
  if (rows.length === 0) {
    return /* @__PURE__ */ jsx5("p", { className: "text-sm text-muted-foreground", children: t("feedback.mine.empty") });
  }
  return /* @__PURE__ */ jsx5("ul", { className: "space-y-2", children: rows.map((r) => {
    const recentlyResolved = r.status === "done";
    const isOpen = expandedId === r.id;
    return /* @__PURE__ */ jsx5("li", { children: /* @__PURE__ */ jsxs4(
      "div",
      {
        className: `rounded-md border ${recentlyResolved ? "border-primary bg-primary/5" : "border-input"}`,
        children: [
          /* @__PURE__ */ jsxs4(
            "button",
            {
              type: "button",
              onClick: () => setExpandedId(isOpen ? null : r.id),
              className: "w-full text-left p-2 text-sm flex flex-col gap-1 hover:bg-accent rounded-md",
              "aria-expanded": isOpen,
              "aria-controls": `ticket-detail-${r.id}`,
              "data-feedback-id": "feedback.mine.row",
              children: [
                /* @__PURE__ */ jsxs4("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx5("code", { className: "font-mono text-xs px-1 py-0.5 rounded bg-muted shrink-0", children: r.ticket_code || "\u2014" }),
                  /* @__PURE__ */ jsx5(Badge, { variant: statusVariant(r.status), className: "shrink-0", children: humanStatus(r.status) }),
                  /* @__PURE__ */ jsx5("span", { className: "truncate flex-1 font-medium", children: r.title }),
                  isOpen ? /* @__PURE__ */ jsx5(ChevronUp, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground" }) : /* @__PURE__ */ jsx5(ChevronDown, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground" })
                ] }),
                recentlyResolved && !isOpen ? /* @__PURE__ */ jsx5("span", { className: "text-[11px] text-primary", children: t("feedback.mine.action_hint") }) : null
              ]
            }
          ),
          isOpen ? /* @__PURE__ */ jsxs4(
            "div",
            {
              id: `ticket-detail-${r.id}`,
              className: "border-t border-input px-3 py-3 space-y-3 text-xs",
              children: [
                r.created_at ? /* @__PURE__ */ jsx5("p", { className: "text-muted-foreground", children: t("feedback.mine.submitted_at", {
                  date: r.created_at.slice(0, 16).replace("T", " ")
                }) }) : null,
                /* @__PURE__ */ jsxs4("section", { children: [
                  /* @__PURE__ */ jsx5("h4", { className: "font-semibold text-foreground mb-1", children: t("feedback.field.description") }),
                  /* @__PURE__ */ jsx5("p", { className: "whitespace-pre-wrap", children: r.description || /* @__PURE__ */ jsx5("span", { className: "italic text-muted-foreground", children: t("feedback.mine.no_description") }) })
                ] }),
                r.expected_outcome ? /* @__PURE__ */ jsxs4("section", { children: [
                  /* @__PURE__ */ jsx5("h4", { className: "font-semibold text-foreground mb-1", children: t("feedback.field.expected_outcome") }),
                  /* @__PURE__ */ jsx5("p", { className: "whitespace-pre-wrap", children: r.expected_outcome })
                ] }) : null,
                r.triage_note ? /* @__PURE__ */ jsxs4("section", { className: "rounded bg-muted/50 p-2", children: [
                  /* @__PURE__ */ jsx5("h4", { className: "font-semibold text-foreground mb-1", children: t("feedback.mine.triage_note") }),
                  /* @__PURE__ */ jsx5("p", { className: "whitespace-pre-wrap", children: r.triage_note })
                ] }) : null,
                r.attachments && r.attachments.length > 0 ? /* @__PURE__ */ jsxs4("section", { children: [
                  /* @__PURE__ */ jsx5("h4", { className: "font-semibold text-foreground mb-1", children: t("feedback.mine.attachments", {
                    count: String(r.attachments.length)
                  }) }),
                  /* @__PURE__ */ jsx5("ul", { className: "space-y-1.5", children: r.attachments.map((a) => {
                    const isImage = a.content_type.startsWith("image/");
                    const label = a.filename ?? a.kind;
                    return /* @__PURE__ */ jsxs4(
                      "li",
                      {
                        className: "flex items-center gap-2 rounded border border-input bg-background p-1.5",
                        children: [
                          isImage && a.presigned_url ? /* @__PURE__ */ jsx5(
                            "a",
                            {
                              href: a.presigned_url,
                              target: "_blank",
                              rel: "noreferrer",
                              className: "shrink-0",
                              children: /* @__PURE__ */ jsx5(
                                "img",
                                {
                                  src: a.presigned_url,
                                  alt: label,
                                  className: "h-10 w-10 rounded object-cover",
                                  loading: "lazy"
                                }
                              )
                            }
                          ) : null,
                          /* @__PURE__ */ jsx5("span", { className: "flex-1 truncate font-mono", children: label }),
                          /* @__PURE__ */ jsxs4("span", { className: "text-muted-foreground shrink-0", children: [
                            (a.byte_size / 1024).toFixed(1),
                            " KB"
                          ] }),
                          a.presigned_url ? /* @__PURE__ */ jsx5(
                            "a",
                            {
                              href: a.presigned_url,
                              target: "_blank",
                              rel: "noreferrer",
                              className: "shrink-0 text-primary hover:underline",
                              children: t("feedback.mine.open")
                            }
                          ) : null
                        ]
                      },
                      a.id
                    );
                  }) })
                ] }) : null,
                /* @__PURE__ */ jsx5(CommentThread, { feedbackId: r.id }),
                onSelectTicket ? /* @__PURE__ */ jsx5(
                  "button",
                  {
                    type: "button",
                    onClick: () => onSelectTicket(r),
                    className: "text-primary hover:underline",
                    "data-feedback-id": "feedback.mine.deeplink",
                    children: t("feedback.mine.open_in_app")
                  }
                ) : null
              ]
            }
          ) : null
        ]
      }
    ) }, r.id);
  }) });
}
function useMyPendingActionCount() {
  const query = useMyFeedbackQuery(25);
  return (query.data ?? []).filter((r) => r.status === "done").length;
}

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
async function captureElementScreenshot(element, options) {
  return _renderToBlob(element, options);
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

// src/ui/input.tsx
import { jsx as jsx6 } from "react/jsx-runtime";
function Input({ className, type, ...props }) {
  return /* @__PURE__ */ jsx6(
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
import { jsx as jsx7, jsxs as jsxs5 } from "react/jsx-runtime";
function Select({ ...props }) {
  return /* @__PURE__ */ jsx7(SelectPrimitive.Root, { "data-slot": "select", ...props });
}
function SelectValue({ ...props }) {
  return /* @__PURE__ */ jsx7(SelectPrimitive.Value, { "data-slot": "select-value", ...props });
}
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs5(
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
        /* @__PURE__ */ jsx7(SelectPrimitive.Icon, { asChild: true, children: /* @__PURE__ */ jsx7(ChevronDownIcon, { className: "size-4 opacity-50" }) })
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
  return /* @__PURE__ */ jsx7(SelectPrimitive.Portal, { children: /* @__PURE__ */ jsxs5(
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
        /* @__PURE__ */ jsx7(SelectScrollUpButton, {}),
        /* @__PURE__ */ jsx7(
          SelectPrimitive.Viewport,
          {
            className: cn(
              "p-1",
              position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1"
            ),
            children
          }
        ),
        /* @__PURE__ */ jsx7(SelectScrollDownButton, {})
      ]
    }
  ) });
}
function SelectItem({
  className,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs5(
    SelectPrimitive.Item,
    {
      "data-slot": "select-item",
      className: cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      ),
      ...props,
      children: [
        /* @__PURE__ */ jsx7("span", { className: "absolute right-2 flex size-3.5 items-center justify-center", children: /* @__PURE__ */ jsx7(SelectPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx7(CheckIcon, { className: "size-4" }) }) }),
        /* @__PURE__ */ jsx7(SelectPrimitive.ItemText, { children })
      ]
    }
  );
}
function SelectScrollUpButton({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx7(
    SelectPrimitive.ScrollUpButton,
    {
      "data-slot": "select-scroll-up-button",
      className: cn("flex cursor-default items-center justify-center py-1", className),
      ...props,
      children: /* @__PURE__ */ jsx7(ChevronUpIcon, { className: "size-4" })
    }
  );
}
function SelectScrollDownButton({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx7(
    SelectPrimitive.ScrollDownButton,
    {
      "data-slot": "select-scroll-down-button",
      className: cn("flex cursor-default items-center justify-center py-1", className),
      ...props,
      children: /* @__PURE__ */ jsx7(ChevronDownIcon, { className: "size-4" })
    }
  );
}

export {
  Badge,
  Input,
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  Rl3Mark,
  CommentThread,
  MyTicketsPanel,
  useMyPendingActionCount,
  capturePageScreenshot,
  captureElementScreenshot,
  describeElement
};
//# sourceMappingURL=chunk-Q5UBLLIC.js.map