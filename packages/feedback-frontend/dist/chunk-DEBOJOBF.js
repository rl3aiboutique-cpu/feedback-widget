// src/chat/FeedbackChatSheet.tsx
import { useCallback as useCallback5, useEffect as useEffect7, useState as useState7 } from "react";

// src/FeedbackProvider.tsx
import { createContext, useContext, useMemo as useMemo2 } from "react";

// src/adapter.ts
import {
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { useMemo } from "react";

// src/locales/en.ts
var en = {
  "feedback.open_button": "Send feedback with RL3 Feedback",
  "feedback.open_button_with_pending": "RL3 Feedback \u2014 {count} ticket(s) updated recently",
  "feedback.tab.submit": "Submit feedback",
  "feedback.tab.mine": "My tickets",
  "feedback.mine.loading": "Loading your tickets\u2026",
  "feedback.mine.empty": "You haven't submitted any feedback yet.",
  "feedback.mine.error": "Could not load your tickets. Please retry later.",
  "feedback.mine.action_hint": "We marked this resolved. Reply by email or file fresh feedback if it's still not right.",
  "feedback.mine.submitted_at": "Submitted {date} UTC",
  "feedback.mine.no_description": "(no description)",
  "feedback.mine.triage_note": "Note from the team",
  "feedback.mine.attachments": "Attachments ({count})",
  "feedback.mine.open": "Open",
  "feedback.mine.open_in_app": "Open in app \u2192",
  "feedback.comments.thread_title": "Conversation",
  "feedback.comments.loading": "Loading messages\u2026",
  "feedback.comments.error": "Could not load messages.",
  "feedback.comments.empty": "No messages yet \u2014 be the first to reply.",
  "feedback.comments.placeholder": "Write a reply\u2026",
  "feedback.comments.send": "Send",
  "feedback.comments.sending": "Sending\u2026",
  "feedback.comments.send_error": "Could not send the message. Please retry.",
  "feedback.comments.send_unauthorized": "You don't have permission to post on this ticket. Try refreshing the page.",
  "feedback.comments.admin_label": "Team",
  "feedback.comments.submitter_label": "Submitter",
  "feedback.comments.you_label": "You",
  "feedback.button_label": "Feedback",
  "feedback.panel_title": "RL3 Feedback",
  "feedback.panel_description": "Tell us what's on your mind. We capture page context for triage.",
  "feedback.powered_by": "powered by",
  "feedback.powered_by_aria": "Powered by RL3 AI Agency",
  "feedback.optional": "optional",
  "feedback.mode_label": "Capture",
  "feedback.mode_whole_page": "Whole page",
  "feedback.mode_select_element": "Select element",
  "feedback.mode_select_element_hint": "We'll take you to the page: hover over any element and click to lock it.",
  "feedback.element_locked": "Element locked",
  "feedback.clear_element": "Clear element",
  "feedback.element_selector_active": "Element-selector mode active. Click to lock, ESC to cancel.",
  "feedback.element_selector_hint": "Move the mouse to highlight \xB7 Click to lock \xB7 ESC to cancel",
  "feedback.type_label": "Type",
  "feedback.type_placeholder": "Pick a category\u2026",
  "feedback.type.bug": "Bug",
  "feedback.type.bug_hint": "Something is broken or behaves wrong. Use this when reality doesn't match expectation.",
  "feedback.type.ui": "UI",
  "feedback.type.ui_hint": "Something on screen feels off \u2014 copy, layout, contrast, hierarchy, motion.",
  "feedback.type.performance": "Performance",
  "feedback.type.performance_hint": "Something is technically working but unacceptably slow.",
  "feedback.type.new_feature": "New feature",
  "feedback.type.new_feature_hint": "A capability that doesn't exist yet.",
  "feedback.type.extend_feature": "Extend feature",
  "feedback.type.extend_feature_hint": "Something exists but doesn't go far enough.",
  "feedback.type.other": "Other",
  "feedback.type.other_hint": "Anything that doesn't fit the categories above.",
  "feedback.field.title": "Title",
  "feedback.field.title_hint": "Short, specific summary. Will be the email subject.",
  "feedback.field.title_placeholder": "Short summary\u2026",
  "feedback.field.description": "What's happening?",
  "feedback.field.description_placeholder": "Describe what you're seeing or what's missing. Be concrete.",
  "feedback.field.expected_outcome": "How should it work?",
  "feedback.field.expected_outcome_placeholder": "What you'd expect instead.",
  "feedback.attachments.label": "Attachments",
  "feedback.attachments.hint": "Wireframes, drawings, external logs, notes \u2014 up to 5 files of 10 MB each.",
  "feedback.attachments.dropzone": "Drop files here or click to choose",
  "feedback.attachments.too_many": "Up to {max} files per submission.",
  "feedback.attachments.too_big": "{name} is too large (max {max}).",
  "feedback.attachments.bad_type": "{name} has an unsupported file type. We accept images (PNG/JPG/GIF/WebP), PDFs, plain text, markdown, and JSON.",
  "feedback.attachments.remove": "Remove {name}",
  "feedback.metadata_disclosure": "We capture page URL and basic context (viewport, recent logs) to help triage. Tokens and cookies are redacted automatically.",
  "feedback.cancel": "Cancel",
  "feedback.submit": "Send feedback",
  "feedback.submitting": "Sending\u2026",
  "feedback.submit_disabled_until_form": "Pick a type first",
  "feedback.toast_success": "Feedback sent \xB7 {id}",
  "feedback.toast_success_link": "Open in admin",
  "feedback.toast_error_generic": "Could not send the feedback. Try again.",
  "feedback.toast_error_429": "Too much feedback. Retry in {seconds}s.",
  "feedback.toast_error_required_field": "Required: {field}.",
  "feedback.toast_screenshot_failed": "Could not capture the screen. Sending the feedback without it."
};

// src/locales/index.ts
var _DICTIONARIES = { en };
function createTranslator(_options) {
  return function t(key, vars) {
    let msg = _DICTIONARIES.en?.[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        msg = msg.split(`{${k}}`).join(v);
      }
    }
    return msg;
  };
}

// src/redactors.ts
var _ZERO_WIDTH = "";
var _DEFAULT_PATTERNS = [
  // Authorization: Bearer xxx / Authorization: Basic xxx → keep the header,
  // wipe the value. Multiline-friendly via [^\r\n]+.
  {
    re: /(authorization\s*[:=]\s*)[^\r\n]+/gi,
    replace: (m) => m.replace(/(authorization\s*[:=]\s*)[^\r\n]+/i, "$1[REDACTED]")
  },
  // Bare bearer tokens outside a header context.
  {
    re: /\bbearer\s+[A-Za-z0-9._\-+/=]+/gi,
    replace: () => "[REDACTED]"
  },
  // JWT-shaped triples (three base64url segments separated by dots).
  {
    re: /\b[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/g,
    replace: () => "[REDACTED]"
  },
  // CC-like 13–19 digit runs separated by spaces or dashes.
  {
    re: /\b(?:\d[ -]?){12,18}\d\b/g,
    replace: () => "[REDACTED]"
  },
  // OAuth-style query string tokens.
  {
    re: /\b(access_token|refresh_token|id_token|api[_-]?key|secret)=[^\s&]+/gi,
    replace: (m) => m.replace(
      /\b(access_token|refresh_token|id_token|api[_-]?key|secret)=[^\s&]+/i,
      "$1=[REDACTED]"
    )
  },
  // Cookie header values.
  {
    re: /(cookie\s*[:=]\s*)[^\r\n]+/gi,
    replace: (m) => m.replace(/(cookie\s*[:=]\s*)[^\r\n]+/i, "$1[REDACTED]")
  }
];
var _hostRedactors = [];
function registerRedactor(fn) {
  _hostRedactors.push(fn);
}
function redactString(value) {
  let out = value;
  for (const { re, replace } of _DEFAULT_PATTERNS) {
    out = out.replace(re, replace);
  }
  for (const fn of _hostRedactors) {
    try {
      out = fn(out);
    } catch {
    }
  }
  return out + _ZERO_WIDTH;
}
var DEFAULT_REDACTION_SELECTORS = Object.freeze([
  'input[type="password"]',
  'input[autocomplete="one-time-code"]',
  '[data-feedback-redact="true"]'
]);

// src/adapter.ts
var _DEFAULT_TOAST = {
  success: (msg) => {
    if (typeof window !== "undefined") console.log("[feedback]", msg);
  },
  error: (msg) => {
    if (typeof window !== "undefined") console.error("[feedback]", msg);
  },
  info: (msg) => {
    if (typeof window !== "undefined") console.info("[feedback]", msg);
  },
  warning: (msg) => {
    if (typeof window !== "undefined") console.warn("[feedback]", msg);
  }
};
var ENV_APP_VERSION = import.meta.env.VITE_APP_VERSION || (typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "") || "0.0.0-dev";
var ENV_GIT_SHA = import.meta.env.VITE_GIT_COMMIT_SHA || (typeof __GIT_COMMIT_SHA__ !== "undefined" ? __GIT_COMMIT_SHA__ : "") || "unknown";
var SubmitFeedbackError = class extends Error {
  constructor(status, body, retryAfter) {
    super(`POST /feedback failed with ${status}`);
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
    this.name = "SubmitFeedbackError";
  }
  status;
  body;
  retryAfter;
};
var FeedbackApiError = class extends Error {
  constructor(status, path, detail, retryAfter) {
    super(`${path} failed with ${status}`);
    this.status = status;
    this.path = path;
    this.detail = detail;
    this.retryAfter = retryAfter;
    this.name = "FeedbackApiError";
  }
  status;
  path;
  detail;
  retryAfter;
};
async function _throwApiError(path, resp) {
  let detail;
  try {
    const data = await resp.json();
    detail = typeof data === "string" ? data : data && typeof data === "object" && "detail" in data ? String(data.detail) : JSON.stringify(data);
  } catch {
    detail = await resp.text().catch(() => "");
  }
  throw new FeedbackApiError(resp.status, path, detail, resp.headers.get("Retry-After"));
}
function _resolvePrefix(b) {
  return b.apiPathPrefix ?? "/api/v1/feedback";
}
function _resolveBase(b) {
  return b.apiBaseUrl.replace(/\/$/, "");
}
async function _buildHeaders(bindings, base = {}) {
  const headers = { ...base };
  try {
    const csrfToken = await bindings.getCsrfToken();
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[feedback] getCsrfToken threw, proceeding without CSRF token", err);
    }
  }
  if (bindings.authHeader) {
    try {
      const auth = await bindings.authHeader();
      if (auth) headers.Authorization = auth;
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[feedback] authHeader threw, proceeding without Authorization", err);
      }
    }
  }
  return headers;
}
async function submitFeedback(bindings, payloadJson, screenshot, attachments) {
  const form = new FormData();
  form.append("payload", payloadJson);
  if (screenshot) {
    form.append("screenshot", screenshot, "screenshot.png");
  }
  if (attachments && attachments.length > 0) {
    for (const file of attachments) {
      form.append("attachments", file, file.name);
    }
  }
  const headers = await _buildHeaders(bindings);
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}`;
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers,
    body: form
  });
  if (!resp.ok) {
    let detail;
    try {
      detail = await resp.json();
    } catch {
      detail = await resp.text().catch(() => "");
    }
    throw new SubmitFeedbackError(
      resp.status,
      typeof detail === "string" ? detail : JSON.stringify(detail),
      resp.headers.get("Retry-After")
    );
  }
  return await resp.json();
}
async function downloadFeedbackBundleViaBindings(bindings, feedbackId) {
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}/${encodeURIComponent(
    feedbackId
  )}/download`;
  const headers = await _buildHeaders(bindings);
  const resp = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`GET /feedback/${feedbackId}/download failed (${resp.status}) ${text}`);
  }
  const cd = resp.headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `feedback-${feedbackId}.zip`;
  return { blob: await resp.blob(), filename };
}
async function _getJson(bindings, path, query) {
  const url = new URL(`${_resolveBase(bindings)}${_resolvePrefix(bindings)}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== void 0 && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const headers = await _buildHeaders(bindings);
  const resp = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
    headers
  });
  if (!resp.ok) {
    await _throwApiError(`GET ${path}`, resp);
  }
  return await resp.json();
}
async function _patchJson(bindings, path, body) {
  const headers = await _buildHeaders(bindings, {
    "Content-Type": "application/json"
  });
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}${path}`;
  const resp = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    await _throwApiError(`PATCH ${path}`, resp);
  }
  return await resp.json();
}
async function _deleteJson(bindings, path) {
  const headers = await _buildHeaders(bindings);
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}${path}`;
  const resp = await fetch(url, {
    method: "DELETE",
    credentials: "include",
    headers
  });
  if (!resp.ok) {
    await _throwApiError(`DELETE ${path}`, resp);
  }
}
function useCurrentUser() {
  const bindings = useFeedbackBindings();
  return bindings.useCurrentUser();
}
function getDeepLinkToFeedback(id, base) {
  if (base) return `${base.replace(/\/$/, "")}/admin/feedback?id=${id}`;
  if (typeof window === "undefined") return `/admin/feedback?id=${id}`;
  return `${window.location.origin}/admin/feedback?id=${id}`;
}
function getDefaultRedactionSelectors() {
  return DEFAULT_REDACTION_SELECTORS;
}
function useTranslation() {
  const config = useFeedbackConfig();
  return useMemo(() => createTranslator({ locale: config.locale }), [config.locale]);
}
var APP_VERSION = ENV_APP_VERSION;
var GIT_COMMIT_SHA = ENV_GIT_SHA;
function useFeedbackListQuery(filters) {
  const bindings = useFeedbackBindings();
  return useQuery({
    queryKey: ["feedback", "list", filters],
    queryFn: () => _getJson(bindings, "", {
      type: filters.type ?? void 0,
      status: filters.status ?? void 0,
      q: filters.q?.trim() || void 0,
      page: filters.page ?? 1,
      page_size: filters.pageSize ?? 50
    })
  });
}
function useMyFeedbackQuery(limit = 25) {
  const bindings = useFeedbackBindings();
  return useQuery({
    queryKey: ["feedback", "mine", limit],
    queryFn: () => _getJson(bindings, "/mine", { limit }),
    refetchInterval: 6e4,
    staleTime: 3e4
  });
}
function useFeedbackDetailQuery(feedbackId) {
  const bindings = useFeedbackBindings();
  return useQuery({
    queryKey: ["feedback", "detail", feedbackId],
    queryFn: () => feedbackId ? _getJson(bindings, `/${encodeURIComponent(feedbackId)}`) : Promise.resolve(null),
    enabled: !!feedbackId
  });
}
function useUpdateFeedbackStatusMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => _patchJson(bindings, `/${encodeURIComponent(input.id)}/status`, {
      status: input.status,
      triage_note: input.triage_note ?? null
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    }
  });
}
function useDeleteFeedbackMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => _deleteJson(bindings, `/${encodeURIComponent(id)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    }
  });
}
async function _postJson(bindings, path, body) {
  const headers = await _buildHeaders(bindings, {
    "Content-Type": "application/json"
  });
  const url = `${_resolveBase(bindings)}${_resolvePrefix(bindings)}${path}`;
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    await _throwApiError(`POST ${path}`, resp);
  }
  return await resp.json();
}
function useFeedbackCommentsQuery(feedbackId) {
  const bindings = useFeedbackBindings();
  return useQuery({
    queryKey: ["feedback", "comments", feedbackId],
    queryFn: () => feedbackId ? _getJson(
      bindings,
      `/${encodeURIComponent(feedbackId)}/comments`
    ) : Promise.resolve({
      data: [],
      count: 0
    }),
    enabled: !!feedbackId,
    refetchInterval: 3e4,
    staleTime: 15e3
  });
}
function usePostFeedbackCommentMutation() {
  const bindings = useFeedbackBindings();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => _postJson(
      bindings,
      `/${encodeURIComponent(input.feedbackId)}/comments`,
      { body: input.body }
    ),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ["feedback", "comments", input.feedbackId]
      });
    }
  });
}
function createAdapter(bindings) {
  const adapter = {
    useCurrentUser,
    appVersion: APP_VERSION,
    gitSha: GIT_COMMIT_SHA,
    submitFeedback: (payloadJson, screenshot, attachments) => submitFeedback(bindings, payloadJson, screenshot, attachments),
    downloadFeedbackBundle: (feedbackId) => downloadFeedbackBundleViaBindings(bindings, feedbackId),
    getDeepLinkToFeedback: (id) => getDeepLinkToFeedback(id, bindings.getDeepLinkBase?.()),
    getDefaultRedactionSelectors,
    registerRedactor,
    useTranslation,
    toast: bindings.toast ?? _DEFAULT_TOAST
  };
  return Object.freeze(adapter);
}

// src/FeedbackProvider.tsx
import { jsx } from "react/jsx-runtime";
var _ENV_ENABLED = (import.meta.env.VITE_FEEDBACK_ENABLED ?? "true").toString().toLowerCase() !== "false";
var _ENV_POSITION = import.meta.env.VITE_FEEDBACK_POSITION ?? "bottom_right";
var _ENV_BRAND = import.meta.env.VITE_FEEDBACK_BRAND_PRIMARY_HEX || "";
var _ENV_LOCALE = "en";
var DEFAULT_CONFIG = Object.freeze({
  enabled: _ENV_ENABLED,
  position: _ENV_POSITION,
  brandPrimaryHex: _ENV_BRAND,
  locale: _ENV_LOCALE,
  iterStyle: "focus"
});
var FeedbackContext = createContext(null);
function FeedbackProvider({ children, bindings, adapter, config }) {
  if (!bindings || typeof bindings.useCurrentUser !== "function") {
    throw new Error(
      "FeedbackProvider: `bindings` prop is required and must include `useCurrentUser`. See @rl3/feedback-widget README for the FeedbackHostBindings contract."
    );
  }
  const value = useMemo2(
    () => ({
      bindings,
      adapter: adapter ?? createAdapter(bindings),
      config: { ...DEFAULT_CONFIG, ...config ?? {} }
    }),
    [bindings, adapter, config]
  );
  return /* @__PURE__ */ jsx(FeedbackContext.Provider, { value, children });
}
function useFeedbackContext() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error(
      "useFeedbackContext must be called inside <FeedbackProvider>. Mount the provider at the app root before rendering any widget component."
    );
  }
  return ctx;
}
function useFeedbackAdapter() {
  return useFeedbackContext().adapter;
}
function useFeedbackConfig() {
  return useFeedbackContext().config;
}
function useFeedbackBindings() {
  return useFeedbackContext().bindings;
}

// src/Rl3Mark.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
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
        /* @__PURE__ */ jsx2("defs", { children: /* @__PURE__ */ jsxs(
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

// src/ui/sheet.tsx
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

// src/lib/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// src/ui/sheet.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function Sheet({ ...props }) {
  return /* @__PURE__ */ jsx3(SheetPrimitive.Root, { "data-slot": "sheet", ...props });
}
function SheetPortal({ ...props }) {
  return /* @__PURE__ */ jsx3(SheetPrimitive.Portal, { "data-slot": "sheet-portal", ...props });
}
function SheetOverlay({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx3(
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
    /* @__PURE__ */ jsx3(SheetOverlay, {}),
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
            /* @__PURE__ */ jsx3(XIcon, { className: "size-4" }),
            /* @__PURE__ */ jsx3("span", { className: "sr-only", children: "Close" })
          ] })
        ]
      }
    )
  ] });
}
function SheetHeader({ className, ...props }) {
  return /* @__PURE__ */ jsx3(
    "div",
    {
      "data-slot": "sheet-header",
      className: cn("flex flex-col gap-1.5 p-4", className),
      ...props
    }
  );
}
function SheetTitle({ className, ...props }) {
  return /* @__PURE__ */ jsx3(
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
  return /* @__PURE__ */ jsx3(
    SheetPrimitive.Description,
    {
      "data-slot": "sheet-description",
      className: cn("text-muted-foreground text-sm", className),
      ...props
    }
  );
}

// src/chat/CapturePicker.tsx
import { Image as ImageIcon, MousePointer2, X } from "lucide-react";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
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
      /* @__PURE__ */ jsx4("span", { className: "uppercase tracking-wide", children: t("feedback.mode_label") }),
      mode === "element" && locked ? /* @__PURE__ */ jsxs3("code", { className: "font-mono truncate max-w-[220px] rounded bg-muted px-1.5 py-0.5", children: [
        /* @__PURE__ */ jsx4(MousePointer2, { className: "mr-1 inline h-3 w-3" }),
        locked.selector
      ] }) : /* @__PURE__ */ jsxs3("span", { className: "inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5", children: [
        /* @__PURE__ */ jsx4(ImageIcon, { className: "h-3 w-3" }),
        t("feedback.mode_whole_page")
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs3("div", { className: "flex flex-wrap items-center gap-2", children: [
    /* @__PURE__ */ jsx4("span", { className: "text-[10px] uppercase tracking-wider text-muted-foreground", children: t("feedback.mode_label") }),
    /* @__PURE__ */ jsxs3("div", { className: "inline-flex items-center rounded-full border border-input/60 bg-muted/30 p-0.5", children: [
      /* @__PURE__ */ jsxs3(
        "button",
        {
          type: "button",
          onClick: () => {
            onModeChange("page");
            onClearLocked();
          },
          "data-feedback-id": "feedback.mode_whole_page",
          className: [
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
            mode === "page" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          ].join(" "),
          children: [
            /* @__PURE__ */ jsx4(ImageIcon, { className: "h-3.5 w-3.5" }),
            t("feedback.mode_whole_page")
          ]
        }
      ),
      /* @__PURE__ */ jsxs3(
        "button",
        {
          type: "button",
          onClick: onActivatePicker,
          "data-feedback-id": "feedback.mode_select_element",
          className: [
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
            mode === "element" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          ].join(" "),
          children: [
            /* @__PURE__ */ jsx4(MousePointer2, { className: "h-3.5 w-3.5" }),
            t("feedback.mode_select_element")
          ]
        }
      )
    ] }),
    mode === "element" && locked ? /* @__PURE__ */ jsxs3("span", { className: "ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px]", children: [
      /* @__PURE__ */ jsx4("code", { className: "font-mono truncate max-w-[180px]", children: locked.selector }),
      /* @__PURE__ */ jsx4(
        "button",
        {
          type: "button",
          onClick: () => {
            onClearLocked();
            onModeChange("page");
          },
          className: "rounded-full p-0.5 text-primary hover:bg-primary/20",
          "data-feedback-id": "feedback.clear_element",
          "aria-label": "Clear locked element",
          children: /* @__PURE__ */ jsx4(X, { className: "h-3 w-3" })
        }
      )
    ] }) : null
  ] });
}

// src/chat/CapturePreview.tsx
import { Image as ImageIcon2, X as X2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Fragment, jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
function _Lightbox({
  url,
  onClose
}) {
  useEffect(() => {
    function handler(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }
  return /* @__PURE__ */ jsxs4(
    "div",
    {
      className: "fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Captura adjunta \u2014 vista ampliada",
      onClick: onBackdropClick,
      children: [
        /* @__PURE__ */ jsx5(
          "button",
          {
            type: "button",
            onClick: onClose,
            "aria-label": "Cerrar vista ampliada",
            className: "absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition hover:bg-background",
            children: /* @__PURE__ */ jsx5(X2, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsx5(
          "img",
          {
            src: url,
            alt: "Captura adjunta \u2014 vista ampliada",
            className: "max-h-[90vh] max-w-[90vw] rounded-md border border-input/40 shadow-2xl"
          }
        )
      ]
    }
  );
}
function CapturePreview({
  blob,
  mode,
  selector,
  onClear
}) {
  const [url, setUrl] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
    };
  }, [blob]);
  if (!blob || !url) {
    return null;
  }
  const isElement = mode === "element" && selector;
  const captionPrimary = isElement ? "Elemento capturado" : "P\xE1gina completa";
  return /* @__PURE__ */ jsxs4(Fragment, { children: [
    /* @__PURE__ */ jsxs4("div", { className: "mx-4 mt-2 mb-1 flex items-center gap-2 rounded-md border border-input/60 bg-muted/30 p-2", children: [
      /* @__PURE__ */ jsx5(
        "button",
        {
          type: "button",
          onClick: () => setLightboxOpen(true),
          "aria-label": "Ampliar captura",
          className: "block shrink-0 overflow-hidden rounded border border-input transition hover:ring-2 hover:ring-primary/30",
          children: /* @__PURE__ */ jsx5(
            "img",
            {
              src: url,
              alt: "Captura adjunta",
              className: "h-16 w-24 object-cover"
            }
          )
        }
      ),
      /* @__PURE__ */ jsxs4("div", { className: "flex min-w-0 flex-1 flex-col gap-0.5", children: [
        /* @__PURE__ */ jsxs4("span", { className: "flex items-center gap-1 text-xs font-medium text-foreground", children: [
          /* @__PURE__ */ jsx5(ImageIcon2, { className: "h-3 w-3" }),
          captionPrimary
        ] }),
        /* @__PURE__ */ jsx5("span", { className: "truncate text-[10px] text-muted-foreground", children: isElement ? /* @__PURE__ */ jsx5("code", { className: "font-mono", children: selector }) : /* @__PURE__ */ jsxs4(Fragment, { children: [
          formatBytes(blob.size),
          " \xB7 click para ampliar"
        ] }) }),
        isElement ? /* @__PURE__ */ jsxs4("span", { className: "text-[10px] text-muted-foreground", children: [
          formatBytes(blob.size),
          " \xB7 click para ampliar"
        ] }) : null
      ] }),
      onClear ? /* @__PURE__ */ jsx5(
        "button",
        {
          type: "button",
          onClick: onClear,
          "aria-label": "Quitar captura",
          className: "ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-destructive",
          children: /* @__PURE__ */ jsx5(X2, { className: "h-3.5 w-3.5" })
        }
      ) : null
    ] }),
    lightboxOpen ? /* @__PURE__ */ jsx5(_Lightbox, { url, onClose: () => setLightboxOpen(false) }) : null
  ] });
}

// src/chat/ChatTimeline.tsx
import { Sparkles } from "lucide-react";
import { useEffect as useEffect2, useRef } from "react";

// src/chat/ChatBubble.tsx
import { Users } from "lucide-react";
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function AssistantAvatar() {
  return /* @__PURE__ */ jsx6(
    "div",
    {
      className: "flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-primary/90 to-primary/60 text-[10px] font-bold text-primary-foreground shadow-sm",
      "aria-hidden": "true",
      children: "RL3"
    }
  );
}
function ChatBubble({ role, text, caption }) {
  const isUser = role === "user";
  const isAdmin = role === "admin";
  const isAssistant = role === "assistant";
  const bubbleClass = isUser ? "rounded-2xl rounded-tr-md border-primary/30 bg-primary/10 text-foreground" : isAdmin ? "rounded-2xl rounded-tl-md border-violet-500/40 bg-violet-500/10 text-foreground" : "rounded-2xl rounded-tl-md border-input/60 bg-muted/60 text-foreground shadow-sm";
  return /* @__PURE__ */ jsxs5("div", { className: `flex w-full ${isUser ? "justify-end" : "justify-start"}`, children: [
    isAssistant || isAdmin ? /* @__PURE__ */ jsx6("div", { className: "mr-2 mt-0.5", children: /* @__PURE__ */ jsx6(AssistantAvatar, {}) }) : null,
    /* @__PURE__ */ jsxs5("div", { className: `flex max-w-[78%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`, children: [
      isAdmin && caption ? /* @__PURE__ */ jsxs5("span", { className: "inline-flex items-center gap-1 text-[10px] font-medium text-violet-700", children: [
        /* @__PURE__ */ jsx6(Users, { className: "h-3 w-3", "aria-hidden": "true" }),
        caption
      ] }) : null,
      /* @__PURE__ */ jsx6(
        "div",
        {
          className: [
            "whitespace-pre-wrap break-words border px-3.5 py-2 text-sm leading-relaxed",
            bubbleClass
          ].join(" "),
          "data-feedback-id": isAdmin ? "feedback.chat_bubble.admin" : isAssistant ? "feedback.chat_bubble.assistant" : "feedback.chat_bubble.user",
          children: text
        }
      )
    ] })
  ] });
}

// src/chat/ChatTimeline.tsx
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
function ChatTimeline({
  messages,
  isThinking = false,
  thinkingLabel
}) {
  const endRef = useRef(null);
  useEffect2(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isThinking]);
  const isEmpty = messages.length === 0 && !isThinking;
  const hasOnlyGreeting = messages.length === 1 && messages[0]?.role === "assistant" && !isThinking;
  return /* @__PURE__ */ jsxs6("div", { className: "flex flex-col gap-3 px-4 py-3", children: [
    messages.map((m, idx) => /* @__PURE__ */ jsx7(ChatBubble, { role: m.role, text: m.text }, `${m.role}-${m.ts}-${idx}`)),
    isThinking ? /* @__PURE__ */ jsx7(_ThinkingIndicator, { label: thinkingLabel }) : null,
    isEmpty || hasOnlyGreeting ? /* @__PURE__ */ jsx7(_HelperHint, {}) : null,
    /* @__PURE__ */ jsx7("div", { ref: endRef, "aria-hidden": "true" })
  ] });
}
function _HelperHint() {
  return /* @__PURE__ */ jsxs6("div", { className: "mx-auto mt-2 flex max-w-[85%] flex-col items-center gap-1 rounded-xl border border-dashed border-input/50 bg-muted/20 px-4 py-3 text-center", children: [
    /* @__PURE__ */ jsx7(Sparkles, { className: "h-4 w-4 text-primary/70", "aria-hidden": "true" }),
    /* @__PURE__ */ jsx7("p", { className: "text-xs text-muted-foreground", children: "Te har\xE9 1-2 preguntas cortas para entender qu\xE9 buscas. Empieza cont\xE1ndome qu\xE9 pas\xF3." })
  ] });
}
function _ThinkingIndicator({ label }) {
  return /* @__PURE__ */ jsx7("div", { className: "flex w-full justify-start", children: /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-2 rounded-2xl border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground", children: [
    /* @__PURE__ */ jsxs6("span", { className: "flex items-center gap-1", "aria-hidden": "true", children: [
      /* @__PURE__ */ jsx7("span", { className: "h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" }),
      /* @__PURE__ */ jsx7("span", { className: "h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" }),
      /* @__PURE__ */ jsx7("span", { className: "h-1.5 w-1.5 animate-bounce rounded-full bg-current" })
    ] }),
    label ? /* @__PURE__ */ jsx7("span", { className: "text-xs", children: label }) : null
  ] }) });
}

// src/chat/Composer.tsx
import { Mic, SendHorizontal } from "lucide-react";
import {
  useCallback as useCallback2,
  useEffect as useEffect4,
  useRef as useRef3,
  useState as useState3
} from "react";

// src/ui/button.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { jsx as jsx8 } from "react/jsx-runtime";
var buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "button";
  return /* @__PURE__ */ jsx8(
    Comp,
    {
      "data-slot": "button",
      className: cn(buttonVariants({ variant, size, className })),
      ...props
    }
  );
}

// src/ui/textarea.tsx
import { jsx as jsx9 } from "react/jsx-runtime";
function Textarea({ className, ...props }) {
  return /* @__PURE__ */ jsx9(
    "textarea",
    {
      "data-slot": "textarea",
      className: cn(
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      ),
      ...props
    }
  );
}

// src/chat/useVoiceCapture.ts
import { useCallback, useEffect as useEffect3, useRef as useRef2, useState as useState2 } from "react";
var _MAX_DURATION_MS = 3e4;
var _TICK_INTERVAL_MS = 250;
var AUDIO_LEVEL_BARS = 40;
var _LEVEL_FRAME_INTERVAL_MS = 1e3 / 30;
var _PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus"
];
function isVoiceCaptureSupported() {
  if (typeof window === "undefined") return false;
  if (typeof window.MediaRecorder === "undefined") return false;
  const md = window.navigator?.mediaDevices;
  if (!md || typeof md.getUserMedia !== "function") return false;
  return true;
}
function _pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const mt of _PREFERRED_MIME_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(mt)) return mt;
    } catch {
    }
  }
  return "audio/webm";
}
function _getAudioContextCtor() {
  if (typeof window === "undefined") return null;
  const w = window;
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}
function useVoiceCapture() {
  const [state, setState] = useState2("idle");
  const [duration_ms, setDurationMs] = useState2(0);
  const [error, setError] = useState2(null);
  const recorderRef = useRef2(null);
  const streamRef = useRef2(null);
  const chunksRef = useRef2([]);
  const startedAtRef = useRef2(0);
  const tickTimerRef = useRef2(null);
  const autoStopTimerRef = useRef2(null);
  const stopResolverRef = useRef2(null);
  const audioCtxRef = useRef2(null);
  const analyserRef = useRef2(null);
  const sourceRef = useRef2(null);
  const levelsRef = useRef2(new Float32Array(AUDIO_LEVEL_BARS));
  const levelsCursorRef = useRef2(0);
  const levelRafRef = useRef2(null);
  const levelLastTsRef = useRef2(0);
  const analyserBufRef = useRef2(null);
  const _stopLevelLoop = useCallback(() => {
    if (levelRafRef.current !== null) {
      if (typeof window !== "undefined") {
        window.cancelAnimationFrame(levelRafRef.current);
      }
      levelRafRef.current = null;
    }
    levelLastTsRef.current = 0;
  }, []);
  const _resetLevels = useCallback(() => {
    levelsRef.current.fill(0);
    levelsCursorRef.current = 0;
  }, []);
  const _disposeAudioGraph = useCallback(() => {
    _stopLevelLoop();
    try {
      sourceRef.current?.disconnect();
    } catch {
    }
    sourceRef.current = null;
    try {
      analyserRef.current?.disconnect();
    } catch {
    }
    analyserRef.current = null;
    const ctx = audioCtxRef.current;
    if (ctx) {
      try {
        void ctx.close();
      } catch {
      }
    }
    audioCtxRef.current = null;
    analyserBufRef.current = null;
  }, [_stopLevelLoop]);
  const _cleanup = useCallback(() => {
    if (tickTimerRef.current !== null) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    _disposeAudioGraph();
    _resetLevels();
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
        }
      }
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = 0;
  }, [_disposeAudioGraph, _resetLevels]);
  const _tickLevel = useCallback((ts) => {
    const analyser = analyserRef.current;
    const buf = analyserBufRef.current;
    if (!analyser || !buf) {
      levelRafRef.current = null;
      return;
    }
    const last = levelLastTsRef.current;
    if (last !== 0 && ts - last < _LEVEL_FRAME_INTERVAL_MS) {
      levelRafRef.current = window.requestAnimationFrame(_tickLevel);
      return;
    }
    levelLastTsRef.current = ts;
    analyser.getByteTimeDomainData(buf);
    let sumSquares = 0;
    const bufLen = buf.length;
    for (let i = 0; i < bufLen; i++) {
      const sample = ((buf[i] ?? 128) - 128) / 128;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / bufLen);
    const normalised = Math.min(1, Math.max(0, rms * 1.8));
    const cursor = levelsCursorRef.current;
    levelsRef.current[cursor] = normalised;
    levelsCursorRef.current = (cursor + 1) % AUDIO_LEVEL_BARS;
    levelRafRef.current = window.requestAnimationFrame(_tickLevel);
  }, []);
  const _startLevelLoop = useCallback(
    (stream) => {
      const Ctor = _getAudioContextCtor();
      if (!Ctor) return;
      try {
        const ctx = new Ctor();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        src.connect(analyser);
        audioCtxRef.current = ctx;
        sourceRef.current = src;
        analyserRef.current = analyser;
        analyserBufRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        _resetLevels();
        levelLastTsRef.current = 0;
        levelRafRef.current = window.requestAnimationFrame(_tickLevel);
      } catch {
        _disposeAudioGraph();
      }
    },
    [_disposeAudioGraph, _resetLevels, _tickLevel]
  );
  const getAudioLevels = useCallback(() => levelsRef.current, []);
  useEffect3(() => {
    return () => {
      _cleanup();
    };
  }, [_cleanup]);
  const startRecording = useCallback(async () => {
    if (!isVoiceCaptureSupported()) {
      setError("Voice recording is not supported in this browser.");
      setState("error");
      return;
    }
    if (state === "recording" || state === "stopping") return;
    setError(null);
    setDurationMs(0);
    let stream;
    try {
      stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg = err?.message ?? String(err);
      setError(`Microphone access denied: ${msg}`);
      setState("error");
      return;
    }
    const mimeType = _pickMimeType();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch (err) {
      try {
        recorder = new MediaRecorder(stream);
      } catch (err2) {
        for (const track of stream.getTracks()) track.stop();
        const msg = err2?.message ?? String(err2);
        setError(`MediaRecorder unavailable: ${msg}`);
        setState("error");
        return;
      }
      void err;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunksRef.current.push(ev.data);
      }
    };
    recorder.onstop = () => {
      const usedType = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: usedType });
      const elapsed = startedAtRef.current === 0 ? 0 : Date.now() - startedAtRef.current;
      const resolver = stopResolverRef.current;
      stopResolverRef.current = null;
      _cleanup();
      setState("idle");
      setDurationMs(0);
      if (resolver) {
        if (blob.size === 0) {
          resolver(null);
        } else {
          resolver({ blob, duration_ms: elapsed, mime_type: usedType });
        }
      }
    };
    recorder.onerror = (ev) => {
      const detail = ev?.message ?? "MediaRecorder error";
      setError(detail);
      setState("error");
      const resolver = stopResolverRef.current;
      stopResolverRef.current = null;
      _cleanup();
      if (resolver) resolver(null);
    };
    recorderRef.current = recorder;
    streamRef.current = stream;
    startedAtRef.current = Date.now();
    try {
      recorder.start();
    } catch (err) {
      const msg = err?.message ?? String(err);
      _cleanup();
      setError(`Failed to start recorder: ${msg}`);
      setState("error");
      return;
    }
    setState("recording");
    _startLevelLoop(stream);
    tickTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setDurationMs(elapsed);
    }, _TICK_INTERVAL_MS);
    autoStopTimerRef.current = window.setTimeout(() => {
      const r = recorderRef.current;
      if (r && r.state !== "inactive") {
        setState("stopping");
        try {
          r.stop();
        } catch {
        }
      }
    }, _MAX_DURATION_MS);
  }, [_cleanup, _startLevelLoop, state]);
  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return null;
    }
    setState("stopping");
    return new Promise((resolve) => {
      stopResolverRef.current = resolve;
      try {
        recorder.stop();
      } catch {
        stopResolverRef.current = null;
        _cleanup();
        setState("idle");
        resolve(null);
      }
    });
  }, [_cleanup]);
  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
      }
    }
    const resolver = stopResolverRef.current;
    stopResolverRef.current = null;
    _cleanup();
    setState("idle");
    setDurationMs(0);
    setError(null);
    if (resolver) resolver(null);
  }, [_cleanup]);
  return {
    state,
    duration_ms,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    getAudioLevels
  };
}

// src/chat/Composer.tsx
import { jsx as jsx10, jsxs as jsxs7 } from "react/jsx-runtime";
var DEFAULT_PLACEHOLDER = "Escribe lo que tienes en mente\u2026";
function Composer({
  onSend,
  disabled = false,
  placeholder,
  onVoiceToggle,
  value: valueProp,
  onValueChange,
  autoFocus = false
}) {
  const [localValue, setLocalValue] = useState3("");
  const [focused, setFocused] = useState3(false);
  const isControlled = valueProp !== void 0;
  const value = isControlled ? valueProp : localValue;
  const textareaRef = useRef3(null);
  const voiceSupported = isVoiceCaptureSupported();
  const showVoice = typeof onVoiceToggle === "function" && voiceSupported;
  useEffect4(() => {
    if (!autoFocus) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch {
    }
  }, [autoFocus]);
  const setValue = useCallback2(
    (next) => {
      if (isControlled) onValueChange?.(next);
      else setLocalValue(next);
    },
    [isControlled, onValueChange]
  );
  const submit = useCallback2(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue("");
    await onSend(trimmed);
  }, [disabled, onSend, setValue, value]);
  const handleKeyDown = useCallback2(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void submit();
      }
    },
    [submit]
  );
  const hasText = value.trim().length > 0;
  return /* @__PURE__ */ jsxs7("div", { className: "border-t border-input/60 bg-background/95 px-3 pb-2 pt-3 backdrop-blur", children: [
    /* @__PURE__ */ jsxs7(
      "div",
      {
        className: [
          "flex items-end gap-2 rounded-2xl border bg-muted/30 px-2 py-1.5 transition",
          focused ? "border-primary/50 ring-2 ring-primary/20" : "border-input/60"
        ].join(" "),
        children: [
          /* @__PURE__ */ jsx10(
            Textarea,
            {
              ref: textareaRef,
              value,
              onChange: (e) => setValue(e.target.value),
              onKeyDown: handleKeyDown,
              onFocus: () => setFocused(true),
              onBlur: () => setFocused(false),
              disabled,
              placeholder: placeholder ?? DEFAULT_PLACEHOLDER,
              rows: 2,
              className: "max-h-40 min-h-[2.5rem] resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0",
              "data-feedback-id": "feedback.chat_composer"
            }
          ),
          showVoice ? /* @__PURE__ */ jsx10(
            Button,
            {
              type: "button",
              variant: "ghost",
              size: "icon",
              onClick: onVoiceToggle,
              disabled,
              "aria-label": "Grabar mensaje de voz",
              "data-feedback-id": "feedback.chat_mic",
              className: "h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground",
              children: /* @__PURE__ */ jsx10(Mic, { className: "h-4 w-4" })
            }
          ) : null,
          /* @__PURE__ */ jsx10(
            Button,
            {
              type: "button",
              size: "icon",
              onClick: () => void submit(),
              disabled: disabled || !hasText,
              "aria-label": "Enviar",
              "data-feedback-id": "feedback.chat_send",
              className: [
                "h-9 w-9 shrink-0 rounded-full transition",
                hasText ? "bg-gradient-to-br from-primary to-primary/70 shadow-sm hover:shadow-md" : "bg-muted text-muted-foreground"
              ].join(" "),
              children: /* @__PURE__ */ jsx10(SendHorizontal, { className: "h-4 w-4" })
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxs7("p", { className: "mt-1.5 px-1 text-[10px] text-muted-foreground", children: [
      /* @__PURE__ */ jsx10("kbd", { className: "rounded bg-muted/60 px-1 py-px text-foreground/80", children: "\u23CE" }),
      " env\xEDa",
      /* @__PURE__ */ jsx10("span", { className: "mx-1.5", children: "\xB7" }),
      /* @__PURE__ */ jsx10("kbd", { className: "rounded bg-muted/60 px-1 py-px text-foreground/80", children: "\u21E7\u23CE" }),
      " nueva l\xEDnea"
    ] })
  ] });
}

// src/chat/FeedbackTabs.tsx
import { jsx as jsx11, jsxs as jsxs8 } from "react/jsx-runtime";
function FeedbackTabs({
  activeTab,
  mineTotalCount,
  unreadAdminRepliesCount = 0,
  onTabChange
}) {
  return /* @__PURE__ */ jsxs8(
    "div",
    {
      className: "grid grid-cols-2 gap-1 p-1 rounded-md bg-muted text-xs font-medium",
      role: "tablist",
      children: [
        /* @__PURE__ */ jsx11(
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
        /* @__PURE__ */ jsxs8(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": activeTab === "mine",
            onClick: () => onTabChange("mine"),
            className: `flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition-colors ${activeTab === "mine" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
            "data-feedback-id": "feedback.tab.mine",
            children: [
              /* @__PURE__ */ jsx11("span", { children: "\u{1F4CB} Mis feedbacks" }),
              mineTotalCount > 0 ? /* @__PURE__ */ jsx11(
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
import { jsx as jsx12, jsxs as jsxs9 } from "react/jsx-runtime";
function FooterActions({
  state,
  onConfirm,
  onAdjust,
  onRetry
}) {
  if (state === "error") {
    return /* @__PURE__ */ jsx12("div", { className: "flex gap-2 px-3 py-3 border-t border-border bg-background", children: /* @__PURE__ */ jsx12(Button, { type: "button", variant: "default", onClick: onRetry, className: "w-full", children: "\u21BB Reintentar" }) });
  }
  if (state === "confirming" || state === "synthesizing" || state === "finalizing") {
    const disabled = state !== "confirming";
    return /* @__PURE__ */ jsxs9("div", { className: "flex gap-2 px-3 py-3 border-t border-border bg-background", children: [
      /* @__PURE__ */ jsxs9(
        Button,
        {
          type: "button",
          variant: "outline",
          onClick: onAdjust,
          disabled,
          className: "flex-1",
          "data-feedback-id": "feedback.footer.adjust",
          children: [
            state === "synthesizing" ? /* @__PURE__ */ jsx12(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx12(RotateCcw, { className: "h-4 w-4 mr-1" }),
            "\u21BA Sigamos iterando"
          ]
        }
      ),
      /* @__PURE__ */ jsxs9(
        Button,
        {
          type: "button",
          variant: "default",
          onClick: onConfirm,
          disabled,
          className: "flex-1",
          "data-feedback-id": "feedback.footer.confirm",
          children: [
            state === "finalizing" ? /* @__PURE__ */ jsx12(Loader2, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ jsx12(Check, { className: "h-4 w-4 mr-1" }),
            "\u2713 Confirmar"
          ]
        }
      )
    ] });
  }
  return null;
}

// src/chat/StatusPill.tsx
import { jsx as jsx13 } from "react/jsx-runtime";
var _STATUS_STYLES = {
  new: {
    label: "Recibido",
    classes: "border-muted-foreground/30 bg-muted text-muted-foreground"
  },
  triaged: {
    label: "En triaje",
    classes: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700"
  },
  in_progress: {
    label: "En curso",
    classes: "border-blue-500/30 bg-blue-500/10 text-blue-700"
  },
  done: {
    label: "Resuelto",
    classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
  },
  wont_fix: {
    label: "No se har\xE1",
    classes: "border-destructive/30 bg-destructive/10 text-destructive"
  }
};
function StatusPill({ status }) {
  const style = _STATUS_STYLES[status] ?? _STATUS_STYLES.new;
  return /* @__PURE__ */ jsx13(
    "span",
    {
      className: `inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${style.classes}`,
      "data-feedback-id": "feedback.status_pill",
      "data-status": status,
      children: style.label
    }
  );
}

// src/chat/MineFeedTab.tsx
import { jsx as jsx14, jsxs as jsxs10 } from "react/jsx-runtime";
function MineFeedTab({ onSelectFeedback }) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const query = useMyFeedbackQuery(25);
  if (query.isLoading) {
    return /* @__PURE__ */ jsx14("p", { className: "text-sm text-muted-foreground p-4", children: t("feedback.mine.loading") });
  }
  if (query.isError) {
    return /* @__PURE__ */ jsx14("p", { className: "text-sm text-destructive p-4", children: t("feedback.mine.error") });
  }
  const rows = query.data ?? [];
  if (rows.length === 0) {
    return /* @__PURE__ */ jsx14("p", { className: "text-sm text-muted-foreground p-4", children: t("feedback.mine.empty") });
  }
  return /* @__PURE__ */ jsx14("ul", { className: "space-y-2 p-1", children: rows.map((r) => /* @__PURE__ */ jsx14("li", { children: /* @__PURE__ */ jsxs10(
    "button",
    {
      type: "button",
      onClick: () => onSelectFeedback?.(r.id),
      className: "w-full p-2 text-sm flex items-center gap-2 rounded-md border border-input hover:bg-accent text-left",
      "data-feedback-id": "feedback.mine.row",
      children: [
        /* @__PURE__ */ jsx14("code", { className: "font-mono text-xs px-1 py-0.5 rounded bg-muted shrink-0", children: r.ticket_code || "\u2014" }),
        /* @__PURE__ */ jsx14(StatusPill, { status: r.status }),
        /* @__PURE__ */ jsx14("span", { className: "truncate flex-1 font-medium", children: r.title })
      ]
    }
  ) }, r.id)) });
}

// src/chat/SynthesisCard.tsx
import { jsx as jsx15, jsxs as jsxs11 } from "react/jsx-runtime";
function SectionTitle({ label }) {
  return /* @__PURE__ */ jsx15("p", { className: "text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: label });
}
function PersonasBlock({ personas }) {
  return /* @__PURE__ */ jsxs11("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ jsx15(SectionTitle, { label: "Personas" }),
    /* @__PURE__ */ jsx15("ul", { className: "flex flex-col gap-2 text-sm text-foreground", children: personas.map((p, idx) => /* @__PURE__ */ jsxs11(
      "li",
      {
        className: "rounded border border-input/60 bg-muted/30 px-2 py-1",
        children: [
          /* @__PURE__ */ jsx15("p", { className: "font-medium", children: p.name }),
          /* @__PURE__ */ jsxs11("p", { className: "text-xs text-muted-foreground", children: [
            "Objetivo: ",
            p.goal
          ] }),
          /* @__PURE__ */ jsxs11("p", { className: "text-xs text-muted-foreground", children: [
            "Fricci\xF3n: ",
            p.frustration
          ] })
        ]
      },
      `persona-${idx}-${p.name.slice(0, 16)}`
    )) })
  ] });
}
function BulletList({
  label,
  items,
  muted = false
}) {
  return /* @__PURE__ */ jsxs11("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ jsx15(SectionTitle, { label }),
    /* @__PURE__ */ jsx15(
      "ul",
      {
        className: `list-disc space-y-1 pl-5 text-sm ${muted ? "text-muted-foreground" : "text-foreground"}`,
        children: items.map((item, idx) => /* @__PURE__ */ jsx15("li", { children: item }, `${label}-${idx}-${item.slice(0, 16)}`))
      }
    )
  ] });
}
function DiagramBlock({ source }) {
  return /* @__PURE__ */ jsxs11("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ jsx15(SectionTitle, { label: "Diagrama" }),
    /* @__PURE__ */ jsx15(
      "pre",
      {
        "data-feedback-mermaid-source": "true",
        className: "overflow-x-auto rounded border border-input/60 bg-muted/40 p-2 text-xs text-foreground",
        children: /* @__PURE__ */ jsx15("code", { children: source })
      }
    )
  ] });
}
function SynthesisCard({ synthesis }) {
  const extraStories = (synthesis.user_stories ?? []).filter(
    (s) => s && s !== synthesis.user_story
  );
  return /* @__PURE__ */ jsxs11(
    "div",
    {
      className: "mx-4 my-3 flex flex-col gap-3 rounded-lg border border-input bg-card p-4 shadow-sm",
      "data-feedback-id": "feedback.chat_synthesis_card",
      children: [
        /* @__PURE__ */ jsx15("h3", { className: "text-base font-bold text-foreground", children: synthesis.title }),
        /* @__PURE__ */ jsx15("p", { className: "text-sm text-muted-foreground", children: synthesis.summary }),
        /* @__PURE__ */ jsx15("blockquote", { className: "border-l-2 border-primary pl-3 text-sm italic text-foreground", children: synthesis.user_story }),
        extraStories.length > 0 ? /* @__PURE__ */ jsx15(BulletList, { label: "Historias de usuario adicionales", items: extraStories }) : null,
        synthesis.personas && synthesis.personas.length > 0 ? /* @__PURE__ */ jsx15(PersonasBlock, { personas: synthesis.personas }) : null,
        synthesis.acceptance_criteria.length > 0 ? /* @__PURE__ */ jsx15(
          BulletList,
          {
            label: "Criterios de aceptaci\xF3n",
            items: synthesis.acceptance_criteria
          }
        ) : null,
        synthesis.assumptions && synthesis.assumptions.length > 0 ? /* @__PURE__ */ jsx15(BulletList, { label: "Supuestos", items: synthesis.assumptions, muted: true }) : null,
        synthesis.diagram ? /* @__PURE__ */ jsx15(DiagramBlock, { source: synthesis.diagram }) : null,
        synthesis.open_questions.length > 0 ? /* @__PURE__ */ jsx15(
          BulletList,
          {
            label: "Preguntas abiertas",
            items: synthesis.open_questions,
            muted: true
          }
        ) : null
      ]
    }
  );
}

// src/chat/TicketDetail.tsx
import { Send } from "lucide-react";
import { useState as useState4 } from "react";
import { Fragment as Fragment2, jsx as jsx16, jsxs as jsxs12 } from "react/jsx-runtime";
function _formatTs(dt) {
  if (!dt) return "";
  return dt.slice(0, 16).replace("T", " ");
}
function TicketDetail({ feedbackId, onBack }) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const currentUser = adapter.useCurrentUser();
  const detail = useFeedbackDetailQuery(feedbackId);
  const comments = useFeedbackCommentsQuery(feedbackId);
  const post = usePostFeedbackCommentMutation();
  const [draft, setDraft] = useState4("");
  const onSend = () => {
    const body = draft.trim();
    if (!body) return;
    post.mutate(
      { feedbackId, body },
      {
        onSuccess: () => setDraft(""),
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
  return /* @__PURE__ */ jsxs12("div", { className: "flex h-full flex-col gap-3 p-1", children: [
    /* @__PURE__ */ jsxs12("div", { className: "flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsx16(
        "button",
        {
          type: "button",
          onClick: onBack,
          className: "text-xs text-muted-foreground hover:text-foreground",
          "data-feedback-id": "feedback.ticket_detail.back",
          children: "\u2190 Volver"
        }
      ),
      detail.data ? /* @__PURE__ */ jsxs12("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx16("code", { className: "font-mono text-xs px-1 py-0.5 rounded bg-muted shrink-0", children: detail.data.ticket_code || "\u2014" }),
        /* @__PURE__ */ jsx16(StatusPill, { status: detail.data.status })
      ] }) : null
    ] }),
    detail.isLoading ? /* @__PURE__ */ jsx16("p", { className: "text-sm text-muted-foreground", children: t("feedback.mine.loading") }) : detail.isError || !detail.data ? /* @__PURE__ */ jsx16("p", { className: "text-sm text-destructive", children: t("feedback.mine.error") }) : /* @__PURE__ */ jsxs12(Fragment2, { children: [
      /* @__PURE__ */ jsxs12(
        "section",
        {
          className: "flex flex-col gap-2 rounded-lg border border-input bg-card p-3 shadow-sm",
          "data-feedback-id": "feedback.ticket_detail.summary",
          children: [
            /* @__PURE__ */ jsx16("h3", { className: "text-base font-bold text-foreground", children: detail.data.title }),
            detail.data.description ? /* @__PURE__ */ jsx16("p", { className: "whitespace-pre-wrap text-sm text-muted-foreground", children: detail.data.description }) : /* @__PURE__ */ jsx16("p", { className: "text-sm italic text-muted-foreground", children: t("feedback.mine.no_description") }),
            detail.data.triage_note ? /* @__PURE__ */ jsxs12("div", { className: "rounded-md border border-primary/30 bg-primary/5 p-2 text-xs", children: [
              /* @__PURE__ */ jsx16("p", { className: "font-semibold uppercase tracking-wide text-primary mb-1", children: t("feedback.mine.triage_note") }),
              /* @__PURE__ */ jsx16("p", { className: "whitespace-pre-wrap text-foreground", children: detail.data.triage_note })
            ] }) : null
          ]
        }
      ),
      /* @__PURE__ */ jsxs12("section", { className: "flex flex-1 min-h-0 flex-col gap-2", children: [
        /* @__PURE__ */ jsx16("h4", { className: "text-xs font-semibold uppercase tracking-wide text-foreground", children: t("feedback.comments.thread_title") }),
        /* @__PURE__ */ jsx16("div", { className: "flex-1 min-h-0 overflow-y-auto", children: comments.isLoading ? /* @__PURE__ */ jsx16("p", { className: "text-xs text-muted-foreground", children: t("feedback.comments.loading") }) : comments.isError ? /* @__PURE__ */ jsx16("p", { className: "text-xs text-destructive", children: t("feedback.comments.error") }) : (comments.data?.data?.length ?? 0) === 0 ? /* @__PURE__ */ jsx16("p", { className: "text-xs italic text-muted-foreground", children: t("feedback.comments.empty") }) : /* @__PURE__ */ jsx16("ul", { className: "flex flex-col gap-2", children: comments.data?.data.map((c) => {
          const isMine = currentUser !== null && c.author_user_id === currentUser.id;
          const role = isMine ? "user" : "admin";
          const caption = role === "admin" ? `${t("feedback.comments.admin_label")} \xB7 ${_formatTs(c.created_at)}` : void 0;
          return /* @__PURE__ */ jsx16("li", { children: /* @__PURE__ */ jsx16(ChatBubble, { role, text: c.body, caption }) }, c.id);
        }) }) })
      ] }),
      /* @__PURE__ */ jsxs12("div", { className: "space-y-1.5", children: [
        /* @__PURE__ */ jsx16(
          Textarea,
          {
            value: draft,
            onChange: (e) => setDraft(e.target.value),
            placeholder: t("feedback.comments.placeholder"),
            rows: 2,
            maxLength: 5e3,
            disabled: post.isPending,
            "data-feedback-id": "feedback.ticket_detail.draft"
          }
        ),
        /* @__PURE__ */ jsx16("div", { className: "flex justify-end", children: /* @__PURE__ */ jsxs12(
          Button,
          {
            type: "button",
            size: "sm",
            onClick: onSend,
            disabled: post.isPending || draft.trim().length === 0,
            "data-feedback-id": "feedback.ticket_detail.send",
            children: [
              /* @__PURE__ */ jsx16(Send, { className: "mr-1 h-3.5 w-3.5" }),
              post.isPending ? t("feedback.comments.sending") : t("feedback.comments.send")
            ]
          }
        ) })
      ] })
    ] })
  ] });
}

// src/chat/VoiceRecorder.tsx
import { Check as Check2, Loader2 as Loader22, X as X3 } from "lucide-react";
import { useEffect as useEffect5, useRef as useRef4 } from "react";
import { Fragment as Fragment3, jsx as jsx17, jsxs as jsxs13 } from "react/jsx-runtime";
var _MAX_DURATION_MS2 = 3e4;
var _BAR_MIN_PX = 3;
var _BAR_MAX_PX = 26;
function _formatMs(ms) {
  const clamped = Math.max(0, Math.min(ms, _MAX_DURATION_MS2));
  const seconds = Math.floor(clamped / 1e3);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
function _Waveform({
  active,
  getAudioLevels
}) {
  const barRefs = useRef4([]);
  const rafRef = useRef4(null);
  useEffect5(() => {
    if (!active) {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    const loop = () => {
      const levels = getAudioLevels();
      const bars = barRefs.current;
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        if (!bar) continue;
        const level = levels[i] ?? 0;
        const px = Math.max(
          _BAR_MIN_PX,
          Math.round(_BAR_MIN_PX + level * (_BAR_MAX_PX - _BAR_MIN_PX))
        );
        bar.style.height = `${px}px`;
      }
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, getAudioLevels]);
  return /* @__PURE__ */ jsx17("div", { className: "flex flex-1 items-center justify-center gap-[2px] h-8 px-2", "aria-hidden": "true", children: Array.from({ length: AUDIO_LEVEL_BARS }).map((_, i) => /* @__PURE__ */ jsx17(
    "span",
    {
      ref: (el) => {
        barRefs.current[i] = el;
      },
      className: "w-[2px] rounded-full bg-foreground/80 transition-[height] duration-75",
      style: { height: `${_BAR_MIN_PX}px` }
    },
    i
  )) });
}
function VoiceRecorder({
  state,
  duration_ms,
  getAudioLevels,
  onStop,
  onCancel
}) {
  if (state !== "recording" && state !== "stopping" && state !== "transcribing") return null;
  const isRecording = state === "recording";
  const isWorking = state === "stopping" || state === "transcribing";
  const timer = _formatMs(duration_ms);
  return /* @__PURE__ */ jsxs13(
    "output",
    {
      "aria-live": "polite",
      "aria-label": isRecording ? "Grabando" : "Transcribiendo",
      "data-feedback-id": "feedback.voice_recorder",
      className: "flex items-center gap-2 border-t border-input bg-background px-3 py-3",
      children: [
        /* @__PURE__ */ jsx17(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "sm",
            onClick: onCancel,
            disabled: isWorking,
            "aria-label": "Descartar grabaci\xF3n",
            "data-feedback-id": "feedback.voice_cancel",
            className: "rounded-full",
            children: /* @__PURE__ */ jsx17(X3, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsx17("div", { className: "flex-1 flex items-center gap-2 rounded-full bg-muted/40 px-2 py-1", children: isWorking ? /* @__PURE__ */ jsxs13("div", { className: "flex flex-1 items-center justify-center gap-2 h-8 text-xs text-muted-foreground", children: [
          /* @__PURE__ */ jsx17(Loader22, { className: "h-4 w-4 animate-spin" }),
          /* @__PURE__ */ jsx17("span", { children: "Transcribiendo\u2026" })
        ] }) : /* @__PURE__ */ jsxs13(Fragment3, { children: [
          /* @__PURE__ */ jsx17(_Waveform, { active: isRecording, getAudioLevels }),
          /* @__PURE__ */ jsx17(
            "span",
            {
              className: "shrink-0 pr-1 text-[10px] tabular-nums text-muted-foreground",
              "aria-hidden": "true",
              children: timer
            }
          )
        ] }) }),
        /* @__PURE__ */ jsx17(
          Button,
          {
            type: "button",
            size: "sm",
            onClick: onStop,
            disabled: isWorking,
            "aria-label": "Detener y enviar",
            "data-feedback-id": "feedback.voice_stop",
            className: "rounded-full",
            children: /* @__PURE__ */ jsx17(Check2, { className: "h-4 w-4" })
          }
        )
      ]
    }
  );
}

// src/chat/useFeedbackChat.ts
import { useCallback as useCallback4, useEffect as useEffect6, useRef as useRef6, useState as useState6 } from "react";

// src/capture/diagnostics.ts
var MAX_CONSOLE_ENTRIES = 20;
var MAX_NETWORK_ENTRIES = 20;
var MAX_TEXT_LENGTH = 240;
var consoleRing = [];
var networkRing = [];
var installed = false;
var originalConsoleError = null;
var originalConsoleWarn = null;
var originalFetch = null;
function truncate(s) {
  return s.length > MAX_TEXT_LENGTH ? `${s.slice(0, MAX_TEXT_LENGTH - 1)}\u2026` : s;
}
function pushRing(ring, entry, cap) {
  ring.push(truncate(entry));
  while (ring.length > cap) {
    ring.shift();
  }
}
function formatArgs(args) {
  return args.map((a) => {
    if (a instanceof Error) return `${a.name}: ${a.message}`;
    if (typeof a === "string") return a;
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  }).join(" ");
}
function installDiagnostics() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    pushRing(consoleRing, `[error] ${formatArgs(args)}`, MAX_CONSOLE_ENTRIES);
    originalConsoleError?.(...args);
  };
  originalConsoleWarn = console.warn.bind(console);
  console.warn = (...args) => {
    pushRing(consoleRing, `[warn] ${formatArgs(args)}`, MAX_CONSOLE_ENTRIES);
    originalConsoleWarn?.(...args);
  };
  if (typeof window.fetch === "function") {
    originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const start = performance.now();
      try {
        const resp = await originalFetch(input, init);
        if (resp.status >= 400) {
          const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          const dur = Math.round(performance.now() - start);
          pushRing(
            networkRing,
            `${resp.status} ${init?.method ?? "GET"} ${url} (${dur}ms)`,
            MAX_NETWORK_ENTRIES
          );
        }
        return resp;
      } catch (err) {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        pushRing(
          networkRing,
          `network-error ${init?.method ?? "GET"} ${url}: ${err.message}`,
          MAX_NETWORK_ENTRIES
        );
        throw err;
      }
    };
  }
}
function getDiagnosticsSnapshot() {
  return {
    console_tail: [...consoleRing],
    network_errors_tail: [...networkRing],
    framework: detectFramework()
  };
}
function detectFramework() {
  if (typeof window === "undefined") return null;
  const w = window;
  if (w.__NEXT_DATA__) return "next.js";
  if (w.__NUXT__) return "nuxt";
  if (w.__REMIX_CONTEXT__) return "remix";
  if (w.__SVELTEKIT_DEV__ || w.__sveltekit_dev) return "sveltekit";
  if (w.ng) return "angular";
  if (w.Vue) return "vue";
  if (w.React) return "react";
  return null;
}
function snapshotElementOuterHtml(el) {
  if (!el) return null;
  const raw = el.outerHTML ?? "";
  return raw.length > 4096 ? `${raw.slice(0, 4095)}\u2026` : raw;
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
async function cropImageBlob(source, bbox) {
  if (typeof document === "undefined") return source;
  if (!bbox || bbox.w <= 0 || bbox.h <= 0) return source;
  const url = URL.createObjectURL(source);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    const scale = typeof window !== "undefined" && window.innerWidth > 0 ? img.naturalWidth / window.innerWidth : 1;
    const sx = Math.max(0, Math.round(bbox.x * scale));
    const sy = Math.max(0, Math.round(bbox.y * scale));
    const sw = Math.max(1, Math.round(bbox.w * scale));
    const sh = Math.max(1, Math.round(bbox.h * scale));
    if (sx >= img.naturalWidth || sy >= img.naturalHeight) {
      return source;
    }
    const clampedW = Math.min(sw, img.naturalWidth - sx);
    const clampedH = Math.min(sh, img.naturalHeight - sy);
    const canvas = document.createElement("canvas");
    canvas.width = clampedW;
    canvas.height = clampedH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return source;
    ctx.drawImage(img, sx, sy, clampedW, clampedH, 0, 0, clampedW, clampedH);
    const cropped = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
    return cropped ?? source;
  } catch {
    return source;
  } finally {
    URL.revokeObjectURL(url);
  }
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
import { useCallback as useCallback3, useRef as useRef5, useState as useState5 } from "react";

// src/client/idempotency.ts
function newIdempotencyKey() {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}

// src/chat/useChatRunStream.ts
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
  const [state, setState] = useState5("idle");
  const [messages, setMessages] = useState5([]);
  const [partial_text, setPartialText] = useState5("");
  const [synthesis, setSynthesis] = useState5(null);
  const [error, setError] = useState5(null);
  const abortRef = useRef5(null);
  const reset = useCallback3(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle");
    setMessages([]);
    setPartialText("");
    setSynthesis(null);
    setError(null);
  }, []);
  const pushAssistantGreeting = useCallback3((text) => {
    setMessages((prev) => [...prev, { role: "assistant", text, ts: Date.now() }]);
    setState("awaiting_user");
  }, []);
  const pushAssistantMessage = useCallback3((text) => {
    setMessages((prev) => [...prev, { role: "assistant", text, ts: Date.now() }]);
  }, []);
  const setStateExternal = useCallback3((next) => {
    setState(next);
  }, []);
  const clearSynthesis = useCallback3(() => {
    setSynthesis(null);
  }, []);
  const seedConversation = useCallback3(
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
  const sendMessage = useCallback3(
    async (content, via = "text") => {
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
          body: JSON.stringify({ content: trimmed, via })
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
function _buildConfirmUrl(bindings, sessionId) {
  const base = bindings.apiBaseUrl.replace(/\/$/, "");
  const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
  return `${base}${prefix}/chat/sessions/${encodeURIComponent(sessionId)}/confirm`;
}
function _buildAbandonUrl(bindings, sessionId) {
  const base = bindings.apiBaseUrl.replace(/\/$/, "");
  const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
  return `${base}${prefix}/chat/sessions/${encodeURIComponent(sessionId)}/abandon`;
}
function _buildVoiceUrl(bindings, sessionId) {
  const base = bindings.apiBaseUrl.replace(/\/$/, "");
  const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
  return `${base}${prefix}/chat/sessions/${encodeURIComponent(sessionId)}/voice`;
}
function _buildAutoContext(args) {
  const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}` : "";
  const route = typeof window !== "undefined" ? window.location.pathname + window.location.search + window.location.hash : null;
  const viewport = typeof window !== "undefined" ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio } : null;
  const diag = getDiagnosticsSnapshot();
  return {
    url,
    route,
    viewport,
    app_version: args.appVersion || null,
    git_commit_sha: args.gitSha || null,
    user_role: args.userRole,
    framework: diag.framework,
    // Sprint D — ship navigator.userAgent so the LLM (and the
    // resulting feedback row's metadata_bundle) carry browser/OS
    // context. AutoContext pydantic caps at 512 chars; truncate
    // here to stay deterministic.
    user_agent: typeof navigator !== "undefined" && navigator.userAgent ? navigator.userAgent.slice(0, 512) : null,
    console_tail: diag.console_tail,
    network_errors_tail: diag.network_errors_tail,
    // S3F shell-hybrid: forward the locked element so backend can hang
    // turn context (and downstream feedback row) off the right DOM node.
    // Sprint A Phase 2 promotes these to feedback.element_* columns.
    element_selector: args.locked?.selector ?? null,
    element_xpath: args.locked?.xpath ?? null,
    element_bounding_box: args.locked?.bounding_box ?? null,
    element_outer_html: args.locked?.outer_html ?? null
  };
}
async function _blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 32768;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
function useFeedbackChat() {
  const bindings = useFeedbackBindings();
  const adapter = useFeedbackAdapter();
  const user = adapter.useCurrentUser();
  const [sessionId, setSessionId] = useState6(null);
  const stream = useChatRunStream({ bindings, sessionId });
  const [overrideState, setOverrideState] = useState6(null);
  const [openError, setOpenError] = useState6(null);
  const [pageScreenshotBlob, setPageScreenshotBlob] = useState6(null);
  const [screenshotBlob, setScreenshotBlob] = useState6(null);
  const [screenshotCleared, setScreenshotCleared] = useState6(false);
  const openingRef = useRef6(false);
  const [captureMode, setCaptureMode] = useState6("page");
  const [lockedElement, setLockedElement] = useState6(null);
  const [activeTab, setActiveTab] = useState6("compose");
  const voiceCapture = useVoiceCapture();
  const [voiceState, setVoiceState] = useState6("idle");
  const [voiceTranscript, setVoiceTranscript] = useState6("");
  const [voiceLang, setVoiceLang] = useState6("");
  const [voiceError, setVoiceError] = useState6(null);
  const [composerValue, setComposerValue] = useState6("");
  const [composerAutoFocus, setComposerAutoFocus] = useState6(false);
  const composerFromVoiceRef = useRef6(false);
  const setMode = useCallback4((mode) => {
    setCaptureMode(mode);
  }, []);
  const clearLocked = useCallback4(() => {
    setLockedElement(null);
    setCaptureMode("page");
  }, []);
  const acceptLocked = useCallback4((info) => {
    let enriched = info;
    if (info.outer_html === void 0 && typeof document !== "undefined") {
      try {
        const node = document.querySelector(info.selector);
        const html = snapshotElementOuterHtml(node);
        if (html) {
          enriched = { ...info, outer_html: html };
        }
      } catch {
      }
    }
    setLockedElement(enriched);
    setCaptureMode("element");
  }, []);
  const selectTab = useCallback4((tab) => {
    setActiveTab(tab);
  }, []);
  const openSheet = useCallback4(async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    installDiagnostics();
    setOverrideState("opening");
    setOpenError(null);
    try {
      try {
        const result = await capturePageScreenshot({
          redactionSelectors: DEFAULT_REDACTION_SELECTORS
        });
        if (result?.blob) {
          setScreenshotCleared(false);
          setPageScreenshotBlob(result.blob);
          setScreenshotBlob(result.blob);
        }
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
  const closeSheet = useCallback4(() => {
    stream.reset();
    setSessionId(null);
    setOverrideState(null);
    setOpenError(null);
    setComposerValue("");
    setComposerAutoFocus(false);
    setVoiceTranscript("");
    setVoiceLang("");
    setVoiceError(null);
    setVoiceState("idle");
    setScreenshotBlob(null);
    setPageScreenshotBlob(null);
    setScreenshotCleared(false);
    openingRef.current = false;
  }, [stream]);
  const clearScreenshot = useCallback4(() => {
    setScreenshotBlob(null);
    setPageScreenshotBlob(null);
    setScreenshotCleared(true);
  }, []);
  useEffect6(() => {
    if (screenshotCleared || !pageScreenshotBlob) return;
    let cancelled = false;
    const bbox = lockedElement?.bounding_box;
    if (captureMode === "element" && bbox && bbox.w > 0 && bbox.h > 0) {
      void cropImageBlob(pageScreenshotBlob, bbox).then((cropped) => {
        if (!cancelled) setScreenshotBlob(cropped);
      });
    } else {
      setScreenshotBlob(pageScreenshotBlob);
    }
    return () => {
      cancelled = true;
    };
  }, [captureMode, lockedElement, pageScreenshotBlob, screenshotCleared]);
  const sendUserMessage = useCallback4(
    async (content) => {
      const via = composerFromVoiceRef.current ? "voice" : "text";
      composerFromVoiceRef.current = false;
      setComposerValue("");
      await stream.sendMessage(content, via);
    },
    [stream]
  );
  const confirmSynthesis = useCallback4(async () => {
    if (!sessionId) {
      setOpenError("session not initialised");
      stream.setStateExternal("error");
      return;
    }
    stream.setStateExternal("finalizing");
    try {
      const url = _buildConfirmUrl(bindings, sessionId);
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
      let screenshotB64 = null;
      if (screenshotBlob) {
        try {
          screenshotB64 = await _blobToBase64(screenshotBlob);
        } catch (err) {
          if (typeof console !== "undefined") {
            console.warn("[feedback-chat] screenshot encode failed", err);
          }
        }
      }
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          synthesis_override: null,
          screenshot_b64: screenshotB64,
          screenshot_content_type: screenshotB64 ? "image/png" : null
        })
      });
      if (!resp.ok) {
        let detail = resp.statusText;
        try {
          const data = await resp.json();
          if (data && typeof data.detail === "string") detail = data.detail;
        } catch {
        }
        const msg = `No pudimos registrar tu feedback (${resp.status}). ${detail}`;
        setOpenError(msg);
        stream.setStateExternal("error");
        try {
          adapter.toast?.error?.(msg);
        } catch {
        }
        return;
      }
      const body = await resp.json();
      const ticket = body.ticket_code || "FB-?";
      stream.pushAssistantMessage(
        `\u2713 \xA1Gracias! Tu feedback es ${ticket}. Te avisaremos cuando lo veamos.`
      );
      stream.setStateExternal("done");
    } catch (err) {
      const msg = String(err.message ?? err);
      setOpenError(msg);
      stream.setStateExternal("error");
      try {
        adapter.toast?.error?.(msg);
      } catch {
      }
    }
  }, [bindings, stream, sessionId, adapter, screenshotBlob]);
  const abandonSession = useCallback4(async () => {
    if (!sessionId) return;
    try {
      const url = _buildAbandonUrl(bindings, sessionId);
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
        method: "POST",
        credentials: "include",
        headers
      });
      if (!resp.ok && typeof console !== "undefined") {
        console.warn(`[feedback-chat] abandon failed (${resp.status})`);
      }
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[feedback-chat] abandon network error", err);
      }
    }
  }, [bindings, sessionId]);
  const loadConversation = useCallback4(
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
  const newConversation = useCallback4(async () => {
    stream.reset();
    setSessionId(null);
    setOverrideState(null);
    setOpenError(null);
    await openSheet();
  }, [stream, openSheet]);
  const adjustSynthesis = useCallback4(() => {
    stream.clearSynthesis();
    stream.pushAssistantMessage("\xBFQu\xE9 cambiar\xEDas del resumen?");
    stream.setStateExternal("awaiting_user");
  }, [stream]);
  const startVoice = useCallback4(async () => {
    setVoiceError(null);
    setVoiceTranscript("");
    setVoiceLang("");
    setVoiceState("recording");
    await voiceCapture.startRecording();
    if (voiceCapture.state === "error" || voiceCapture.error) {
      setVoiceError(voiceCapture.error ?? "Microphone unavailable");
      setVoiceState("error");
    }
  }, [voiceCapture]);
  const cancelVoice = useCallback4(() => {
    voiceCapture.cancelRecording();
    setVoiceTranscript("");
    setVoiceLang("");
    setVoiceError(null);
    setVoiceState("idle");
  }, [voiceCapture]);
  const stopVoice = useCallback4(async () => {
    if (!sessionId) {
      setVoiceError("session not initialised");
      setVoiceState("error");
      return;
    }
    const result = await voiceCapture.stopRecording();
    if (!result || result.blob.size === 0) {
      setVoiceState("idle");
      return;
    }
    setVoiceState("transcribing");
    try {
      const url = _buildVoiceUrl(bindings, sessionId);
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
      const form = new FormData();
      const ext = result.mime_type.includes("mp4") ? "m4a" : result.mime_type.includes("ogg") ? "ogg" : "webm";
      form.append("audio", result.blob, `clip.${ext}`);
      if (voiceLang) {
        form.append("language_hint", voiceLang);
      }
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: form
      });
      if (!resp.ok) {
        let detail = resp.statusText;
        try {
          const data = await resp.json();
          if (data && typeof data.detail === "string") detail = data.detail;
        } catch {
        }
        const msg = `Voice transcription failed (${resp.status}): ${detail}`;
        setVoiceError(msg);
        setVoiceState("error");
        return;
      }
      const body = await resp.json();
      const transcript = body.transcript ?? "";
      const lang = body.lang ?? "";
      setVoiceTranscript(transcript);
      setVoiceLang(lang);
      if (transcript.length > 0) {
        setComposerValue((current) => {
          if (current.trim().length === 0) return transcript;
          return `${current.replace(/\s+$/, "")} ${transcript}`;
        });
        setComposerAutoFocus(true);
        composerFromVoiceRef.current = true;
      }
      setVoiceState("idle");
    } catch (err) {
      const msg = String(err.message ?? err);
      setVoiceError(msg);
      setVoiceState("error");
    }
  }, [bindings, sessionId, voiceCapture]);
  const confirmVoiceTranscript = useCallback4(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setVoiceState("idle");
        return;
      }
      setVoiceTranscript("");
      setVoiceLang("");
      setVoiceState("idle");
      await stream.sendMessage(trimmed, "voice");
    },
    [stream]
  );
  const setComposerValueCb = useCallback4((next) => {
    setComposerValue((current) => {
      if (next !== current) {
        composerFromVoiceRef.current = false;
      }
      return next;
    });
  }, []);
  useEffect6(() => {
    if (!composerAutoFocus) return;
    const id = window.requestAnimationFrame(() => {
      setComposerAutoFocus(false);
    });
    return () => window.cancelAnimationFrame(id);
  }, [composerAutoFocus]);
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
    abandonSession,
    adjustSynthesis,
    loadConversation,
    newConversation,
    captureMode,
    lockedElement,
    activeTab,
    screenshotBlob,
    clearScreenshot,
    setMode,
    clearLocked,
    acceptLocked,
    selectTab,
    voiceState,
    voiceDurationMs: voiceCapture.duration_ms,
    voiceTranscript,
    voiceLang,
    voiceError,
    getVoiceAudioLevels: voiceCapture.getAudioLevels,
    startVoice,
    stopVoice,
    confirmVoiceTranscript,
    cancelVoice,
    composerValue,
    setComposerValue: setComposerValueCb,
    composerAutoFocus
  };
}

// src/chat/FeedbackChatSheet.tsx
import { Fragment as Fragment4, jsx as jsx18, jsxs as jsxs14 } from "react/jsx-runtime";
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
    abandonSession,
    adjustSynthesis,
    newConversation,
    state,
    messages,
    error,
    synthesis,
    captureMode,
    lockedElement,
    activeTab,
    screenshotBlob,
    clearScreenshot,
    setMode,
    clearLocked: clearHookLocked,
    acceptLocked,
    selectTab,
    voiceState,
    voiceDurationMs,
    voiceError,
    getVoiceAudioLevels,
    startVoice,
    stopVoice,
    cancelVoice,
    composerValue,
    setComposerValue,
    composerAutoFocus
  } = chat;
  const [selectedFeedbackId, setSelectedFeedbackId] = useState7(null);
  useEffect7(() => {
    if (activeTab !== "mine") setSelectedFeedbackId(null);
  }, [activeTab]);
  useEffect7(() => {
    if (open) {
      void openSheet();
    } else {
      closeSheet();
    }
  }, [open]);
  useEffect7(() => {
    if (locked) acceptLocked(locked);
    else clearHookLocked();
  }, [locked]);
  useEffect7(() => {
    if (state !== "done") return;
    const tid = window.setTimeout(() => onOpenChange(false), 3e3);
    return () => window.clearTimeout(tid);
  }, [state, onOpenChange]);
  const handleOpenChange = useCallback5(
    (next) => {
      if (!next && state !== "done" && state !== "idle") {
        void abandonSession();
      }
      onOpenChange(next);
    },
    [state, abandonSession, onOpenChange]
  );
  const showSynthesis = state === "confirming" && synthesis !== null;
  return /* @__PURE__ */ jsx18(Sheet, { open, onOpenChange: handleOpenChange, children: /* @__PURE__ */ jsxs14(
    SheetContent,
    {
      side: "right",
      className: `${_SHEET_WIDTH} flex h-full flex-col gap-0 bg-gradient-to-b from-background via-background to-muted/10 p-0`,
      "data-feedback-widget-root": "true",
      children: [
        /* @__PURE__ */ jsxs14(SheetHeader, { className: "border-b border-input/60 px-4 pt-4 pb-3", children: [
          /* @__PURE__ */ jsxs14(SheetTitle, { className: "flex items-center gap-2 text-base", children: [
            /* @__PURE__ */ jsx18(Rl3Mark, { className: "h-6 w-6 shrink-0" }),
            /* @__PURE__ */ jsx18("span", { children: t("feedback.panel_title") })
          ] }),
          /* @__PURE__ */ jsx18(SheetDescription, { className: "text-xs text-muted-foreground/80", children: t("feedback.panel_description") })
        ] }),
        /* @__PURE__ */ jsx18("div", { className: "px-4 pt-3 pb-2", children: /* @__PURE__ */ jsx18(
          FeedbackTabs,
          {
            activeTab,
            mineTotalCount: 0,
            onTabChange: selectTab
          }
        ) }),
        activeTab === "compose" ? /* @__PURE__ */ jsxs14(Fragment4, { children: [
          /* @__PURE__ */ jsx18("div", { className: "px-4 pb-2", children: /* @__PURE__ */ jsx18(
            CapturePicker,
            {
              mode: captureMode,
              locked: lockedElement,
              onActivatePicker,
              onClearLocked,
              onModeChange: setMode
            }
          ) }),
          /* @__PURE__ */ jsx18(
            CapturePreview,
            {
              blob: screenshotBlob,
              mode: captureMode,
              selector: lockedElement?.selector ?? null,
              onClear: clearScreenshot
            }
          ),
          /* @__PURE__ */ jsxs14("div", { className: "flex-1 min-h-0 overflow-y-auto", children: [
            /* @__PURE__ */ jsx18(
              ChatTimeline,
              {
                messages,
                isThinking: _isThinking(state),
                thinkingLabel: _thinkingLabel(state)
              }
            ),
            error ? /* @__PURE__ */ jsx18("div", { className: "mx-4 my-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive", children: error }) : null,
            voiceError ? /* @__PURE__ */ jsx18("div", { className: "mx-4 my-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive", children: voiceError }) : null,
            showSynthesis ? /* @__PURE__ */ jsx18(SynthesisCard, { synthesis }) : null
          ] }),
          voiceState === "recording" || voiceState === "transcribing" ? /* @__PURE__ */ jsx18(
            VoiceRecorder,
            {
              state: voiceState === "transcribing" ? "transcribing" : "recording",
              duration_ms: voiceDurationMs,
              getAudioLevels: getVoiceAudioLevels,
              onStop: () => void stopVoice(),
              onCancel: cancelVoice
            }
          ) : _showComposer(state) ? /* @__PURE__ */ jsx18(
            Composer,
            {
              onSend: sendUserMessage,
              disabled: state === "bot_thinking",
              onVoiceToggle: () => void startVoice(),
              value: composerValue,
              onValueChange: setComposerValue,
              autoFocus: composerAutoFocus
            }
          ) : null,
          _showFooter(state) ? /* @__PURE__ */ jsx18(
            FooterActions,
            {
              state,
              onConfirm: () => void confirmSynthesis(),
              onAdjust: adjustSynthesis,
              onRetry: () => void newConversation()
            }
          ) : null
        ] }) : /* @__PURE__ */ jsx18("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-4", children: selectedFeedbackId ? /* @__PURE__ */ jsx18(
          TicketDetail,
          {
            feedbackId: selectedFeedbackId,
            onBack: () => setSelectedFeedbackId(null)
          }
        ) : /* @__PURE__ */ jsx18(MineFeedTab, { onSelectFeedback: (fid) => setSelectedFeedbackId(fid) }) })
      ]
    }
  ) });
}

export {
  redactString,
  SubmitFeedbackError,
  FeedbackApiError,
  useFeedbackListQuery,
  useMyFeedbackQuery,
  useFeedbackDetailQuery,
  useUpdateFeedbackStatusMutation,
  useDeleteFeedbackMutation,
  useFeedbackCommentsQuery,
  usePostFeedbackCommentMutation,
  createAdapter,
  FeedbackProvider,
  useFeedbackAdapter,
  useFeedbackConfig,
  useFeedbackBindings,
  cn,
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Textarea,
  Rl3Mark,
  describeElement,
  CapturePicker,
  FeedbackTabs,
  FooterActions,
  StatusPill,
  MineFeedTab,
  SynthesisCard,
  TicketDetail,
  newIdempotencyKey,
  FeedbackChatSheet
};
//# sourceMappingURL=chunk-DEBOJOBF.js.map